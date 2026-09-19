-- Operational totals by order creation month, not accounting revenue recognition.
create or replace function public.get_admin_revenue(p_year integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Invalid revenue year' using errcode = '22023';
  end if;
  with eligible as (
    select extract(month from o.created_at at time zone 'Europe/Helsinki')::integer as month,
      o.item_price_minor, o.marketplace_fee_minor
    from public.orders o join public.listings l on l.id = o.listing_id
    where o.status = 'completed' and o.currency = 'EUR'
      and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI' and l.market_country_code = 'FI'
      and o.created_at >= (make_date(p_year, 1, 1)::timestamp at time zone 'Europe/Helsinki')
      and o.created_at < (make_date(p_year + 1, 1, 1)::timestamp at time zone 'Europe/Helsinki')
  ), monthly as (
    select m.month, count(e.month) as completed_orders,
      coalesce(sum(e.item_price_minor), 0) as item_value_minor,
      coalesce(sum(e.marketplace_fee_minor), 0) as fees_minor
    from generate_series(1, 12) as m(month) left join eligible e on e.month = m.month
    group by m.month
  )
  select jsonb_build_object(
    'market', 'FI', 'currency', 'EUR', 'year', p_year,
    'timezone', 'Europe/Helsinki', 'date_basis', 'order_created_at', 'generated_at', now(),
    'totals', (select jsonb_build_object('completed_orders', sum(completed_orders),
      'item_value_minor', sum(item_value_minor), 'fees_minor', sum(fees_minor)) from monthly),
    'months', (select jsonb_agg(to_jsonb(monthly) order by month) from monthly)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.get_admin_revenue(integer) from public, anon;
grant execute on function public.get_admin_revenue(integer) to authenticated, service_role;
