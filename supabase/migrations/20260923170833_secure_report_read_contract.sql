-- Reconcile databases where report submission was installed before the
-- private report-list RPC. Browser roles must not read report bodies directly.
revoke select on table public.reports from authenticated;
drop policy if exists "users read their own reports" on public.reports;

create or replace function public.get_my_reported_listing_ids()
returns table (listing_id uuid)
language sql
security definer
set search_path = ''
as $$
  select report.listing_id
  from public.reports as report
  where report.reporter_id = (select auth.uid());
$$;

revoke execute on function public.get_my_reported_listing_ids() from public, anon;
grant execute on function public.get_my_reported_listing_ids() to authenticated, service_role;
