-- Separate listing and order aggregates avoid multiplying either sample.
create or replace function public.get_admin_market_data()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  with asking as (
    select category, count(*) as active_listings, round(avg(price_minor)) as asking_average_minor
    from public.listings
    where market_country_code = 'FI' and currency = 'EUR' and status = 'active'
    group by category
  ), sales as (
    select l.category, count(*) as completed_orders, round(avg(o.item_price_minor)) as sold_average_minor
    from public.orders o join public.listings l on l.id = o.listing_id
    where o.status = 'completed' and o.currency = 'EUR'
      and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI' and l.market_country_code = 'FI'
    group by l.category
  ), categories as (
    select c.slug, c.labels,
      coalesce(a.active_listings, 0) as active_listings, a.asking_average_minor,
      coalesce(s.completed_orders, 0) as completed_orders, s.sold_average_minor
    from public.catalog_categories c
    left join public.catalog_market_categories m on m.category_id = c.id and m.market_country_code = 'FI'
    left join asking a on a.category = c.slug
    left join sales s on s.category = c.slug
    where (c.is_sellable and c.is_active and m.is_enabled) or a.category is not null or s.category is not null
  )
  select jsonb_build_object('market', 'FI', 'currency', 'EUR', 'period', 'all_time', 'generated_at', now(),
    'categories', coalesce((select jsonb_agg(to_jsonb(categories) order by slug) from categories), '[]'::jsonb))
  into result;
  return result;
end;
$$;
revoke execute on function public.get_admin_market_data() from public, anon;
grant execute on function public.get_admin_market_data() to authenticated, service_role;
