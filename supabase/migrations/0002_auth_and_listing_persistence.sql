-- Connect Supabase Auth to public profiles and expose the first safe browser writes.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_country text;
  selected_locale text;
  selected_currency text;
  selected_name text;
begin
  select market.country_code, market.default_locale, market.currency
    into selected_country, selected_locale, selected_currency
  from public.markets as market
  where market.country_code = upper(coalesce(new.raw_user_meta_data ->> 'country_code', 'FI'));

  if selected_country is null then
    select market.country_code, market.default_locale, market.currency
      into selected_country, selected_locale, selected_currency
    from public.markets as market
    where market.country_code = 'FI';
  end if;

  selected_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60);
  if char_length(selected_name) < 2 then
    selected_name := left(split_part(coalesce(new.email, 'PC Market user'), '@', 1), 60);
  end if;
  if char_length(selected_name) < 2 then
    selected_name := 'PC Market user';
  end if;

  if new.raw_user_meta_data ->> 'locale' in ('fi', 'sv', 'da', 'nb', 'en') then
    selected_locale := new.raw_user_meta_data ->> 'locale';
  end if;

  insert into public.profiles (id, display_name, country_code, locale, preferred_currency)
  values (new.id, selected_name, selected_country, selected_locale, selected_currency)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_markets_updated_at on public.markets;
create trigger set_markets_updated_at before update on public.markets
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at before update on public.listings
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();

-- Functions are executable by PUBLIC unless explicitly restricted.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.create_listing(
  p_market_country_code text,
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_minor bigint,
  p_currency text,
  p_city text,
  p_specs jsonb,
  p_shipping_country_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_listing_id uuid;
  expected_currency text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select market.currency into expected_currency
  from public.markets as market
  where market.country_code = upper(p_market_country_code);

  if expected_currency is null then
    raise exception 'Unsupported market';
  end if;
  if upper(p_currency) <> expected_currency then
    raise exception 'Listing currency does not match market';
  end if;
  if coalesce(cardinality(p_shipping_country_codes), 0) = 0 then
    raise exception 'At least one shipping country is required';
  end if;
  if char_length(trim(p_city)) < 2 or char_length(trim(p_city)) > 120 then
    raise exception 'City must contain 2 to 120 characters';
  end if;
  if pg_column_size(coalesce(p_specs, '{}'::jsonb)) > 16384 then
    raise exception 'Specifications are too large';
  end if;
  if exists (
    select 1
    from unnest(p_shipping_country_codes) as destination(country_code)
    left join public.markets as market on market.country_code = upper(destination.country_code)
    where market.country_code is null
  ) then
    raise exception 'Unsupported shipping country';
  end if;

  insert into public.listings (
    seller_id,
    market_country_code,
    title,
    description,
    category,
    condition,
    price_minor,
    currency,
    city,
    specs,
    status,
    published_at
  )
  values (
    (select auth.uid()),
    upper(p_market_country_code),
    trim(p_title),
    trim(p_description),
    p_category,
    p_condition,
    p_price_minor,
    upper(p_currency),
    trim(p_city),
    coalesce(p_specs, '{}'::jsonb),
    'active',
    now()
  )
  returning id into new_listing_id;

  insert into public.listing_shipping_countries (listing_id, country_code)
  select new_listing_id, upper(destination.country_code)
  from (
    select distinct country_code
    from unnest(p_shipping_country_codes) as shipping(country_code)
  ) as destination;

  return new_listing_id;
end;
$$;

revoke execute on function public.create_listing(text, text, text, text, text, bigint, text, text, jsonb, text[])
  from public, anon;
grant execute on function public.create_listing(text, text, text, text, text, bigint, text, text, jsonb, text[])
  to authenticated, service_role;

-- Grants and RLS must both allow an operation. Keep browser roles intentionally narrow.
revoke all on table public.markets from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.listings from anon, authenticated;
revoke all on table public.listing_shipping_countries from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.shipments from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
revoke all on table public.reports from anon, authenticated;

grant select on table public.markets, public.profiles, public.listings,
  public.listing_shipping_countries, public.reviews to anon, authenticated;
grant select on table public.orders, public.shipments to authenticated;
grant insert on table public.reports to authenticated;

grant all on table public.markets, public.profiles, public.listings,
  public.listing_shipping_countries, public.orders, public.shipments,
  public.reviews, public.reports to service_role;

drop policy if exists "markets are publicly readable" on public.markets;
create policy "markets are publicly readable" on public.markets for select
  to anon, authenticated using (true);

drop policy if exists "active listings are publicly readable" on public.listings;
create policy "active listings are publicly readable" on public.listings for select
  to anon, authenticated
  using (status = 'active' or seller_id = (select auth.uid()));

drop policy if exists "sellers create their listings" on public.listings;
create policy "sellers create their listings" on public.listings for insert
  to authenticated with check (seller_id = (select auth.uid()));

drop policy if exists "sellers update their listings" on public.listings;
create policy "sellers update their listings" on public.listings for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

drop policy if exists "shipping countries follow readable listings" on public.listing_shipping_countries;
create policy "shipping countries follow readable listings" on public.listing_shipping_countries for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.listings as listing
      where listing.id = listing_id
        and (listing.status = 'active' or listing.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "sellers manage listing destinations" on public.listing_shipping_countries;
create policy "sellers add listing destinations" on public.listing_shipping_countries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.listings as listing
      where listing.id = listing_id and listing.seller_id = (select auth.uid())
    )
  );
create policy "sellers remove listing destinations" on public.listing_shipping_countries for delete
  to authenticated
  using (
    exists (
      select 1 from public.listings as listing
      where listing.id = listing_id and listing.seller_id = (select auth.uid())
    )
  );

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles for select
  to anon, authenticated using (true);

drop policy if exists "users create their profile" on public.profiles;
drop policy if exists "users update their profile" on public.profiles;
create policy "users update their profile" on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "participants read orders" on public.orders;
create policy "participants read orders" on public.orders for select
  to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

drop policy if exists "participants read shipments" on public.shipments;
create policy "participants read shipments" on public.shipments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders as marketplace_order
      where marketplace_order.id = order_id
        and (
          marketplace_order.buyer_id = (select auth.uid())
          or marketplace_order.seller_id = (select auth.uid())
        )
    )
  );

drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable" on public.reviews for select
  to anon, authenticated using (true);

drop policy if exists "authenticated users create reports" on public.reports;
create policy "authenticated users create reports" on public.reports for insert
  to authenticated with check (reporter_id = (select auth.uid()));
