-- Admin-managed product taxonomy and navigation for a Finland-first catalog.
--
-- Categories, brands and technical fields are shared catalog concepts. Market
-- availability and navigation items are separate so another Nordic market can
-- be enabled later without duplicating the product model. Labels are JSONB to
-- let one row carry the supported Nordic and English translations.

create or replace function public.catalog_labels_are_valid(p_labels jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_labels) <> 'object' then false
    else
      p_labels ? 'fi'
      and not exists (
        select 1
        from jsonb_each(p_labels) as translation(locale, label)
        where translation.locale not in ('fi', 'sv', 'da', 'nb', 'en')
          or jsonb_typeof(translation.label) <> 'string'
          or char_length(trim(translation.label #>> '{}')) not between 1 and 120
      )
  end;
$$;

revoke execute on function public.catalog_labels_are_valid(jsonb) from public, anon;
grant execute on function public.catalog_labels_are_valid(jsonb) to authenticated, service_role;

create or replace function public.catalog_navigation_filter_is_valid(p_kind text, p_filter_config jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case p_kind
    when 'price_max_minor' then
      case
        when jsonb_typeof(p_filter_config) = 'object'
          and (select count(*) from jsonb_object_keys(p_filter_config)) = 1
          and jsonb_typeof(p_filter_config -> 'max_price_minor') = 'number'
          and (p_filter_config ->> 'max_price_minor') ~ '^[1-9][0-9]{0,8}$'
        then (p_filter_config ->> 'max_price_minor')::bigint between 1 and 100000000
        else false
      end
    when 'featured' then p_filter_config = '{"featured":true}'::jsonb
    when 'spec_option' then
      jsonb_typeof(p_filter_config) = 'object'
      and (select count(*) from jsonb_object_keys(p_filter_config)) = 2
      and jsonb_typeof(p_filter_config -> 'spec_key') = 'string'
      and jsonb_typeof(p_filter_config -> 'option_key') = 'string'
      and (p_filter_config ->> 'spec_key') ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
      and (p_filter_config ->> 'option_key') ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    else false
  end;
$$;

revoke execute on function public.catalog_navigation_filter_is_valid(text, jsonb) from public, anon;
grant execute on function public.catalog_navigation_filter_is_valid(text, jsonb) to authenticated, service_role;

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  parent_id uuid references public.catalog_categories(id) on delete restrict,
  labels jsonb not null check (public.catalog_labels_are_valid(labels)),
  icon_key text not null check (icon_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_sellable boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create table public.catalog_market_categories (
  category_id uuid not null references public.catalog_categories(id) on delete cascade,
  market_country_code text not null references public.markets(country_code) on delete restrict,
  is_enabled boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, market_country_code)
);

create table public.catalog_brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  labels jsonb not null check (public.catalog_labels_are_valid(labels)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_category_brands (
  category_id uuid not null references public.catalog_categories(id) on delete cascade,
  brand_id uuid not null references public.catalog_brands(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, brand_id)
);

create table public.catalog_navigation_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  market_country_code text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null check (kind in ('price_max_minor', 'featured', 'spec_option')),
  labels jsonb not null check (public.catalog_labels_are_valid(labels)),
  filter_config jsonb not null default '{}'::jsonb
    check (
      pg_column_size(filter_config) <= 4096
      and public.catalog_navigation_filter_is_valid(kind, filter_config)
    ),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, market_country_code, slug),
  foreign key (category_id, market_country_code)
    references public.catalog_market_categories(category_id, market_country_code) on delete cascade
);

create table public.catalog_spec_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'),
  labels jsonb not null check (public.catalog_labels_are_valid(labels)),
  value_type text not null check (value_type in ('text', 'integer', 'decimal', 'boolean', 'select', 'multiselect')),
  unit text check (unit is null or char_length(unit) between 1 and 30),
  options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array' and pg_column_size(options) <= 16384),
  validation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation) = 'object' and pg_column_size(validation) <= 4096),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_category_spec_fields (
  category_id uuid not null references public.catalog_categories(id) on delete cascade,
  spec_field_id uuid not null references public.catalog_spec_fields(id) on delete cascade,
  is_required boolean not null default false,
  allow_unknown boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, spec_field_id),
  check (not is_required or not allow_unknown)
);

