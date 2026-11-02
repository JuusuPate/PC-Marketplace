-- Sulje sisäinen tapahtumatriggeri selainrooleilta säilyttäen itse triggerin.
-- Paikallisessa pinossa Supabasen hallitsemaa funktiota ei välttämättä ole.
set local lock_timeout = '5s';
set local statement_timeout = '45s';

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Viiteavainten johtavat sarakkeet tarvitsevat täydet indeksit myös silloin,
-- kun vanha yhdistelmäindeksi kattaa sarakkeen vain toisena tai osalla riveistä.
create index catalog_admin_changes_changed_by_idx on public.catalog_admin_changes (changed_by);
create index catalog_category_brands_brand_idx on public.catalog_category_brands (brand_id);
create index catalog_category_spec_fields_field_idx on public.catalog_category_spec_fields (spec_field_id);
create index legal_pages_updated_by_idx on public.legal_pages (updated_by);
create index listing_shipping_countries_country_idx on public.listing_shipping_countries (country_code);
create index listings_category_idx on public.listings (category);
create index marketplace_setting_changes_setting_idx on public.marketplace_setting_changes (setting_id);
create index orders_buyer_country_idx on public.orders (buyer_country_code);
create index orders_seller_country_idx on public.orders (seller_country_code);
create index profiles_country_idx on public.profiles (country_code);
create index reports_listing_idx on public.reports (listing_id);
create index reviews_reviewer_idx on public.reviews (reviewer_id);
create index reviews_subject_idx on public.reviews (subject_id);

-- Anonyymi käyttää vain entistä julkista ehtoa. Kirjautuneelle yhdistetään
-- samat julkinen TAI admin -ehdot yhteen policyyn; oikeuksien sisältö ei muutu.
-- Käyttäjästä riippumaton admin-tarkistus arvioidaan kerran kyselyä kohden.
alter policy "public reads FI catalog categories" on public.catalog_categories to anon;
alter policy "admins read all catalog categories" on public.catalog_categories
  rename to "authenticated reads authorized catalog categories";
alter policy "authenticated reads authorized catalog categories" on public.catalog_categories
  using ((select public.is_current_user_admin()) or public.is_catalog_category_public(id));

alter policy "public reads enabled FI market categories" on public.catalog_market_categories to anon;
alter policy "admins read all market categories" on public.catalog_market_categories
  rename to "authenticated reads authorized market categories";
alter policy "authenticated reads authorized market categories" on public.catalog_market_categories
  using ((select public.is_current_user_admin()) or (
    market_country_code = 'FI' and is_enabled = true and public.is_catalog_category_public(category_id)
  ));

alter policy "public reads FI catalog brands" on public.catalog_brands to anon;
alter policy "admins read all catalog brands" on public.catalog_brands
  rename to "authenticated reads authorized catalog brands";
alter policy "authenticated reads authorized catalog brands" on public.catalog_brands
  using ((select public.is_current_user_admin()) or public.is_catalog_brand_public(id));

alter policy "public reads FI category brands" on public.catalog_category_brands to anon;
alter policy "admins read all category brands" on public.catalog_category_brands
  rename to "authenticated reads authorized category brands";
alter policy "authenticated reads authorized category brands" on public.catalog_category_brands
  using ((select public.is_current_user_admin()) or (
    is_active = true and public.is_catalog_category_public(category_id) and public.is_catalog_brand_public(brand_id)
  ));

alter policy "public reads FI navigation items" on public.catalog_navigation_items to anon;
alter policy "admins read all navigation items" on public.catalog_navigation_items
  rename to "authenticated reads authorized navigation items";
alter policy "authenticated reads authorized navigation items" on public.catalog_navigation_items
  using ((select public.is_current_user_admin()) or (
    market_country_code = 'FI' and is_active = true and public.is_catalog_category_public(category_id)
  ));

alter policy "public reads FI specification fields" on public.catalog_spec_fields to anon;
alter policy "admins read all specification fields" on public.catalog_spec_fields
  rename to "authenticated reads authorized specification fields";
alter policy "authenticated reads authorized specification fields" on public.catalog_spec_fields
  using ((select public.is_current_user_admin()) or public.is_catalog_spec_field_public(id));

alter policy "public reads FI category specification fields" on public.catalog_category_spec_fields to anon;
alter policy "admins read all category specification fields" on public.catalog_category_spec_fields
  rename to "authenticated reads authorized category specification fields";
alter policy "authenticated reads authorized category specification fields" on public.catalog_category_spec_fields
  using ((select public.is_current_user_admin()) or (
    is_active = true and public.is_catalog_category_public(category_id) and public.is_catalog_spec_field_public(spec_field_id)
  ));

alter policy "public reads enabled product models" on public.catalog_product_models to anon;
alter policy "admin reads all product models" on public.catalog_product_models
  rename to "authenticated reads authorized product models";
alter policy "authenticated reads authorized product models" on public.catalog_product_models
  using ((select public.is_current_user_admin()) or (
    is_active and exists (
      select 1 from public.catalog_categories c
      where c.slug = catalog_product_models.category and public.is_catalog_category_public(c.id)
    )
  ));
