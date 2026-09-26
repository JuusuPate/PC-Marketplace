-- Cumulative registrations of currently retained FI profiles, including the baseline.
-- Calendar-day trends and period-scoped category samples for FI/EUR admins.
-- Completed orders are grouped by creation day and their current status.
create or replace function public.get_admin_dashboard_trends(p_days integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
declare first_day date;
declare last_day date;
declare first_at timestamptz;
declare after_last_at timestamptz;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30, 90, 180, 365) then
    raise exception 'Invalid dashboard period' using errcode = '22023';
  end if;

  last_day := (now() at time zone 'Europe/Helsinki')::date;
  first_day := last_day - (p_days - 1);
  first_at := first_day::timestamp at time zone 'Europe/Helsinki';
  -- The current calendar day is partial; future-dated records are not activity.
  after_last_at := now();

  with calendar as (
    select day::date as day from generate_series(first_day, last_day, interval '1 day') as day
  ), users_by_day as (
    select (p.joined_at at time zone 'Europe/Helsinki')::date as day, count(*) as users_new
    from public.profiles p
    where p.country_code = 'FI' and p.joined_at >= first_at and p.joined_at < after_last_at
    group by 1
  ), listings_by_day as (
    select (l.created_at at time zone 'Europe/Helsinki')::date as day, count(*) as listings_new
    from public.listings l
    where l.market_country_code = 'FI' and l.currency = 'EUR'
      and l.created_at >= first_at and l.created_at < after_last_at
    group by 1
  ), orders_by_day as (
    select (o.created_at at time zone 'Europe/Helsinki')::date as day,
      count(*) as orders_new,
      count(*) filter (where o.status = 'completed') as orders_completed,
      coalesce(sum(o.item_price_minor) filter (where o.status = 'completed'), 0) as item_value_minor,
      coalesce(sum(o.marketplace_fee_minor) filter (where o.status = 'completed'), 0) as fees_minor
    from public.orders o join public.listings l on l.id = o.listing_id
    where o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
      and o.currency = 'EUR' and l.market_country_code = 'FI'
      and o.created_at >= first_at and o.created_at < after_last_at
    group by 1
  ), reports_by_day as (
    select (r.created_at at time zone 'Europe/Helsinki')::date as day, count(*) as reports_new
    from public.reports r join public.listings l on l.id = r.listing_id
    where l.market_country_code = 'FI' and r.created_at >= first_at and r.created_at < after_last_at
    group by 1
  ), series as (
    select c.day,
      coalesce(u.users_new, 0) as users_new,
      (select count(*) from public.profiles p where p.country_code = 'FI' and p.joined_at < first_at)
        + sum(coalesce(u.users_new, 0)) over (order by c.day) as users_total,
      coalesce(l.listings_new, 0) as listings_new,
      coalesce(o.orders_new, 0) as orders_new,
      coalesce(o.orders_completed, 0) as orders_completed,
      coalesce(o.item_value_minor, 0) as item_value_minor,
      coalesce(o.fees_minor, 0) as fees_minor,
      coalesce(r.reports_new, 0) as reports_new
    from calendar c
    left join users_by_day u using (day)
    left join listings_by_day l using (day)
    left join orders_by_day o using (day)
    left join reports_by_day r using (day)
  ), asking as (
    select l.category, count(*) as active_listings, round(avg(l.price_minor)) as asking_average_minor
    from public.listings l
    where l.market_country_code = 'FI' and l.currency = 'EUR' and l.status = 'active'
      and l.created_at >= first_at and l.created_at < after_last_at
    group by l.category
  ), sales as (
    select l.category, count(*) as completed_orders, round(avg(o.item_price_minor)) as sold_average_minor
    from public.orders o join public.listings l on l.id = o.listing_id
    where o.status = 'completed' and o.currency = 'EUR'
      and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
      and l.market_country_code = 'FI'
      and o.created_at >= first_at and o.created_at < after_last_at
    group by l.category
  ), categories as (
    select c.slug, c.labels,
      coalesce(a.active_listings, 0) as active_listings, a.asking_average_minor,
      coalesce(s.completed_orders, 0) as completed_orders, s.sold_average_minor
    from public.catalog_categories c
    left join public.catalog_market_categories m on m.category_id = c.id and m.market_country_code = 'FI'
    left join asking a on a.category = c.slug
    left join sales s on s.category = c.slug
    where (c.is_sellable and c.is_active and m.is_enabled)
      or a.category is not null or s.category is not null
  )
  select jsonb_build_object(
    'market', 'FI', 'currency', 'EUR', 'timezone', 'Europe/Helsinki',
    'days', p_days, 'start_date', first_day, 'end_date', last_day, 'generated_at', now(),
    'buckets', coalesce((select jsonb_agg(to_jsonb(series) order by day) from series), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(categories) order by slug) from categories), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_dashboard_trends(integer) from public, anon;
