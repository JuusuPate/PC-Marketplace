-- Public storefront: reveal only IDs of active, published FI/EUR listings.
-- The role table remains private. A display name or Auth metadata cannot opt in.
-- SECURITY DEFINER is necessary for this narrowly scoped protected-role lookup.
create function public.get_rigi_listing_ids(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;
  return query
    select l.id from public.listings l
    join public.profiles p on p.id = l.seller_id
    where l.status = 'active' and l.published_at is not null
      and l.market_country_code = 'FI' and l.currency = 'EUR' and p.country_code = 'FI'
      and exists (select 1 from public.listing_shipping_countries s where s.listing_id = l.id and s.country_code = 'FI')
      and exists (select 1 from public.user_roles r where r.user_id = l.seller_id and r.role = 'admin')
    order by l.published_at desc, l.id asc
    limit p_limit offset p_offset;
end;
$$;
revoke all on function public.get_rigi_listing_ids(integer, integer) from public, anon, authenticated;
grant execute on function public.get_rigi_listing_ids(integer, integer) to anon, authenticated;