create table public.catalog_admin_changes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('navigation_item', 'listing_featured')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated')),
  before_data jsonb,
  after_data jsonb not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index catalog_categories_parent_order_idx
  on public.catalog_categories (parent_id, sort_order) where is_active;
create index catalog_market_categories_market_order_idx
  on public.catalog_market_categories (market_country_code, sort_order) where is_enabled;
create index catalog_navigation_items_menu_idx
  on public.catalog_navigation_items (market_country_code, category_id, sort_order) where is_active;
create index catalog_category_brands_order_idx
  on public.catalog_category_brands (category_id, sort_order) where is_active;
create index catalog_category_spec_fields_order_idx
  on public.catalog_category_spec_fields (category_id, sort_order) where is_active;
create index catalog_admin_changes_entity_idx
  on public.catalog_admin_changes (entity_type, entity_id, created_at desc);

create trigger set_catalog_categories_updated_at
  before update on public.catalog_categories
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_market_categories_updated_at
  before update on public.catalog_market_categories
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_brands_updated_at
  before update on public.catalog_brands
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_category_brands_updated_at
  before update on public.catalog_category_brands
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_navigation_items_updated_at
  before update on public.catalog_navigation_items
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_spec_fields_updated_at
  before update on public.catalog_spec_fields
  for each row execute procedure public.set_updated_at();
create trigger set_catalog_category_spec_fields_updated_at
  before update on public.catalog_category_spec_fields
  for each row execute procedure public.set_updated_at();

-- Seed the existing frontend categories. "components" is a navigation group,
-- not a value users can assign to a listing.
insert into public.catalog_categories (slug, labels, icon_key, is_sellable, sort_order)
values
  (
    'components',
    '{"fi":"Komponentit","sv":"Komponenter","da":"Komponenter","nb":"Komponenter","en":"Components"}',
    'components',
    false,
    10
  ),
  (
    'pc',
    '{"fi":"Pelikoneet","sv":"Speldatorer","da":"Gaming-pc''er","nb":"Spill-PC-er","en":"Gaming PCs"}',
    'gaming-pc',
    true,
    20
  ),
  (
    'other',
    '{"fi":"Oheislaitteet ja muut","sv":"Tillbehör och övrigt","da":"Tilbehør og andet","nb":"Tilbehør og annet","en":"Accessories and other"}',
    'peripherals',
    true,
    70
  )
on conflict (slug) do nothing;

insert into public.catalog_categories (slug, parent_id, labels, icon_key, is_sellable, sort_order)
select seed.slug, parent.id, seed.labels::jsonb, seed.icon_key, true, seed.sort_order
from (
  values
    (
      'gpu',
      '{"fi":"Näytönohjaimet","sv":"Grafikkort","da":"Grafikkort","nb":"Skjermkort","en":"Graphics cards"}',
      'gpu',
      20
    ),
    (
      'cpu',
      '{"fi":"Prosessorit","sv":"Processorer","da":"Processorer","nb":"Prosessorer","en":"Processors"}',
      'cpu',
      30
    ),
    (
      'memory',
      '{"fi":"Muistit","sv":"Minne","da":"Hukommelse","nb":"Minne","en":"Memory"}',
      'memory',
      40
    ),
    (
      'motherboard',
      '{"fi":"Emolevyt","sv":"Moderkort","da":"Bundkort","nb":"Hovedkort","en":"Motherboards"}',
      'motherboard',
      50
    )
) as seed(slug, labels, icon_key, sort_order)
join public.catalog_categories as parent on parent.slug = 'components'
on conflict (slug) do nothing;

