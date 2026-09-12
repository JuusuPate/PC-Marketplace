-- Production-oriented starting schema. Review with a security specialist before launch.
create extension if not exists pgcrypto;

create type public.market_status as enum ('live', 'beta', 'disabled');
create type public.listing_status as enum ('draft', 'active', 'reserved', 'sold', 'removed');
create type public.order_status as enum ('pending_payment', 'paid', 'shipped', 'delivered', 'inspection', 'disputed', 'completed', 'refunded', 'cancelled');

create table public.markets (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  default_locale text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.market_status not null default 'disabled',
  marketplace_fee_bps integer not null check (marketplace_fee_bps between 0 and 10000),
  shipping_partners text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.markets (country_code, default_locale, currency, status, marketplace_fee_bps, shipping_partners) values
  ('FI', 'fi', 'EUR', 'live', 150, array['Posti', 'Matkahuolto']),
  ('SE', 'sv', 'SEK', 'beta', 150, array['PostNord', 'DB Schenker']),
  ('DK', 'da', 'DKK', 'disabled', 150, array['PostNord', 'DAO']),
  ('NO', 'nb', 'NOK', 'disabled', 150, array['Posten', 'Bring']);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  country_code text not null references public.markets(country_code),
  locale text not null,
  preferred_currency text not null check (preferred_currency ~ '^[A-Z]{3}$'),
  avatar_path text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  market_country_code text not null references public.markets(country_code),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 5000),
  category text not null check (category in ('gpu', 'cpu', 'memory', 'motherboard', 'pc', 'other')),
  condition text not null check (condition in ('new', 'excellent', 'good', 'fair')),
  price_minor bigint not null check (price_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  city text not null,
  specs jsonb not null default '{}',
  serial_evidence_path text,
  serial_hash text,
  status public.listing_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_shipping_countries (
  listing_id uuid not null references public.listings(id) on delete cascade,
  country_code text not null references public.markets(country_code),
  primary key (listing_id, country_code)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_country_code text not null references public.markets(country_code),
  seller_country_code text not null references public.markets(country_code),
  item_price_minor bigint not null check (item_price_minor > 0),
  marketplace_fee_minor bigint not null check (marketplace_fee_minor >= 0),
  payment_processing_minor bigint not null check (payment_processing_minor >= 0),
  shipping_minor bigint not null check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_provider text not null,
  payment_reference text unique,
  status public.order_status not null default 'pending_payment',
  inspection_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  carrier text not null,
  tracking_code text not null,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  subject_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1500),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id),
  check (reviewer_id <> subject_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  reason text not null,
  details text check (char_length(details) <= 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index listings_active_market_category_idx on public.listings (market_country_code, category, published_at desc) where status = 'active';
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);

alter table public.markets enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_shipping_countries enable row level security;
alter table public.orders enable row level security;
alter table public.shipments enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

create policy "markets are publicly readable" on public.markets for select using (true);
create policy "active listings are publicly readable" on public.listings for select using (status = 'active' or seller_id = auth.uid());
create policy "sellers create their listings" on public.listings for insert to authenticated with check (seller_id = auth.uid());
create policy "sellers update their listings" on public.listings for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "shipping countries follow readable listings" on public.listing_shipping_countries for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid())));
create policy "sellers manage listing destinations" on public.listing_shipping_countries for all to authenticated using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())) with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "profiles are readable" on public.profiles for select using (true);
create policy "users create their profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "participants read orders" on public.orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "participants read shipments" on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "reviews are publicly readable" on public.reviews for select using (true);
create policy "authenticated users create reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- Order creation, status transitions, shipments, payouts, reports access and review eligibility
-- intentionally require privileged server-side functions/service roles. Do not grant these
-- state changes directly to browser clients.
