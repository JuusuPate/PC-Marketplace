-- Audited report decisions; no listing or payment state is changed.
alter table public.reports add column review_version integer not null default 0 check (review_version >= 0);

create table public.report_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action in ('resolve', 'reopen')),
  note text not null check (char_length(trim(note)) between 10 and 2000),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique(report_id, version)
);
-- actor_id is an immutable identifier, retained if the Auth account is deleted.
alter table public.report_decisions enable row level security;
revoke all on public.report_decisions from public, anon, authenticated;
grant select on public.report_decisions to service_role;

create function public.review_admin_report(p_report_id uuid, p_action text, p_note text, p_expected_version integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_report public.reports%rowtype;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_report_id is null or p_action is null or p_action not in ('resolve','reopen')
    or p_note is null or char_length(trim(p_note)) not between 10 and 2000
    or p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid report decision' using errcode = '22023';
  end if;
  select r.* into current_report from public.reports r
  join public.listings l on l.id = r.listing_id
  where r.id = p_report_id and l.market_country_code = 'FI' and l.currency = 'EUR'
  for update of r;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if current_report.review_version <> p_expected_version
    or (p_action = 'resolve' and current_report.resolved_at is not null)
    or (p_action = 'reopen' and current_report.resolved_at is null) then
    raise exception 'Report changed; refresh before deciding' using errcode = '40001';
  end if;
  insert into public.report_decisions(report_id, actor_id, action, note, version)
  values(p_report_id, (select auth.uid()), p_action, trim(p_note), current_report.review_version + 1);
  update public.reports set
    resolved_at = case when p_action = 'resolve' then now() else null end,
    review_version = review_version + 1
  where id = p_report_id;
end;
$$;
revoke execute on function public.review_admin_report(uuid,text,text,integer) from public, anon;
grant execute on function public.review_admin_report(uuid,text,text,integer) to authenticated, service_role;

create or replace function public.get_admin_reports(
  p_search text default '', p_status text default 'open', p_page integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000
    or p_search is null or char_length(p_search) > 100
    or p_status is null or p_status not in ('', 'open', 'resolved') then
    raise exception 'Invalid report directory parameters' using errcode = '22023';
  end if;

  with filtered as (
    select r.id, r.reporter_id, reporter.display_name as reporter_name,
      r.listing_id, l.title as listing_title, l.status as listing_status,
      l.seller_id, seller.display_name as seller_name,
      r.reason, r.details, r.created_at, r.resolved_at, r.review_version,
      (select jsonb_build_object('actor_id', d.actor_id, 'action', d.action, 'note', d.note, 'created_at', d.created_at)
       from public.report_decisions d where d.report_id=r.id and d.version=r.review_version) as last_decision
    from public.reports r
    join public.listings l on l.id = r.listing_id
    join public.profiles reporter on reporter.id = r.reporter_id
    join public.profiles seller on seller.id = l.seller_id
    where l.market_country_code = 'FI' and l.currency = 'EUR'
      and (p_status = '' or (p_status = 'open' and r.resolved_at is null)
        or (p_status = 'resolved' and r.resolved_at is not null))
      and (strpos(lower(l.title), lower(trim(p_search))) > 0
        or r.id::text = lower(trim(p_search))
        or r.listing_id::text = lower(trim(p_search))
        or r.reporter_id::text = lower(trim(p_search)))
  ), page_rows as (
    select * from filtered order by created_at desc, id asc limit 25 offset p_page * 25
  )
  select jsonb_build_object(
    'market', 'FI', 'page', p_page, 'page_size', 25,
    'total', (select count(*) from filtered),
    'reports', coalesce(
      (select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id asc) from page_rows),
      '[]'::jsonb
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.get_admin_reports(text, text, integer) from public, anon;
grant execute on function public.get_admin_reports(text, text, integer) to authenticated, service_role;