insert into public.catalog_market_categories (category_id, market_country_code, is_enabled, sort_order)
select category.id, 'FI', true, category.sort_order
from public.catalog_categories as category
where category.slug in ('components', 'pc', 'gpu', 'cpu', 'memory', 'motherboard', 'other')
on conflict (category_id, market_country_code) do nothing;

insert into public.catalog_brands (slug, labels)
values
  ('nvidia', '{"fi":"NVIDIA","sv":"NVIDIA","da":"NVIDIA","nb":"NVIDIA","en":"NVIDIA"}'),
  ('amd', '{"fi":"AMD","sv":"AMD","da":"AMD","nb":"AMD","en":"AMD"}'),
  ('intel', '{"fi":"Intel","sv":"Intel","da":"Intel","nb":"Intel","en":"Intel"}'),
  ('asus', '{"fi":"ASUS","sv":"ASUS","da":"ASUS","nb":"ASUS","en":"ASUS"}'),
  ('msi', '{"fi":"MSI","sv":"MSI","da":"MSI","nb":"MSI","en":"MSI"}'),
  ('gigabyte', '{"fi":"Gigabyte","sv":"Gigabyte","da":"Gigabyte","nb":"Gigabyte","en":"Gigabyte"}'),
  ('asrock', '{"fi":"ASRock","sv":"ASRock","da":"ASRock","nb":"ASRock","en":"ASRock"}'),
  ('sapphire', '{"fi":"Sapphire","sv":"Sapphire","da":"Sapphire","nb":"Sapphire","en":"Sapphire"}'),
  ('powercolor', '{"fi":"PowerColor","sv":"PowerColor","da":"PowerColor","nb":"PowerColor","en":"PowerColor"}'),
  ('kingston', '{"fi":"Kingston","sv":"Kingston","da":"Kingston","nb":"Kingston","en":"Kingston"}'),
  ('corsair', '{"fi":"Corsair","sv":"Corsair","da":"Corsair","nb":"Corsair","en":"Corsair"}'),
  ('g-skill', '{"fi":"G.Skill","sv":"G.Skill","da":"G.Skill","nb":"G.Skill","en":"G.Skill"}'),
  ('crucial', '{"fi":"Crucial","sv":"Crucial","da":"Crucial","nb":"Crucial","en":"Crucial"}'),
  ('keychron', '{"fi":"Keychron","sv":"Keychron","da":"Keychron","nb":"Keychron","en":"Keychron"}')
on conflict (slug) do nothing;

insert into public.catalog_category_brands (category_id, brand_id, sort_order)
select category.id, brand.id, assignment.sort_order
from (
  values
    ('gpu', 'nvidia', 10),
    ('gpu', 'amd', 20),
    ('gpu', 'asus', 30),
    ('gpu', 'msi', 40),
    ('gpu', 'gigabyte', 50),
    ('gpu', 'sapphire', 60),
    ('gpu', 'powercolor', 70),
    ('cpu', 'amd', 10),
    ('cpu', 'intel', 20),
    ('memory', 'kingston', 10),
    ('memory', 'corsair', 20),
    ('memory', 'g-skill', 30),
    ('memory', 'crucial', 40),
    ('motherboard', 'asus', 10),
    ('motherboard', 'msi', 20),
    ('motherboard', 'gigabyte', 30),
    ('motherboard', 'asrock', 40),
    ('other', 'keychron', 10)
) as assignment(category_slug, brand_slug, sort_order)
join public.catalog_categories as category on category.slug = assignment.category_slug
join public.catalog_brands as brand on brand.slug = assignment.brand_slug
on conflict (category_id, brand_id) do nothing;

insert into public.catalog_navigation_items (
  category_id,
  market_country_code,
  slug,
  kind,
  labels,
  filter_config,
  sort_order
)
select
  category.id,
  'FI',
  item.slug,
  item.kind,
  item.labels::jsonb,
  item.filter_config::jsonb,
  item.sort_order
