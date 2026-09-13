-- Keep the Nordic schema available, but enforce Finland as the only launch market.

update public.markets
set status = case when country_code = 'FI' then 'live'::public.market_status else 'disabled'::public.market_status end;

update public.profiles
set country_code = 'FI', preferred_currency = 'EUR'
where country_code <> 'FI' or preferred_currency <> 'EUR';

delete from public.listing_shipping_countries
where country_code <> 'FI';

update public.listings as listing
set status = 'draft', published_at = null
where listing.status = 'active'
  and (
    listing.market_country_code <> 'FI'
    or listing.currency <> 'EUR'
    or not exists (
      select 1
      from public.listing_shipping_countries as destination
      where destination.listing_id = listing.id and destination.country_code = 'FI'
    )
  );

create or replace function public.enforce_finland_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.country_code := 'FI';
  new.preferred_currency := 'EUR';
  return new;
end;
$$;

drop trigger if exists enforce_finland_profile on public.profiles;
create trigger enforce_finland_profile
  before insert or update of country_code, preferred_currency on public.profiles
  for each row execute procedure public.enforce_finland_profile();

create or replace function public.enforce_finland_listing_market()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('active', 'reserved', 'sold')
    and (new.market_country_code <> 'FI' or new.currency <> 'EUR') then
    raise exception 'Only Finland and EUR are enabled for published listings';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_finland_listing_market on public.listings;
create trigger enforce_finland_listing_market
  before insert or update of market_country_code, currency, status on public.listings
  for each row execute procedure public.enforce_finland_listing_market();

create or replace function public.enforce_finland_shipping_country()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.country_code <> 'FI' then
    raise exception 'Only shipping within Finland is enabled';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_finland_shipping_country on public.listing_shipping_countries;
create trigger enforce_finland_shipping_country
  before insert or update of country_code on public.listing_shipping_countries
  for each row execute procedure public.enforce_finland_shipping_country();

revoke execute on function public.enforce_finland_profile() from public, anon, authenticated;
revoke execute on function public.enforce_finland_listing_market() from public, anon, authenticated;
revoke execute on function public.enforce_finland_shipping_country() from public, anon, authenticated;
