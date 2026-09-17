-- Admin-only aggregates. Keep raw user, order and report rows behind their existing RLS.
create or replace function public.get_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  overview jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  with user_metrics as (
    select
      count(*) as total,
      count(*) filter (where joined_at >= now() - interval '7 days') as new_last_7_days
    from public.profiles
    where country_code = 'FI'
  ), listing_metrics as (
    select
      count(*) as total,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'draft') as draft,
      count(*) filter (where status = 'reserved') as reserved,
      count(*) filter (where status = 'sold') as sold,
      count(*) filter (where status = 'removed') as removed
    from public.listings
    where market_country_code = 'FI' and currency = 'EUR'
  ), order_metrics as (
    select
      count(*) as total,
      count(*) filter (where marketplace_order.status = 'completed') as completed,
      count(*) filter (where marketplace_order.status = 'disputed') as disputed,
      coalesce(sum(marketplace_order.item_price_minor) filter (where marketplace_order.status = 'completed'), 0)
        as completed_item_value_minor,
      coalesce(sum(marketplace_order.marketplace_fee_minor) filter (where marketplace_order.status = 'completed'), 0)
        as completed_fees_minor
    from public.orders as marketplace_order
    join public.listings as listing on listing.id = marketplace_order.listing_id
    where marketplace_order.buyer_country_code = 'FI'
      and marketplace_order.seller_country_code = 'FI'
      and marketplace_order.currency = 'EUR'
      and listing.market_country_code = 'FI'
  ), report_metrics as (
    select count(*) as unresolved
    from public.reports as report
    join public.listings as listing on listing.id = report.listing_id
    where report.resolved_at is null and listing.market_country_code = 'FI'
  )
  select jsonb_build_object(
    'generated_at', now(),
    'market', 'FI',
    'currency', 'EUR',
    'users', (select to_jsonb(user_metrics) from user_metrics),
    'listings', (select to_jsonb(listing_metrics) from listing_metrics),
    'orders', (select to_jsonb(order_metrics) from order_metrics),
    'reports', (select to_jsonb(report_metrics) from report_metrics)
  ) into overview;

  return overview;
end;
$$;

revoke execute on function public.get_admin_overview() from public, anon;
grant execute on function public.get_admin_overview() to authenticated, service_role;

comment on function public.get_admin_overview() is
  'FI/EUR Overview for authenticated admins. Amounts use minor units and completed orders only; no personal data or browser demo orders.';