from (
  values
    (
      'pc',
      'alle-1000',
      'price_max_minor',
      '{"fi":"Alle 1 000 €","sv":"Under 1 000 €","da":"Under 1.000 €","nb":"Under 1 000 €","en":"Under €1,000"}',
      '{"max_price_minor":100000}',
      10
    ),
    (
      'pc',
      'nostetut',
      'featured',
      '{"fi":"Nostetut","sv":"Utvalda","da":"Udvalgte","nb":"Fremhevede","en":"Featured"}',
      '{"featured":true}',
      20
    ),
    (
      'gpu',
      'nvidia',
      'spec_option',
      '{"fi":"NVIDIA","sv":"NVIDIA","da":"NVIDIA","nb":"NVIDIA","en":"NVIDIA"}',
      '{"spec_key":"gpu_chip_vendor","option_key":"nvidia"}',
      10
    ),
    (
      'gpu',
      'amd',
      'spec_option',
      '{"fi":"AMD","sv":"AMD","da":"AMD","nb":"AMD","en":"AMD"}',
      '{"spec_key":"gpu_chip_vendor","option_key":"amd"}',
      20
    )
) as item(category_slug, slug, kind, labels, filter_config, sort_order)
join public.catalog_categories as category on category.slug = item.category_slug
on conflict (category_id, market_country_code, slug) do nothing;

-- Existing keys mirror the current form-definition keys. Legacy listings may
-- still contain translated labels in listings.specs; a later dual-read/write
-- migration can move them to these stable, language-neutral identifiers.
insert into public.catalog_spec_fields (key, labels, value_type)
values
  ('processor', '{"fi":"Prosessori","sv":"Processor","da":"Processor","nb":"Prosessor","en":"Processor"}', 'text'),
  ('graphicsCard', '{"fi":"Näytönohjain","sv":"Grafikkort","da":"Grafikkort","nb":"Skjermkort","en":"Graphics card"}', 'text'),
  ('memory', '{"fi":"Keskusmuisti (RAM)","sv":"Minne (RAM)","da":"Hukommelse (RAM)","nb":"Minne (RAM)","en":"Memory (RAM)"}', 'text'),
  ('storage', '{"fi":"Tallennustila","sv":"Lagring","da":"Lagerplads","nb":"Lagring","en":"Storage"}', 'text'),
  ('motherboard', '{"fi":"Emolevy","sv":"Moderkort","da":"Bundkort","nb":"Hovedkort","en":"Motherboard"}', 'text'),
  ('powerSupply', '{"fi":"Virtalähde","sv":"Nätaggregat","da":"Strømforsyning","nb":"Strømforsyning","en":"Power supply"}', 'text'),
  ('case', '{"fi":"Kotelo","sv":"Chassi","da":"Kabinet","nb":"Kabinett","en":"Case"}', 'text'),
  ('cooling', '{"fi":"Jäähdytys","sv":"Kylning","da":"Køling","nb":"Kjøling","en":"Cooling"}', 'text'),
  ('operatingSystem', '{"fi":"Käyttöjärjestelmä","sv":"Operativsystem","da":"Operativsystem","nb":"Operativsystem","en":"Operating system"}', 'text'),
  ('vram', '{"fi":"Näyttömuisti","sv":"Grafikminne","da":"Grafikhukommelse","nb":"Skjermminne","en":"Video memory"}', 'text'),
  ('interface', '{"fi":"Liitäntä","sv":"Gränssnitt","da":"Grænseflade","nb":"Grensesnitt","en":"Interface"}', 'text'),
  ('powerConnector', '{"fi":"Virtaliitin","sv":"Strömkontakt","da":"Strømstik","nb":"Strømkontakt","en":"Power connector"}', 'text'),
  ('socket', '{"fi":"Prosessorikanta","sv":"Sockel","da":"Sokkel","nb":"Sokkel","en":"Socket"}', 'text'),
  ('cores', '{"fi":"Ytimet / säikeet","sv":"Kärnor / trådar","da":"Kerner / tråde","nb":"Kjerner / tråder","en":"Cores / threads"}', 'text'),
  ('clock', '{"fi":"Kellotaajuus","sv":"Klockfrekvens","da":"Clockfrekvens","nb":"Klokkefrekvens","en":"Clock speed"}', 'text'),
  ('capacity', '{"fi":"Kapasiteetti","sv":"Kapacitet","da":"Kapacitet","nb":"Kapasitet","en":"Capacity"}', 'text'),
  ('memoryType', '{"fi":"Muistityyppi","sv":"Minnestyp","da":"Hukommelsestype","nb":"Minnetype","en":"Memory type"}', 'text'),
  ('speed', '{"fi":"Nopeus","sv":"Hastighet","da":"Hastighed","nb":"Hastighet","en":"Speed"}', 'text'),
  ('chipset', '{"fi":"Piirisarja","sv":"Kretsuppsättning","da":"Chipsæt","nb":"Brikkesett","en":"Chipset"}', 'text'),
  ('formFactor', '{"fi":"Koko","sv":"Formfaktor","da":"Formfaktor","nb":"Formfaktor","en":"Form factor"}', 'text')
