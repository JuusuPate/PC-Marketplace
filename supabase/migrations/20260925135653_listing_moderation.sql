-- Admin-only listing moderation with an immutable decision trail.
alter table public.listings
  add column moderation_version integer not null default 0 check (moderation_version >= 0),
  add column moderation_hidden boolean not null default false,
  add constraint listings_moderation_hidden_status check (not moderation_hidden or status = 'removed');

create table public.listing_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action in ('hide', 'restore')),
  reason text not null check (char_length(trim(reason)) between 10 and 2000),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique (listing_id, version)
);
create index listing_moderation_decisions_listing_idx on public.listing_moderation_decisions (listing_id, version desc);
alter table public.listing_moderation_decisions enable row level security;
revoke all on public.listing_moderation_decisions from public, anon, authenticated;
grant select on public.listing_moderation_decisions to service_role;

create function public.moderate_admin_listing(
  p_listing_id uuid, p_action text, p_reason text, p_expected_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings%rowtype;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_listing_id is null or p_action is null or p_action not in ('hide', 'restore')
    or p_reason is null or char_length(trim(p_reason)) not between 10 and 2000
    or p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid moderation decision' using errcode = '22023';
  end if;
  select l.* into current_listing from public.listings l
  where l.id = p_listing_id and l.market_country_code = 'FI' and l.currency = 'EUR'
  for update;
  if not found then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  if current_listing.moderation_version <> p_expected_version
    or (p_action = 'hide' and current_listing.status <> 'active')
    or (p_action = 'restore' and (current_listing.status <> 'removed' or not current_listing.moderation_hidden)) then
    raise exception 'Listing changed; refresh before deciding' using errcode = '40001';
  end if;
  if p_action = 'hide' and exists (
    select 1 from public.orders o where o.listing_id = p_listing_id
      and o.status not in ('cancelled', 'refunded')
  ) then
    raise exception 'Listing has an active order' using errcode = '23514';
  end if;
  update public.listings set
    status = case when p_action = 'hide' then 'removed'::public.listing_status else 'active'::public.listing_status end,
    moderation_hidden = (p_action = 'hide'),
    moderation_version = moderation_version + 1
  where id = p_listing_id;
  insert into public.listing_moderation_decisions(listing_id, actor_id, action, reason, version)
  values(p_listing_id, (select auth.uid()), p_action, trim(p_reason), current_listing.moderation_version + 1);
end;
$$;

create or replace function public.get_admin_audit(p_search text default '', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_search is null or char_length(p_search) > 100 or p_page is null or p_page < 0 or p_page > 1000000 then
    raise exception 'Invalid audit query' using errcode = '22023';
  end if;
  with events as (
    select c.id, 'catalog' as source, c.entity_type as target_type, c.entity_id as target_id,
      c.action, c.changed_by as actor_id, c.created_at, null::text as reason,
      c.before_data, c.after_data
    from public.catalog_admin_changes c
    union all
    select d.id, 'report', 'report', d.report_id, d.action, d.actor_id, d.created_at, d.note,
      jsonb_build_object('resolved', d.action = 'reopen', 'version', d.version - 1),
      jsonb_build_object('resolved', d.action = 'resolve', 'version', d.version)
    from public.report_decisions d join public.reports r on r.id = d.report_id
    join public.listings l on l.id = r.listing_id where l.market_country_code = 'FI'
    union all
    select m.id, 'moderation', 'listing', m.listing_id, m.action, m.actor_id, m.created_at, m.reason,
      jsonb_build_object('status', case when m.action = 'hide' then 'active' else 'removed' end,
        'version', m.version - 1),
      jsonb_build_object('status', case when m.action = 'hide' then 'removed' else 'active' end,
        'version', m.version)
    from public.listing_moderation_decisions m join public.listings l on l.id = m.listing_id
    where l.market_country_code = 'FI' and l.currency = 'EUR'
  ), filtered as (
    select * from events where trim(p_search) = '' or target_id::text = trim(p_search)
      or actor_id::text = trim(p_search) or id::text = trim(p_search)
      or strpos(lower(target_type), lower(trim(p_search))) > 0
      or strpos(lower(action), lower(trim(p_search))) > 0
  ), page_rows as (
    select * from filtered order by created_at desc, source, id limit 25 offset p_page * 25
  )
  select jsonb_build_object('page', p_page, 'page_size', 25, 'total', (select count(*) from filtered),
    'events', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, source, id) from page_rows p), '[]'::jsonb))
    into result;
  return result;
end;
$$;
revoke all on function public.moderate_admin_listing(uuid, text, text, integer) from public, anon;
grant execute on function public.moderate_admin_listing(uuid, text, text, integer) to authenticated, service_role;

create or replace function public.get_admin_listings(
  p_search text default '', p_status text default '', p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or p_search is null or char_length(p_search) > 100
    or p_status is null or p_status not in ('', 'draft', 'active', 'reserved', 'sold', 'removed') then
    raise exception 'Invalid listing directory parameters' using errcode = '22023';
  end if;
  with filtered as (
    select l.id, l.title, l.seller_id, p.display_name as seller_name, l.status,
      l.price_minor, l.created_at, l.moderation_hidden, l.moderation_version
    from public.listings l join public.profiles p on p.id = l.seller_id
    where l.market_country_code = 'FI' and l.currency = 'EUR'
      and (p_status = '' or l.status::text = p_status)
      and (strpos(lower(l.title), lower(trim(p_search))) > 0
        or l.id::text = lower(trim(p_search)) or l.seller_id::text = lower(trim(p_search)))
  ), page_rows as (
    select * from filtered order by created_at desc, id asc limit 25 offset p_page * 25
  )
  select jsonb_build_object('market', 'FI', 'currency', 'EUR', 'page', p_page, 'page_size', 25,
    'total', (select count(*) from filtered),
    'listings', coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id asc) from page_rows), '[]'::jsonb))
    into result;
  return result;
end;
$$;
