-- Read-only, FI/EUR admin activity. Ranges are [start, end); comparison has equal duration.
create function public.get_admin_activity(p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_start >= p_end or p_end - p_start > interval '366 days'
    or p_start < '2000-01-01'::timestamptz or p_end > now() + interval '5 minutes' then
    raise exception 'Invalid activity period' using errcode = '22023';
  end if;
  with periods as (
    select 'current' as period, p_start as start_at, p_end as end_at
    union all select 'previous', p_start - (p_end - p_start), p_start
  ), metrics as (
    select period, start_at, end_at,
      (select count(*) from public.profiles p where p.country_code = 'FI'
        and p.joined_at >= start_at and p.joined_at < end_at) as new_users,
      (select count(*) from public.listings l where l.market_country_code = 'FI' and l.currency = 'EUR'
        and l.created_at >= start_at and l.created_at < end_at) as new_listings,
      (select jsonb_build_object('total', count(*), 'completed', count(*) filter(where o.status = 'completed'),
        'value_minor', coalesce(sum(o.item_price_minor) filter(where o.status = 'completed'), 0),
        'fees_minor', coalesce(sum(o.marketplace_fee_minor) filter(where o.status = 'completed'), 0))
        from public.orders o join public.listings l on l.id = o.listing_id
        where o.buyer_country_code = 'FI' and o.seller_country_code = 'FI' and o.currency = 'EUR'
          and l.market_country_code = 'FI' and o.created_at >= start_at and o.created_at < end_at) as orders
    from periods
  )
  select jsonb_build_object('market', 'FI', 'currency', 'EUR', 'generated_at', now(),
    'current', (select to_jsonb(m) - 'period' from metrics m where period = 'current'),
    'previous', (select to_jsonb(m) - 'period' from metrics m where period = 'previous')) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_activity(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_admin_activity(timestamptz, timestamptz) to authenticated, service_role;

-- A unified view of existing evidence, not a claim that uninstrumented actions are logged.
create function public.get_admin_audit(p_search text default '', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_search is null or char_length(p_search) > 100 or p_page is null or p_page < 0 or p_page > 1000000 then
    raise exception 'Invalid audit query' using errcode = '22023';
  end if;
  with events as (
    select c.id, 'catalog' as source, c.entity_type as target_type, c.entity_id as target_id,
      c.action, c.changed_by as actor_id, c.created_at, null::text as reason,
      c.before_data, c.after_data
    from public.catalog_admin_changes c
    union all
    select d.id, 'report', 'report', d.report_id, d.action, d.actor_id, d.created_at, d.note,
      jsonb_build_object('resolved', d.action = 'reopen', 'version', d.version - 1),
      jsonb_build_object('resolved', d.action = 'resolve', 'version', d.version)
    from public.report_decisions d join public.reports r on r.id = d.report_id
    join public.listings l on l.id = r.listing_id where l.market_country_code = 'FI'
  ), filtered as (
    select * from events where trim(p_search) = '' or target_id::text = trim(p_search)
      or actor_id::text = trim(p_search) or id::text = trim(p_search)
      or strpos(lower(target_type), lower(trim(p_search))) > 0
      or strpos(lower(action), lower(trim(p_search))) > 0
  ), page_rows as (
    select * from filtered order by created_at desc, source, id limit 25 offset p_page * 25
  )
  select jsonb_build_object('page', p_page, 'page_size', 25, 'total', (select count(*) from filtered),
    'events', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, source, id) from page_rows p), '[]'::jsonb))
    into result;
  return result;
end;
$$;
revoke all on function public.get_admin_audit(text, integer) from public, anon;
grant execute on function public.get_admin_audit(text, integer) to authenticated, service_role;
