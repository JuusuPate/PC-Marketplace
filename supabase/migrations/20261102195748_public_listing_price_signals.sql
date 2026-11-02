-- Public, read-only classification, never private order rows or sale amounts.
-- No identity check: guests intentionally receive the same badge as signed-in buyers.
-- Orders are server-owned. Only completed Stripe payments with a reference qualify;
-- demo/manual/test orders, asking prices and client-side demo purchases never qualify.
create function public.get_listing_price_signals(p_listing_ids uuid[])
returns table(id uuid, price_minor bigint, catalog_model_id uuid, condition text, price_signal text)
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s'
as $$
begin
  if p_listing_ids is null or cardinality(p_listing_ids) > 200
    or array_position(p_listing_ids, null) is not null then
    raise exception 'Invalid listing batch' using errcode = '22023';
  end if;
  return query
  with targets as (
    select l.* from public.listings l
    where l.id = any(p_listing_ids) and l.status = 'active' and not l.moderation_hidden
      and l.market_country_code = 'FI' and l.currency = 'EUR'
      and l.catalog_model_id is not null and l.category not in ('pc', 'other')
  ), samples as (
    select t.id, percentile_disc(0.5) within group (order by o.item_price_minor) as median_minor
    from targets t
    join public.listings sold on sold.catalog_model_id = t.catalog_model_id
      and sold.category = t.category and sold.condition = t.condition
      and sold.status = 'sold' and not sold.moderation_hidden
      and sold.market_country_code = 'FI' and sold.currency = 'EUR'
      and sold.seller_id <> t.seller_id
    join public.orders o on o.listing_id = sold.id and o.seller_id = sold.seller_id
      and o.status = 'completed' and o.currency = 'EUR'
      and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
      and o.payment_provider = 'stripe' and nullif(btrim(o.payment_reference), '') is not null
      and o.created_at >= now() - interval '90 days' and o.created_at <= now()
    group by t.id
    having count(*) >= 5 and count(distinct o.seller_id) >= 3
  )
  select t.id, t.price_minor, t.catalog_model_id, t.condition, 'fair'::text
  from targets t join samples s on s.id = t.id
  -- Also suppress unusually low outliers: a low price alone is not evidence of a fair offer.
  where t.price_minor::numeric between s.median_minor::numeric * 0.8 and s.median_minor::numeric * 1.1;
end;
$$;
revoke all on function public.get_listing_price_signals(uuid[]) from public;
grant execute on function public.get_listing_price_signals(uuid[]) to anon, authenticated, service_role;