on conflict (key) do nothing;

insert into public.catalog_spec_fields (key, labels, value_type, options)
values (
  'gpu_chip_vendor',
  '{"fi":"Piirivalmistaja","sv":"Kretstillverkare","da":"Chipproducent","nb":"Brikkeprodusent","en":"Chip vendor"}',
  'select',
  '[
    {"key":"nvidia","labels":{"fi":"NVIDIA","sv":"NVIDIA","da":"NVIDIA","nb":"NVIDIA","en":"NVIDIA"}},
    {"key":"amd","labels":{"fi":"AMD","sv":"AMD","da":"AMD","nb":"AMD","en":"AMD"}}
  ]'
)
on conflict (key) do nothing;

insert into public.catalog_category_spec_fields (
  category_id,
  spec_field_id,
  is_required,
  allow_unknown,
  sort_order
)
select category.id, field.id, false, true, assignment.sort_order
from (
  values
    ('pc', 'processor', 10),
    ('pc', 'graphicsCard', 20),
    ('pc', 'memory', 30),
    ('pc', 'storage', 40),
    ('pc', 'motherboard', 50),
    ('pc', 'powerSupply', 60),
    ('pc', 'case', 70),
    ('pc', 'cooling', 80),
    ('pc', 'operatingSystem', 90),
    ('gpu', 'vram', 10),
    ('gpu', 'gpu_chip_vendor', 5),
    ('gpu', 'interface', 20),
    ('gpu', 'powerConnector', 30),
    ('cpu', 'socket', 10),
    ('cpu', 'cores', 20),
    ('cpu', 'clock', 30),
    ('memory', 'capacity', 10),
    ('memory', 'memoryType', 20),
    ('memory', 'speed', 30),
    ('motherboard', 'socket', 10),
    ('motherboard', 'chipset', 20),
    ('motherboard', 'formFactor', 30),
    ('motherboard', 'memoryType', 40)
) as assignment(category_slug, field_key, sort_order)
join public.catalog_categories as category on category.slug = assignment.category_slug
join public.catalog_spec_fields as field on field.key = assignment.field_key
on conflict (category_id, spec_field_id) do nothing;

