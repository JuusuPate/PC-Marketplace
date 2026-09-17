-- A bounded, read-only user directory. Existing table permissions remain intact.
create or replace function public.get_admin_users(p_search text default '', p_page integer default 0)
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
  if p_page is null or p_page < 0 or p_page > 1000000 or p_search is null or char_length(p_search) > 100 then
    raise exception 'Invalid user directory parameters' using errcode = '22023';
  end if;

  with filtered as (
    select p.id, p.display_name, p.locale, p.joined_at,
      case when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin')
        then 'admin' else 'user' end as role
    from public.profiles p
    where p.country_code = 'FI'
      and (strpos(lower(p.display_name), lower(trim(p_search))) > 0 or p.id::text = trim(p_search))
  ), page_rows as (
    select * from filtered order by joined_at desc, id asc limit 25 offset p_page * 25
  )
  select jsonb_build_object(
    'market', 'FI', 'page', p_page, 'page_size', 25,
    'total', (select count(*) from filtered),
    'users', coalesce((select jsonb_agg(to_jsonb(page_rows) order by joined_at desc, id asc) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.get_admin_users(text, integer) from public, anon;
grant execute on function public.get_admin_users(text, integer) to authenticated, service_role;
