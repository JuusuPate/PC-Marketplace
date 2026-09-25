-- First Marketing slice: admin-edited, locale-specific home announcements.
-- Drafts and change history are never readable through direct browser table access.
create table public.marketing_announcements (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('fi', 'sv', 'en')),
  title text not null check (char_length(trim(title)) between 5 and 100),
  body text not null check (char_length(trim(body)) between 10 and 400),
  is_published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_announcements_public_idx
  on public.marketing_announcements (locale, updated_at desc) where is_published;
alter table public.marketing_announcements enable row level security;
revoke all on public.marketing_announcements from public, anon, authenticated;
grant select on public.marketing_announcements to service_role;

create table public.marketing_announcement_changes (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.marketing_announcements(id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action in ('create', 'update')),
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
create index marketing_announcement_changes_target_idx
  on public.marketing_announcement_changes (announcement_id, created_at desc);
alter table public.marketing_announcement_changes enable row level security;
revoke all on public.marketing_announcement_changes from public, anon, authenticated;
grant select on public.marketing_announcement_changes to service_role;

create function public.get_public_marketing_announcement(p_locale text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_locale is null or p_locale not in ('fi', 'sv', 'en') then
    raise exception 'Invalid locale' using errcode = '22023';
  end if;
  select jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body)
    into result
  from public.marketing_announcements a
  where a.locale = p_locale and a.is_published
  order by a.updated_at desc, a.id desc
  limit 1;
  return result;
end;
$$;
revoke all on function public.get_public_marketing_announcement(text) from public;
grant execute on function public.get_public_marketing_announcement(text) to anon, authenticated, service_role;

create function public.get_admin_marketing_announcements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'locale', a.locale, 'title', a.title, 'body', a.body,
      'is_published', a.is_published, 'version', a.version, 'updated_at', a.updated_at
    ) order by a.updated_at desc, a.id desc), '[]'::jsonb)
    into result
  from public.marketing_announcements a;
  return result;
end;
$$;
revoke all on function public.get_admin_marketing_announcements() from public, anon;
grant execute on function public.get_admin_marketing_announcements() to authenticated, service_role;

create function public.save_admin_marketing_announcement(
  p_id uuid, p_locale text, p_title text, p_body text,
  p_published boolean, p_expected_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_row public.marketing_announcements%rowtype;
  saved_row public.marketing_announcements%rowtype;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('fi', 'sv', 'en')
    or p_title is null or char_length(trim(p_title)) not between 5 and 100
    or p_body is null or char_length(trim(p_body)) not between 10 and 400
    or p_published is null
    or (p_id is null and p_expected_version is not null)
    or (p_id is not null and (p_expected_version is null or p_expected_version < 1)) then
    raise exception 'Invalid announcement' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.marketing_announcements
      (locale, title, body, is_published, created_by, updated_by)
    values (p_locale, trim(p_title), trim(p_body), p_published, (select auth.uid()), (select auth.uid()))
    returning * into saved_row;
    insert into public.marketing_announcement_changes
      (announcement_id, actor_id, action, before_data, after_data)
    values (saved_row.id, (select auth.uid()), 'create', null,
      jsonb_build_object('locale', saved_row.locale, 'title', saved_row.title,
        'body', saved_row.body, 'is_published', saved_row.is_published, 'version', saved_row.version));
    return;
  end if;
  select * into current_row from public.marketing_announcements where id = p_id for update;
  if not found then raise exception 'Announcement not found' using errcode = 'P0002'; end if;
  if current_row.version <> p_expected_version then
    raise exception 'Announcement changed; refresh before saving' using errcode = '40001';
  end if;
  update public.marketing_announcements
    set locale = p_locale, title = trim(p_title), body = trim(p_body),
      is_published = p_published, version = version + 1,
      updated_by = (select auth.uid()), updated_at = now()
    where id = p_id
    returning * into saved_row;
  insert into public.marketing_announcement_changes
    (announcement_id, actor_id, action, before_data, after_data)
  values (saved_row.id, (select auth.uid()), 'update',
    jsonb_build_object('locale', current_row.locale, 'title', current_row.title,
      'body', current_row.body, 'is_published', current_row.is_published, 'version', current_row.version),
    jsonb_build_object('locale', saved_row.locale, 'title', saved_row.title,
      'body', saved_row.body, 'is_published', saved_row.is_published, 'version', saved_row.version));
end;
$$;
revoke all on function public.save_admin_marketing_announcement(uuid, text, text, text, boolean, integer)
  from public, anon;
grant execute on function public.save_admin_marketing_announcement(uuid, text, text, text, boolean, integer)
  to authenticated, service_role;

-- Include campaign edits in the existing read-only admin audit feed.
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
