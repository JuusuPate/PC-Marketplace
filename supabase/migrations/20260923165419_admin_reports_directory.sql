-- Read-only moderation queue. Report bodies stay inaccessible through table grants.
create index if not exists reports_review_queue_idx
  on public.reports (resolved_at, created_at desc, id);

create function public.get_admin_reports(
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
      r.reason, r.details, r.created_at, r.resolved_at
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