grant execute on function public.get_admin_dashboard_trends(integer) to authenticated, service_role;

-- Prices use only linked, currently completed FI/EUR orders, by order creation day.
-- Empty days have a null price. Period means are weighted by individual orders.
create function public.get_admin_model_price_trends(p_model_id uuid, p_days integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  first_day date;
  last_day date;
  first_at timestamptz;
  previous_at timestamptz;
  result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30, 90, 180, 365)
    or p_model_id is null or not exists (select 1 from public.catalog_product_models where id = p_model_id) then
    raise exception 'Invalid model or period' using errcode = '22023';
  end if;
  last_day := (now() at time zone 'Europe/Helsinki')::date;
  first_day := last_day - (p_days - 1);
  first_at := first_day::timestamp at time zone 'Europe/Helsinki';
  previous_at := (first_day - p_days)::timestamp at time zone 'Europe/Helsinki';
  with sales as (
    select o.created_at, o.item_price_minor
    from public.orders o join public.listings l on l.id = o.listing_id
    where l.catalog_model_id = p_model_id and l.market_country_code = 'FI' and l.currency = 'EUR'
      and o.currency = 'EUR' and o.buyer_country_code = 'FI' and o.seller_country_code = 'FI'
      and o.status = 'completed' and o.created_at >= previous_at and o.created_at < now()
  ), daily as (
    select (created_at at time zone 'Europe/Helsinki')::date as day,
      count(*) as sales_count, sum(item_price_minor) as value_minor, round(avg(item_price_minor)) as average_minor
    from sales where created_at >= first_at group by 1
  ), series as (
    select c.day::date as day, coalesce(d.sales_count, 0) as sales_count,
      coalesce(d.value_minor, 0) as value_minor, d.average_minor
    from generate_series(first_day, last_day, interval '1 day') c(day)
    left join daily d on d.day = c.day::date
  ), current_period as (
    select count(*) as sales_count, coalesce(sum(item_price_minor), 0) as value_minor,
      round(avg(item_price_minor)) as average_minor from sales where created_at >= first_at
  ), previous_period as (
    select count(*) as sales_count, coalesce(sum(item_price_minor), 0) as value_minor,
      round(avg(item_price_minor)) as average_minor from sales where created_at < first_at
  )
  select jsonb_build_object(
    'model_id', p_model_id, 'market', 'FI', 'currency', 'EUR', 'timezone', 'Europe/Helsinki',
    'days', p_days, 'start_date', first_day, 'end_date', last_day, 'generated_at', now(),
    'previous_start_date', first_day - p_days, 'previous_end_date', first_day - 1,
    'current', (select to_jsonb(current_period) from current_period),
    'previous', (select to_jsonb(previous_period) from previous_period),
    'buckets', (select jsonb_agg(to_jsonb(series) order by day) from series)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_model_price_trends(uuid, integer) from public, anon;
grant execute on function public.get_admin_model_price_trends(uuid, integer) to authenticated, service_role;
