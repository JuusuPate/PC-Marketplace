-- A restoration may be recorded without a written reason; hiding still requires one.
alter table public.listing_moderation_decisions
  alter column reason drop not null,
  drop constraint listing_moderation_decisions_reason_check,
  add constraint listing_moderation_decisions_reason_check
    check (
      (action = 'hide' and reason is not null and char_length(trim(reason)) between 10 and 2000)
      or (action = 'restore' and (reason is null or char_length(trim(reason)) between 1 and 2000))
    );

create or replace function public.moderate_admin_listing(
  p_listing_id uuid, p_action text, p_reason text, p_expected_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_listing public.listings%rowtype;
  clean_reason text := nullif(trim(p_reason), '');
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_listing_id is null or p_action is null or p_action not in ('hide', 'restore')
    or (p_action = 'hide' and (clean_reason is null or char_length(clean_reason) not between 10 and 2000))
    or (p_action = 'restore' and clean_reason is not null and char_length(clean_reason) > 2000)
    or p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid moderation decision' using errcode = '22023';
  end if;
  select l.* into current_listing from public.listings l
  where l.id = p_listing_id and l.market_country_code = 'FI' and l.currency = 'EUR'
  for update;
  if not found then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  if current_listing.moderation_version <> p_expected_version
    or (p_action = 'hide' and current_listing.status <> 'active')
    or (p_action = 'restore' and (current_listing.status <> 'removed' or not current_listing.moderation_hidden)) then
    raise exception 'Listing changed; refresh before deciding' using errcode = '40001';
  end if;
  if p_action = 'hide' and exists (
    select 1 from public.orders o where o.listing_id = p_listing_id
      and o.status not in ('cancelled', 'refunded')
  ) then
    raise exception 'Listing has an active order' using errcode = '23514';
  end if;
  update public.listings set
    status = case when p_action = 'hide' then 'removed'::public.listing_status else 'active'::public.listing_status end,
    moderation_hidden = (p_action = 'hide'),
    moderation_version = moderation_version + 1
  where id = p_listing_id;
  insert into public.listing_moderation_decisions(listing_id, actor_id, action, reason, version)
  values(p_listing_id, (select auth.uid()), p_action, clean_reason, current_listing.moderation_version + 1);
end;
$$;

revoke all on function public.moderate_admin_listing(uuid, text, text, integer) from public, anon;
grant execute on function public.moderate_admin_listing(uuid, text, text, integer) to authenticated, service_role;
