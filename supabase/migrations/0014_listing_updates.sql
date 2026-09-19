-- Owners can update the public details and private pickup address of their active listing.

create or replace function public.update_listing_details(
  p_listing_id uuid,
  p_market_country_code text,
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_minor bigint,
  p_currency text,
  p_city text,
  p_specs jsonb,
  p_pickup_address jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_currency text;
  pickup_street text;
  pickup_postal_code text;
  pickup_city text;
  pickup_country_code text;
  changed_rows integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select market.currency into expected_currency
  from public.markets as market
  where market.country_code = upper(p_market_country_code) and market.status = 'live';

  if expected_currency is null then
    raise exception 'Unsupported market';
  end if;
  if upper(p_currency) <> expected_currency then
    raise exception 'Listing currency does not match market';
  end if;
  if char_length(trim(p_title)) < 5 or char_length(trim(p_title)) > 100 then
    raise exception 'Title must contain 5 to 100 characters';
  end if;
  if char_length(trim(p_description)) < 20 or char_length(trim(p_description)) > 4000 then
    raise exception 'Description must contain 20 to 4000 characters';
  end if;
  if char_length(trim(p_city)) < 2 or char_length(trim(p_city)) > 120 then
    raise exception 'City must contain 2 to 120 characters';
  end if;
  if p_price_minor <= 0 then
    raise exception 'Price must be greater than zero';
  end if;
  if pg_column_size(coalesce(p_specs, '{}'::jsonb)) > 16384 then
    raise exception 'Specifications are too large';
  end if;

  if p_pickup_address is not null then
    if jsonb_typeof(p_pickup_address) <> 'object' then
      raise exception 'Pickup address must be an object';
    end if;
    pickup_street := trim(coalesce(p_pickup_address ->> 'street_address', ''));
    pickup_postal_code := trim(coalesce(p_pickup_address ->> 'postal_code', ''));
    pickup_city := trim(coalesce(p_pickup_address ->> 'city', ''));
    pickup_country_code := upper(trim(coalesce(p_pickup_address ->> 'country_code', 'FI')));

    if char_length(pickup_street) < 3 or char_length(pickup_street) > 160 then
      raise exception 'Pickup street address must contain 3 to 160 characters';
    end if;
    if pickup_postal_code !~ '^[0-9]{5}$' then
      raise exception 'Pickup postal code must contain five digits';
    end if;
    if char_length(pickup_city) < 2 or char_length(pickup_city) > 120 then
      raise exception 'Pickup city must contain 2 to 120 characters';
    end if;
    if pickup_country_code <> 'FI' then
      raise exception 'Only pickup addresses in Finland are enabled';
    end if;
  end if;

  update public.listings
  set market_country_code = upper(p_market_country_code),
      title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      condition = p_condition,
      price_minor = p_price_minor,
      currency = upper(p_currency),
      city = trim(p_city),
      specs = coalesce(p_specs, '{}'::jsonb)
  where id = p_listing_id
    and seller_id = (select auth.uid())
    and status = 'active';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Editable listing not found';
  end if;

  if p_pickup_address is not null then
    insert into public.listing_pickup_addresses (
      listing_id,
      street_address,
      postal_code,
      city,
      country_code
    ) values (
      p_listing_id,
      pickup_street,
      pickup_postal_code,
      pickup_city,
      pickup_country_code
    )
    on conflict (listing_id) do update
    set street_address = excluded.street_address,
        postal_code = excluded.postal_code,
        city = excluded.city,
        country_code = excluded.country_code;
  end if;
end;
$$;

revoke execute on function public.update_listing_details(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_listing_details(uuid, text, text, text, text, text, bigint, text, text, jsonb, jsonb)
  to authenticated, service_role;
