-- Public listing photos live in Storage; exact pickup addresses remain seller-only.

create table public.listing_images (
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

create table public.listing_pickup_addresses (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  street_address text not null check (char_length(street_address) between 3 and 160),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null check (char_length(city) between 2 and 120),
  country_code text not null default 'FI' check (country_code = 'FI'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_listing_pickup_addresses_updated_at
  before update on public.listing_pickup_addresses
  for each row execute procedure public.set_updated_at();

alter table public.listing_images enable row level security;
alter table public.listing_pickup_addresses enable row level security;

create policy "listing images follow readable listings"
  on public.listing_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.listings as listing
      where listing.id = listing_id
        and (listing.status = 'active' or listing.seller_id = (select auth.uid()))
    )
  );

create policy "sellers read their private pickup addresses"
  on public.listing_pickup_addresses for select to authenticated
  using (
    exists (
      select 1
      from public.listings as listing
      where listing.id = listing_id and listing.seller_id = (select auth.uid())
    )
  );

revoke all on table public.listing_images, public.listing_pickup_addresses from anon, authenticated;
grant select on table public.listing_images to anon, authenticated;
grant select on table public.listing_pickup_addresses to authenticated;
grant all on table public.listing_images, public.listing_pickup_addresses to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 2097152, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sellers upload reserved listing images" on storage.objects;
create policy "sellers upload reserved listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and storage.extension(name) = 'webp'
    and exists (
      select 1
      from public.listing_images as image
      join public.listings as listing on listing.id = image.listing_id
      where image.storage_path = name
        and listing.seller_id = (select auth.uid())
        and listing.status = 'draft'
    )
  );

-- Storage removal requires both SELECT and DELETE. Public reads still use the
-- bucket's public object URLs; this SELECT policy only exposes an owner's metadata.
drop policy if exists "sellers read their listing image objects" on storage.objects;
create policy "sellers read their listing image objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and owner_id = (select auth.uid()::text));

drop policy if exists "sellers delete their listing image objects" on storage.objects;
create policy "sellers delete their listing image objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and owner_id = (select auth.uid()::text));

create or replace function public.create_listing_draft(
  p_market_country_code text,
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_minor bigint,
  p_currency text,
  p_city text,
  p_specs jsonb,
  p_shipping_country_codes text[],
  p_pickup_address jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_listing_id uuid;
  expected_currency text;
  pickup_street text;
  pickup_postal_code text;
  pickup_city text;
  pickup_country_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select market.currency into expected_currency
  from public.markets as market
  where market.country_code = upper(p_market_country_code) and market.status = 'live';

  if expected_currency is null then
    raise exception 'Unsupported market';
  end if;
  if upper(p_currency) <> expected_currency then
    raise exception 'Listing currency does not match market';
  end if;
  if coalesce(cardinality(p_shipping_country_codes), 0) = 0 then
    raise exception 'At least one shipping country is required';
  end if;
  if char_length(trim(p_city)) < 2 or char_length(trim(p_city)) > 120 then
    raise exception 'City must contain 2 to 120 characters';
  end if;
  if pg_column_size(coalesce(p_specs, '{}'::jsonb)) > 16384 then
    raise exception 'Specifications are too large';
  end if;
  if exists (
    select 1
    from unnest(p_shipping_country_codes) as destination(country_code)
    left join public.markets as market on market.country_code = upper(destination.country_code)
    where market.country_code is null
  ) then
    raise exception 'Unsupported shipping country';
  end if;

  if p_pickup_address is not null then
    if jsonb_typeof(p_pickup_address) <> 'object' then
      raise exception 'Pickup address must be an object';
    end if;
    pickup_street := trim(coalesce(p_pickup_address ->> 'street_address', ''));
    pickup_postal_code := trim(coalesce(p_pickup_address ->> 'postal_code', ''));
    pickup_city := trim(coalesce(p_pickup_address ->> 'city', ''));
    pickup_country_code := upper(trim(coalesce(p_pickup_address ->> 'country_code', 'FI')));

    if char_length(pickup_street) < 3 or char_length(pickup_street) > 160 then
      raise exception 'Pickup street address must contain 3 to 160 characters';
    end if;
    if pickup_postal_code !~ '^[0-9]{5}$' then
      raise exception 'Pickup postal code must contain five digits';
    end if;
    if char_length(pickup_city) < 2 or char_length(pickup_city) > 120 then
      raise exception 'Pickup city must contain 2 to 120 characters';
    end if;
    if pickup_country_code <> 'FI' then
      raise exception 'Only pickup addresses in Finland are enabled';
    end if;
  end if;

  insert into public.listings (
    seller_id,
    market_country_code,
    title,
    description,
    category,
    condition,
    price_minor,
    currency,
    city,
    specs,
    status,
    published_at
  )
  values (
    (select auth.uid()),
    upper(p_market_country_code),
    trim(p_title),
    trim(p_description),
    p_category,
    p_condition,
    p_price_minor,
    upper(p_currency),
    trim(p_city),
    coalesce(p_specs, '{}'::jsonb),
    'draft',
    null
  )
  returning id into new_listing_id;

  insert into public.listing_shipping_countries (listing_id, country_code)
  select new_listing_id, upper(destination.country_code)
  from (
    select distinct country_code
    from unnest(p_shipping_country_codes) as shipping(country_code)
  ) as destination;

  if p_pickup_address is not null then
    insert into public.listing_pickup_addresses (
      listing_id,
      street_address,
      postal_code,
      city,
      country_code
    )
    values (new_listing_id, pickup_street, pickup_postal_code, pickup_city, pickup_country_code);
  end if;

  return new_listing_id;
end;
$$;

create or replace function public.reserve_listing_images(p_listing_id uuid, p_images jsonb)
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
  if not exists (
    select 1
    from public.listings as listing
    where listing.id = p_listing_id
      and listing.seller_id = (select auth.uid())
      and listing.status = 'draft'
  ) then
    raise exception 'Editable listing draft not found';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Images must be an array';
  end if;
  if jsonb_array_length(p_images) < 1 or jsonb_array_length(p_images) > 5 then
    raise exception 'A listing can contain one to five reserved images';
  end if;
  if exists (select 1 from public.listing_images as image where image.listing_id = p_listing_id) then
    raise exception 'Images have already been reserved for this listing';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_images) as requested(image)
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
      left(trim(coalesce(image ->> 'alt_text', '')), 180) as requested_alt_text
    from jsonb_array_elements(p_images) as input(image)
  ),
  prepared as (
    select gen_random_uuid() as image_id, requested.*
    from requested
  )
  insert into public.listing_images as reserved (id, listing_id, storage_path, alt_text, width, height, sort_order)
  select
    prepared.image_id,
    p_listing_id,
    format('%s/%s/%s.webp', (select auth.uid()), p_listing_id, prepared.image_id),
    prepared.requested_alt_text,
    prepared.requested_width,
    prepared.requested_height,
    prepared.requested_sort_order
  from prepared
  returning
    reserved.id,
    reserved.storage_path,
    reserved.alt_text,
    reserved.width,
    reserved.height,
    reserved.sort_order;
