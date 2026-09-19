-- Persist account favourites and make listing reports a guarded server-side action.

create table public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favourites_listing_idx on public.favourites (listing_id);
create index favourites_user_created_idx on public.favourites (user_id, created_at desc);

alter table public.favourites enable row level security;
revoke all on table public.favourites from public, anon, authenticated;
grant select, insert, delete on table public.favourites to authenticated;
grant all on table public.favourites to service_role;

create policy "users read their favourites"
  on public.favourites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users save active listings"
  on public.favourites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.listings as listing
      where listing.id = listing_id and listing.status = 'active'
    )
  );

create policy "users remove their favourites"
  on public.favourites for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reports were formerly directly insertable by any authenticated browser client.
-- Keep the report body private and validate submissions through one owner-aware RPC.
revoke insert on table public.reports from authenticated;
revoke select on table public.reports from authenticated;
drop policy if exists "authenticated users create reports" on public.reports;
drop policy if exists "users read their own reports" on public.reports;

create index reports_reporter_listing_idx
  on public.reports (reporter_id, listing_id);

create or replace function public.get_my_reported_listing_ids()
returns table (listing_id uuid)
language sql
security definer
set search_path = ''
as $$
  select report.listing_id
  from public.reports as report
  where report.reporter_id = (select auth.uid());
$$;

revoke execute on function public.get_my_reported_listing_ids() from public, anon;
grant execute on function public.get_my_reported_listing_ids() to authenticated, service_role;

create or replace function public.submit_listing_report(
  p_listing_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_details text := nullif(trim(coalesce(p_details, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_reason not in ('misleading', 'prohibited', 'scam', 'other') then
    raise exception 'Invalid report reason';
  end if;
  if char_length(coalesce(clean_details, '')) > 2000 then
    raise exception 'Report details are too long';
  end if;
  if p_reason = 'other' and char_length(coalesce(clean_details, '')) < 10 then
    raise exception 'A description is required for other reports';
  end if;
  if not exists (
    select 1 from public.listings as listing
    where listing.id = p_listing_id
      and listing.status = 'active'
      and listing.seller_id <> current_user_id
  ) then
    raise exception 'Reportable listing not found';
  end if;

  -- Serialize submissions for this user/listing pair without deleting any historical
  -- duplicate reports that might predate this migration.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || p_listing_id::text, 0)
  );
  insert into public.reports (reporter_id, listing_id, reason, details)
  select current_user_id, p_listing_id, p_reason, clean_details
  where not exists (
    select 1 from public.reports
    where reporter_id = current_user_id and listing_id = p_listing_id
  );
end;
$$;

revoke execute on function public.submit_listing_report(uuid, text, text) from public, anon;
grant execute on function public.submit_listing_report(uuid, text, text) to authenticated, service_role;