-- The first admin write surface is deliberately narrow: an admin may create,
-- edit, order or disable a navigation preset, but cannot submit SQL or an
-- arbitrary URL. Database constraints validate every supported filter shape.
create or replace function public.save_catalog_navigation_item(
  p_id uuid,
  p_category_slug text,
  p_market_country_code text,
  p_slug text,
  p_kind text,
  p_labels jsonb,
  p_filter_config jsonb,
  p_sort_order integer,
  p_is_active boolean
)
returns setof public.catalog_navigation_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_category_id uuid;
  previous_data jsonb;
  saved_item public.catalog_navigation_items;
  change_action text;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select category.id into target_category_id
  from public.catalog_categories as category
  join public.catalog_market_categories as market_category
    on market_category.category_id = category.id
  where category.slug = trim(p_category_slug)
    and market_category.market_country_code = p_market_country_code;

  if target_category_id is null then
    raise exception 'Category is not configured for this market';
  end if;

  if p_kind = 'spec_option' and not exists (
    select 1
    from public.catalog_spec_fields as field
    join public.catalog_category_spec_fields as category_field
      on category_field.spec_field_id = field.id
    where category_field.category_id = target_category_id
      and field.key = p_filter_config ->> 'spec_key'
      and field.value_type in ('select', 'multiselect')
      and field.options @> jsonb_build_array(
        jsonb_build_object('key', p_filter_config ->> 'option_key')
      )
  ) then
    raise exception 'Specification option is not enabled for this category';
  end if;

  if p_id is null then
    insert into public.catalog_navigation_items (
      category_id,
      market_country_code,
      slug,
      kind,
      labels,
      filter_config,
      sort_order,
      is_active
    )
    values (
      target_category_id,
      p_market_country_code,
      trim(p_slug),
      p_kind,
      p_labels,
      p_filter_config,
      p_sort_order,
      p_is_active
    )
    returning * into saved_item;
    change_action := 'created';
  else
    select to_jsonb(item) into previous_data
    from public.catalog_navigation_items as item
    where item.id = p_id;

    if previous_data is null then
      raise exception 'Navigation item not found';
    end if;

    update public.catalog_navigation_items
    set category_id = target_category_id,
        market_country_code = p_market_country_code,
        slug = trim(p_slug),
        kind = p_kind,
        labels = p_labels,
        filter_config = p_filter_config,
        sort_order = p_sort_order,
        is_active = p_is_active,
        updated_at = now()
    where id = p_id
    returning * into saved_item;
    change_action := 'updated';
  end if;

  insert into public.catalog_admin_changes (
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    changed_by
  )
  values (
    'navigation_item',
    saved_item.id,
    change_action,
    previous_data,
    to_jsonb(saved_item),
    (select auth.uid())
  );

  return next saved_item;
  return;
end;
$$;

revoke execute on function public.save_catalog_navigation_item(uuid, text, text, text, text, jsonb, jsonb, integer, boolean)
  from public, anon;
grant execute on function public.save_catalog_navigation_item(uuid, text, text, text, text, jsonb, jsonb, integer, boolean)
  to authenticated, service_role;

-- Replace the closed category CHECK with a catalog foreign key. Existing values
-- are all seeded above, while an admin can add a new sellable category later.
alter table public.listings drop constraint if exists listings_category_check;
alter table public.listings
  add constraint listings_category_catalog_fk
  foreign key (category) references public.catalog_categories(slug) on update restrict on delete restrict;

create or replace function public.enforce_listing_catalog_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  must_validate boolean;
begin
  -- New drafts and publish/category changes must use an enabled category. A
  -- listing may still progress to reserved, sold or removed after its category
  -- is disabled, so normal lifecycle completion is never trapped by taxonomy.
  if tg_op = 'INSERT' then
    must_validate := true;
  else
    must_validate := new.category is distinct from old.category
      or new.market_country_code is distinct from old.market_country_code
      or new.status = 'active';
  end if;

  if must_validate and not exists (
    select 1
    from public.catalog_categories as category
    join public.catalog_market_categories as market_category
      on market_category.category_id = category.id
    where category.slug = new.category
      and category.is_sellable = true
      and category.is_active = true
      and market_category.market_country_code = new.market_country_code
      and market_category.is_enabled = true
  ) then
    raise exception 'Listing category is not enabled for this market';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_listing_catalog_category on public.listings;
