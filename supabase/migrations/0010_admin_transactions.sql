-- Read-only order directory. Payment operations and table grants are unchanged.
create or replace function public.get_admin_transactions(
  p_search text default '', p_status text default '', p_page integer default 0
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
    or p_status is null or p_status not in ('', 'pending_payment', 'paid', 'shipped', 'delivered', 'inspection', 'disputed', 'completed', 'refunded', 'cancelled') then
    raise exception 'Invalid transaction directory parameters' using errcode = '22023';
  end if;
  with filtered as (
    select o.id, o.listing_id, l.title, o.buyer_id, b.display_name as buyer_name,
      o.seller_id, s.display_name as seller_name, o.status, o.item_price_minor,
      o.marketplace_fee_minor, o.payment_processing_minor, o.shipping_minor, o.total_minor, o.created_at
    from public.orders o
    join public.listings l on l.id = o.listing_id
    join public.profiles b on b.id = o.buyer_id
    join public.profiles s on s.id = o.seller_id
    where o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
      and o.currency = 'EUR' and l.market_country_code = 'FI'
      and (p_status = '' or o.status::text = p_status)
      and (strpos(lower(l.title), lower(trim(p_search))) > 0
        or o.id::text = lower(trim(p_search)) or o.listing_id::text = lower(trim(p_search))
        or o.buyer_id::text = lower(trim(p_search)) or o.seller_id::text = lower(trim(p_search)))
  ), page_rows as (
    select * from filtered order by created_at desc, id asc limit 25 offset p_page * 25
  )
  select jsonb_build_object(
    'market', 'FI', 'currency', 'EUR', 'page', p_page, 'page_size', 25,
    'total', (select count(*) from filtered),
    'transactions', coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id asc) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.get_admin_transactions(text, text, integer) from public, anon;
grant execute on function public.get_admin_transactions(text, text, integer) to authenticated, service_role;
