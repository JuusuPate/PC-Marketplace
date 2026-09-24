create function public.get_admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'User ID required' using errcode = '22023'; end if;
  if not exists(select 1 from public.profiles where id = p_user_id and country_code = 'FI') then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  with user_orders as (
    select o.id, o.status, o.created_at, o.item_price_minor,
      case when o.seller_id = p_user_id then 'sale' else 'purchase' end as direction
    from public.orders o join public.listings l on l.id = o.listing_id
    where (o.seller_id = p_user_id or o.buyer_id = p_user_id) and o.currency = 'EUR'
      and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI' and l.market_country_code = 'FI'
  ), recent as (select * from user_orders order by created_at desc, id limit 25)
  select jsonb_build_object('id', p_user_id, 'market', 'FI', 'currency', 'EUR',
    'email', (select email from auth.users where id = p_user_id),
    'listings', (select count(*) from public.listings where seller_id = p_user_id and market_country_code = 'FI' and currency = 'EUR'),
    'sales', (select count(*) from user_orders where direction = 'sale' and status = 'completed'),
    'purchases', (select count(*) from user_orders where direction = 'purchase' and status = 'completed'),
    'disputes', (select count(*) from user_orders where status = 'disputed'),
    'orders_total', (select count(*) from user_orders),
    'orders', coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc, id) from recent r), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_user_detail(uuid) from public, anon;
grant execute on function public.get_admin_user_detail(uuid) to authenticated, service_role;

create function public.get_admin_order_detail(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_order_id is null then raise exception 'Order ID required' using errcode = '22023'; end if;
  select jsonb_build_object('id', o.id, 'market', 'FI', 'currency', 'EUR', 'status', o.status,
    'payment_provider', o.payment_provider, 'payment_reference', o.payment_reference,
    'inspection_deadline', o.inspection_deadline,
    'shipment', case when s.id is null then null else jsonb_build_object('carrier', s.carrier,
      'tracking_code', s.tracking_code, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at) end)
    into result
  from public.orders o join public.listings l on l.id = o.listing_id
  left join public.shipments s on s.order_id = o.id
  where o.id = p_order_id and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
    and o.currency = 'EUR' and l.market_country_code = 'FI';
  if result is null then raise exception 'Order not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;
revoke all on function public.get_admin_order_detail(uuid) from public, anon;
grant execute on function public.get_admin_order_detail(uuid) to authenticated, service_role;
