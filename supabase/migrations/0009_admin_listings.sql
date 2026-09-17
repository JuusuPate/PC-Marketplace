-- Read-only listing directory. No new table grants or moderation permissions.
create or replace function public.get_admin_listings(
  p_search text default '', p_status text default '', p_page integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000
    or p_search is null or char_length(p_search) > 100
    or p_status is null or p_status not in ('', 'draft', 'active', 'reserved', 'sold', 'removed') then
    raise exception 'Invalid listing directory parameters' using errcode = '22023';
  end if;

  with filtered as (
    select l.id, l.title, l.seller_id, p.display_name as seller_name,
      l.status, l.price_minor, l.created_at
    from public.listings l
    join public.profiles p on p.id = l.seller_id
    where l.market_country_code = 'FI' and l.currency = 'EUR'
      and (p_status = '' or l.status::text = p_status)
      and (strpos(lower(l.title), lower(trim(p_search))) > 0
        or l.id::text = lower(trim(p_search)) or l.seller_id::text = lower(trim(p_search)))
  ), page_rows as (
    select * from filtered order by created_at desc, id asc limit 25 offset p_page * 25
  )
  select jsonb_build_object(
    'market', 'FI', 'currency', 'EUR', 'page', p_page, 'page_size', 25,
    'total', (select count(*) from filtered),
    'listings', coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id asc) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.get_admin_listings(text, text, integer) from public, anon;
grant execute on function public.get_admin_listings(text, text, integer) to authenticated, service_role;