create trigger enforce_listing_catalog_category
  before insert or update of category, market_country_code, status on public.listings
  for each row execute procedure public.enforce_listing_catalog_category();

revoke execute on function public.enforce_listing_catalog_category() from public, anon, authenticated;

-- A featured navigation segment needs a server-owned listing signal. Browsers
-- can read it, but only an authenticated admin can change it through this RPC.
alter table public.listings
  add column is_featured boolean not null default false,
  add column featured_at timestamptz,
  add constraint listings_featured_state_check
    check (is_featured = (featured_at is not null));

create index listings_active_featured_idx
  on public.listings (market_country_code, category, featured_at desc)
  where status = 'active' and is_featured = true;

create or replace function public.set_listing_featured(p_listing_id uuid, p_is_featured boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_data jsonb;
  saved_data jsonb;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if p_is_featured and not exists (
    select 1
    from public.listings as listing
    where listing.id = p_listing_id and listing.status = 'active'
  ) then
    raise exception 'Only an active listing can be featured';
  end if;

  select jsonb_build_object(
    'is_featured', listing.is_featured,
    'featured_at', listing.featured_at
  ) into previous_data
  from public.listings as listing
  where listing.id = p_listing_id;

  update public.listings
  set is_featured = p_is_featured,
      featured_at = case when p_is_featured then now() else null end
  where id = p_listing_id
  returning jsonb_build_object(
    'is_featured', is_featured,
    'featured_at', featured_at
  ) into saved_data;

  if not found then
    raise exception 'Listing not found';
  end if;

  insert into public.catalog_admin_changes (
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    changed_by
  )
  values (
    'listing_featured',
    p_listing_id,
    'updated',
    previous_data,
    saved_data,
    (select auth.uid())
  );
end;
$$;

revoke execute on function public.set_listing_featured(uuid, boolean) from public, anon;
grant execute on function public.set_listing_featured(uuid, boolean) to authenticated, service_role;

-- Security-definer predicates prevent recursive cross-table RLS lookups. They
-- reveal only whether an identifier belongs to the currently public FI catalog.
create or replace function public.is_catalog_category_public(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_categories as category
    join public.catalog_market_categories as market_category
      on market_category.category_id = category.id
    join public.markets as market
      on market.country_code = market_category.market_country_code
    where category.id = p_category_id
      and category.is_active = true
      and market_category.market_country_code = 'FI'
      and market_category.is_enabled = true
      and market.status = 'live'
  );
$$;

create or replace function public.is_catalog_brand_public(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_brands as brand
    join public.catalog_category_brands as category_brand
      on category_brand.brand_id = brand.id
    where brand.id = p_brand_id
      and brand.is_active = true
      and category_brand.is_active = true
      and public.is_catalog_category_public(category_brand.category_id)
  );
$$;

create or replace function public.is_catalog_spec_field_public(p_spec_field_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_spec_fields as field
    join public.catalog_category_spec_fields as category_field
      on category_field.spec_field_id = field.id
    where field.id = p_spec_field_id
      and field.is_active = true
      and category_field.is_active = true
      and public.is_catalog_category_public(category_field.category_id)
  );
$$;

revoke execute on function public.is_catalog_category_public(uuid) from public;
revoke execute on function public.is_catalog_brand_public(uuid) from public;
revoke execute on function public.is_catalog_spec_field_public(uuid) from public;
grant execute on function public.is_catalog_category_public(uuid) to anon, authenticated, service_role;
grant execute on function public.is_catalog_brand_public(uuid) to anon, authenticated, service_role;
grant execute on function public.is_catalog_spec_field_public(uuid) to anon, authenticated, service_role;

alter table public.catalog_categories enable row level security;
alter table public.catalog_market_categories enable row level security;
alter table public.catalog_brands enable row level security;
alter table public.catalog_category_brands enable row level security;
alter table public.catalog_navigation_items enable row level security;
alter table public.catalog_spec_fields enable row level security;
alter table public.catalog_category_spec_fields enable row level security;
alter table public.catalog_admin_changes enable row level security;

create policy "public reads FI catalog categories"
  on public.catalog_categories for select to anon, authenticated
  using (public.is_catalog_category_public(id));
create policy "admins read all catalog categories"
  on public.catalog_categories for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads enabled FI market categories"
  on public.catalog_market_categories for select to anon, authenticated
  using (
    market_country_code = 'FI'
    and is_enabled = true
    and public.is_catalog_category_public(category_id)
  );
create policy "admins read all market categories"
  on public.catalog_market_categories for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads FI catalog brands"
  on public.catalog_brands for select to anon, authenticated
  using (public.is_catalog_brand_public(id));
create policy "admins read all catalog brands"
  on public.catalog_brands for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads FI category brands"
  on public.catalog_category_brands for select to anon, authenticated
  using (
    is_active = true
    and public.is_catalog_category_public(category_id)
    and public.is_catalog_brand_public(brand_id)
  );
create policy "admins read all category brands"
  on public.catalog_category_brands for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads FI navigation items"
  on public.catalog_navigation_items for select to anon, authenticated
  using (
    market_country_code = 'FI'
    and is_active = true
    and public.is_catalog_category_public(category_id)
  );
create policy "admins read all navigation items"
  on public.catalog_navigation_items for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads FI specification fields"
  on public.catalog_spec_fields for select to anon, authenticated
  using (public.is_catalog_spec_field_public(id));
create policy "admins read all specification fields"
  on public.catalog_spec_fields for select to authenticated
  using (public.is_current_user_admin());

create policy "public reads FI category specification fields"
  on public.catalog_category_spec_fields for select to anon, authenticated
  using (
    is_active = true
    and public.is_catalog_category_public(category_id)
    and public.is_catalog_spec_field_public(spec_field_id)
  );
create policy "admins read all category specification fields"
  on public.catalog_category_spec_fields for select to authenticated
  using (public.is_current_user_admin());

create policy "admins read catalog change history"
  on public.catalog_admin_changes for select to authenticated
  using (public.is_current_user_admin());

revoke all on table public.catalog_categories from anon, authenticated;
revoke all on table public.catalog_market_categories from anon, authenticated;
revoke all on table public.catalog_brands from anon, authenticated;
revoke all on table public.catalog_category_brands from anon, authenticated;
revoke all on table public.catalog_navigation_items from anon, authenticated;
revoke all on table public.catalog_spec_fields from anon, authenticated;
revoke all on table public.catalog_category_spec_fields from anon, authenticated;
revoke all on table public.catalog_admin_changes from anon, authenticated;

grant select on table public.catalog_categories to anon, authenticated;
grant select on table public.catalog_market_categories to anon, authenticated;
grant select on table public.catalog_brands to anon, authenticated;
grant select on table public.catalog_category_brands to anon, authenticated;
grant select on table public.catalog_navigation_items to anon, authenticated;
grant select on table public.catalog_spec_fields to anon, authenticated;
grant select on table public.catalog_category_spec_fields to anon, authenticated;
grant select on table public.catalog_admin_changes to authenticated;

grant all on table public.catalog_categories to service_role;
grant all on table public.catalog_market_categories to service_role;
grant all on table public.catalog_brands to service_role;
grant all on table public.catalog_category_brands to service_role;
grant all on table public.catalog_navigation_items to service_role;
grant all on table public.catalog_spec_fields to service_role;
grant all on table public.catalog_category_spec_fields to service_role;
grant all on table public.catalog_admin_changes to service_role;

-- Browser roles receive no direct catalog write permission. Admin tools use the
-- checked RPCs above; future category/specification RPCs can follow the same
-- audit pattern. Hard deletion remains a service-role maintenance operation.
