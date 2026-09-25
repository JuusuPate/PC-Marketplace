-- A single server-enforced operational switch for new listing creation.
-- Existing active listings and moderation restores remain unaffected.
create table public.marketplace_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique check (setting_key = 'listing_creation_enabled'),
  enabled boolean not null,
  version integer not null default 1 check (version between 1 and 2147483647),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.marketplace_settings (setting_key, enabled)
values ('listing_creation_enabled', true);
alter table public.marketplace_settings enable row level security;
revoke all on public.marketplace_settings from public, anon, authenticated;
grant all on public.marketplace_settings to service_role;

create table public.marketplace_setting_changes (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.marketplace_settings(id),
  actor_id uuid not null,
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
create index marketplace_setting_changes_time_idx
  on public.marketplace_setting_changes (created_at desc, id);
alter table public.marketplace_setting_changes enable row level security;
revoke all on public.marketplace_setting_changes from public, anon, authenticated;
grant select on public.marketplace_setting_changes to service_role;

create function public.get_listing_creation_enabled()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare current_value boolean;
begin
  select s.enabled into current_value from public.marketplace_settings s
  where s.setting_key = 'listing_creation_enabled';
  if not found then raise exception 'Listing creation setting unavailable' using errcode = '55000'; end if;
  return current_value;
end;
$$;
revoke all on function public.get_listing_creation_enabled() from public;
grant execute on function public.get_listing_creation_enabled() to anon, authenticated, service_role;

create function public.get_admin_listing_creation_setting()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select jsonb_build_object('enabled', s.enabled, 'version', s.version,
    'updated_at', s.updated_at, 'updated_by', s.updated_by)
    into result from public.marketplace_settings s
    where s.setting_key = 'listing_creation_enabled';
  if not found then raise exception 'Listing creation setting unavailable' using errcode = '55000'; end if;
  return result;
end;
$$;
revoke all on function public.get_admin_listing_creation_setting() from public, anon;
grant execute on function public.get_admin_listing_creation_setting() to authenticated, service_role;

create function public.save_admin_listing_creation_setting(p_enabled boolean, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.marketplace_settings%rowtype;
declare saved_row public.marketplace_settings%rowtype;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_enabled is null or p_expected_version is null or p_expected_version < 1 then
    raise exception 'Invalid setting' using errcode = '22023';
  end if;
  select * into current_row from public.marketplace_settings
  where setting_key = 'listing_creation_enabled' for update;
  if not found then raise exception 'Listing creation setting unavailable' using errcode = '55000'; end if;
  if current_row.version <> p_expected_version then
    raise exception 'Setting changed; refresh before saving' using errcode = '40001';
  end if;
  if current_row.enabled = p_enabled then
    return jsonb_build_object('enabled', current_row.enabled, 'version', current_row.version,
      'updated_at', current_row.updated_at, 'updated_by', current_row.updated_by);
  end if;
  if current_row.version = 2147483647 then
    raise exception 'Setting version exhausted' using errcode = '22023';
  end if;
  update public.marketplace_settings
    set enabled = p_enabled, version = version + 1,
      updated_at = now(), updated_by = (select auth.uid())
    where id = current_row.id returning * into saved_row;
  insert into public.marketplace_setting_changes (setting_id, actor_id, before_data, after_data)
  values (saved_row.id, (select auth.uid()),
    jsonb_build_object('enabled', current_row.enabled, 'version', current_row.version),
    jsonb_build_object('enabled', saved_row.enabled, 'version', saved_row.version));
  return jsonb_build_object('enabled', saved_row.enabled, 'version', saved_row.version,
    'updated_at', saved_row.updated_at, 'updated_by', saved_row.updated_by);
end;
$$;
revoke all on function public.save_admin_listing_creation_setting(boolean, integer) from public, anon;
grant execute on function public.save_admin_listing_creation_setting(boolean, integer)
  to authenticated, service_role;

-- The trigger also covers an already-created draft that is published after a pause.
create function public.enforce_listing_creation_enabled()
returns trigger language plpgsql security definer set search_path = '' as $$
declare check_setting boolean := false;
declare current_value boolean;
begin
  if tg_op = 'INSERT' then
    check_setting := new.status = 'draft';
  elsif tg_op = 'UPDATE' then
    check_setting := old.status = 'draft' and new.status = 'active';
  end if;
  if check_setting then
    select s.enabled into current_value from public.marketplace_settings s
      where s.setting_key = 'listing_creation_enabled' for share;
    if not found or not current_value then
      raise exception 'Listing creation paused' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_listing_creation_enabled() from public, anon, authenticated;
create trigger enforce_listing_creation_enabled
  before insert or update of status on public.listings
  for each row execute function public.enforce_listing_creation_enabled();

-- Include setting changes in the existing immutable admin audit feed.
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
    union all
    select a.id, 'marketing', 'announcement', a.announcement_id, a.action, a.actor_id,
      a.created_at, null::text, a.before_data, a.after_data
    from public.marketing_announcement_changes a
    union all
    select s.id, 'settings', 'listing_creation', s.setting_id, 'update', s.actor_id,
      s.created_at, null::text, s.before_data, s.after_data
    from public.marketplace_setting_changes s
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
revoke all on function public.get_admin_audit(text, integer) from public, anon;
grant execute on function public.get_admin_audit(text, integer) to authenticated, service_role;