end;
$$;

create or replace function public.publish_listing_draft(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.listings as listing
    where listing.id = p_listing_id
      and listing.seller_id = (select auth.uid())
      and listing.status = 'draft'
  ) then
    raise exception 'Editable listing draft not found';
  end if;
  if exists (
    select 1
    from public.listing_images as image
    where image.listing_id = p_listing_id
      and not exists (
        select 1
        from storage.objects as stored_object
        where stored_object.bucket_id = 'listing-images'
          and stored_object.name = image.storage_path
          and stored_object.owner_id = (select auth.uid()::text)
      )
  ) then
    raise exception 'Every reserved listing image must be uploaded before publishing';
  end if;

  update public.listings
  set status = 'active', published_at = now()
  where id = p_listing_id and seller_id = (select auth.uid()) and status = 'draft';
end;
$$;

create or replace function public.discard_listing_draft(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.listings as listing
    where listing.id = p_listing_id
      and listing.seller_id = (select auth.uid())
      and listing.status = 'draft'
  ) then
    raise exception 'Editable listing draft not found';
  end if;

  if exists (
    select 1
    from public.listing_images as image
    join storage.objects as stored_object
      on stored_object.bucket_id = 'listing-images' and stored_object.name = image.storage_path
    where image.listing_id = p_listing_id
  ) then
    raise exception 'Remove uploaded images through the Storage API before discarding the draft';
  end if;

  delete from public.listings
  where id = p_listing_id and seller_id = (select auth.uid()) and status = 'draft';
end;
$$;

revoke execute on function public.create_listing_draft(text, text, text, text, text, bigint, text, text, jsonb, text[], jsonb)
  from public, anon;
revoke execute on function public.reserve_listing_images(uuid, jsonb) from public, anon;
revoke execute on function public.publish_listing_draft(uuid) from public, anon;
revoke execute on function public.discard_listing_draft(uuid) from public, anon;

grant execute on function public.create_listing_draft(text, text, text, text, text, bigint, text, text, jsonb, text[], jsonb)
  to authenticated, service_role;
grant execute on function public.reserve_listing_images(uuid, jsonb) to authenticated, service_role;
grant execute on function public.publish_listing_draft(uuid) to authenticated, service_role;
grant execute on function public.discard_listing_draft(uuid) to authenticated, service_role;
