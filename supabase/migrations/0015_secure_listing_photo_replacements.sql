-- Stage replacement photos privately. The published set changes only after every
-- new object is uploaded, so a failed upload never removes the old photos.
create table public.listing_image_replacements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '' check (char_length(alt_text) <= 180),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  sort_order smallint not null check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (listing_id, sort_order)
);

alter table public.listing_image_replacements enable row level security;
revoke all on table public.listing_image_replacements from public, anon, authenticated;
grant select on table public.listing_image_replacements to authenticated;
grant all on table public.listing_image_replacements to service_role;
create policy "owners read their pending photo replacements"
  on public.listing_image_replacements for select to authenticated
  using (
    exists (
      select 1 from public.listings as listing
      where listing.id = listing_id and listing.seller_id = (select auth.uid())
    )
  );

-- The old create_listing RPC would bypass the draft + upload + publish flow.
revoke execute on function public.create_listing(text, text, text, text, text, bigint, text, text, jsonb, text[])
  from public, anon, authenticated;

-- Migration 0007 allowed owners to edit non-active listings. Keep its validated
-- implementation, but put an active-owner gate in front of the public RPC.
alter function public.update_listing_details(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  rename to update_listing_details_unchecked;
revoke execute on function public.update_listing_details_unchecked(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  from public, anon, authenticated;

create function public.update_listing_details(
  p_listing_id uuid,
  p_market_country_code text,
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_minor bigint,
  p_currency text,
  p_city text,
  p_specs jsonb,
  p_pickup_address jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.listings as listing
  where listing.id = p_listing_id
    and listing.seller_id = (select auth.uid())
    and listing.status = 'active'
  for update;
  if not found then
    raise exception 'Editable listing not found';
  end if;

  perform public.update_listing_details_unchecked(
    p_listing_id, p_market_country_code, p_title, p_description, p_category,
    p_condition, p_price_minor, p_currency, p_city, p_specs, p_pickup_address
  );
end;
$$;

revoke execute on function public.update_listing_details(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_listing_details(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  to authenticated, service_role;

drop policy if exists "sellers upload reserved listing images" on storage.objects;
create policy "sellers upload reserved listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and storage.extension(name) = 'webp'
    and (
      exists (
        select 1 from public.listing_images as image
        join public.listings as listing on listing.id = image.listing_id
        where image.storage_path = name
          and listing.seller_id = (select auth.uid())
          and listing.status = 'draft'
      )
      or exists (
        select 1 from public.listing_image_replacements as replacement
        join public.listings as listing on listing.id = replacement.listing_id
        where replacement.storage_path = name
          and listing.seller_id = (select auth.uid())
          and listing.status = 'active'
      )
    )
  );

create or replace function public.reserve_listing_replacement_images(p_listing_id uuid, p_images jsonb)
returns table (
  id uuid,
  storage_path text,
  alt_text text,
  width integer,
  height integer,
  sort_order smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.listings as listing
  where listing.id = p_listing_id
    and listing.seller_id = (select auth.uid())
    and listing.status = 'active'
  for update;
  if not found then
    raise exception 'Editable listing not found';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array'
    or jsonb_array_length(p_images) not between 1 and 5 then
    raise exception 'A replacement must contain one to five images';
  end if;
  if exists (
    select 1 from public.listing_image_replacements as replacement
    where replacement.listing_id = p_listing_id
  ) then
    raise exception 'A previous photo replacement is still pending';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_images) as requested(image)
    where not (image ?& array['width', 'height', 'sort_order'])
      or (image ->> 'width')::integer not between 1 and 4096
      or (image ->> 'height')::integer not between 1 and 4096
      or (image ->> 'sort_order')::integer not between 0 and 4
      or char_length(coalesce(image ->> 'alt_text', '')) > 180
  ) then
    raise exception 'Invalid image metadata';
  end if;
  if (
    select count(distinct (image ->> 'sort_order')::integer)
    from jsonb_array_elements(p_images) as requested(image)
  ) <> jsonb_array_length(p_images) then
    raise exception 'Image sort orders must be unique';
  end if;

  return query
  with requested as (
    select
      (image ->> 'sort_order')::smallint as requested_sort_order,
      (image ->> 'width')::integer as requested_width,
      (image ->> 'height')::integer as requested_height,
      trim(coalesce(image ->> 'alt_text', '')) as requested_alt_text
    from jsonb_array_elements(p_images) as input(image)
  ),
  prepared as (
    select gen_random_uuid() as image_id, requested.* from requested
  )
  insert into public.listing_image_replacements as reserved
    (id, listing_id, storage_path, alt_text, width, height, sort_order)
  select
    prepared.image_id,
    p_listing_id,
    format('%s/%s/%s.webp', (select auth.uid()), p_listing_id, prepared.image_id),
    prepared.requested_alt_text,
    prepared.requested_width,
    prepared.requested_height,
    prepared.requested_sort_order
  from prepared
  returning reserved.id, reserved.storage_path, reserved.alt_text,
    reserved.width, reserved.height, reserved.sort_order;
end;
$$;

create or replace function public.finalize_listing_replacement_images(
  p_listing_id uuid,
  p_market_country_code text,
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_minor bigint,
  p_currency text,
  p_city text,
  p_specs jsonb,
  p_pickup_address jsonb default null
)
returns table (old_storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_paths text[];
begin
  perform 1 from public.listings as listing
  where listing.id = p_listing_id
    and listing.seller_id = (select auth.uid())
    and listing.status = 'active'
  for update;
  if not found then
    raise exception 'Editable listing not found';
  end if;
  if not exists (
    select 1 from public.listing_image_replacements as replacement
    where replacement.listing_id = p_listing_id
  ) then
    raise exception 'No replacement images are pending';
  end if;
  if exists (
    select 1 from public.listing_image_replacements as replacement
    where replacement.listing_id = p_listing_id
      and not exists (
        select 1 from storage.objects as stored_object
        where stored_object.bucket_id = 'listing-images'
          and stored_object.name = replacement.storage_path
          and stored_object.owner_id = (select auth.uid()::text)
      )
  ) then
    raise exception 'Every replacement image must be uploaded before publishing';
  end if;

  -- Details and published photo metadata commit in the same database transaction.
  perform public.update_listing_details(
    p_listing_id, p_market_country_code, p_title, p_description, p_category,
    p_condition, p_price_minor, p_currency, p_city, p_specs, p_pickup_address
  );

  select array_agg(image.storage_path) into previous_paths
  from public.listing_images as image where image.listing_id = p_listing_id;

  delete from public.listing_images as image where image.listing_id = p_listing_id;
  insert into public.listing_images (id, listing_id, storage_path, alt_text, width, height, sort_order)
  select replacement.id, replacement.listing_id, replacement.storage_path,
    replacement.alt_text, replacement.width, replacement.height, replacement.sort_order
  from public.listing_image_replacements as replacement
  where replacement.listing_id = p_listing_id;
  delete from public.listing_image_replacements as replacement
  where replacement.listing_id = p_listing_id;

  return query select unnest(coalesce(previous_paths, '{}'::text[]));
end;
$$;

create or replace function public.abandon_listing_replacement_images(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.listings as listing
  where listing.id = p_listing_id
    and listing.seller_id = (select auth.uid())
    and listing.status = 'active'
  for update;
  if not found then
    raise exception 'Editable listing not found';
  end if;
  if exists (
    select 1 from public.listing_image_replacements as replacement
    join storage.objects as stored_object
      on stored_object.bucket_id = 'listing-images'
     and stored_object.name = replacement.storage_path
    where replacement.listing_id = p_listing_id
  ) then
    raise exception 'Remove uploaded replacement images through Storage before abandoning';
  end if;
  delete from public.listing_image_replacements as replacement
  where replacement.listing_id = p_listing_id;
end;
$$;

revoke execute on function public.reserve_listing_replacement_images(uuid, jsonb) from public, anon;
revoke execute on function public.finalize_listing_replacement_images(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.abandon_listing_replacement_images(uuid) from public, anon;
grant execute on function public.reserve_listing_replacement_images(uuid, jsonb) to authenticated, service_role;
grant execute on function public.finalize_listing_replacement_images(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.abandon_listing_replacement_images(uuid) to authenticated, service_role;
