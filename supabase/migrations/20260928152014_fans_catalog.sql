-- Separate case/radiator fans from complete CPU cooling solutions.
-- Additive catalog data only: existing RLS, listing validation and admin RPCs apply.
insert into public.catalog_categories (slug,parent_id,labels,icon_key,sort_order)
select 'fans',id,'{"fi":"Tuulettimet","en":"Fans","sv":"Fläktar","da":"Blæsere","nb":"Vifter"}'::jsonb,'fan',59
from public.catalog_categories where slug='components'
on conflict (slug) do nothing;

insert into public.catalog_market_categories(category_id,market_country_code,is_enabled,sort_order)
select id,'FI',true,59 from public.catalog_categories where slug='fans'
on conflict (category_id,market_country_code) do nothing;

insert into public.catalog_brands(slug,labels) values
('arctic','{"fi":"ARCTIC","en":"ARCTIC","sv":"ARCTIC","da":"ARCTIC","nb":"ARCTIC"}'::jsonb),
('noctua','{"fi":"Noctua","en":"Noctua","sv":"Noctua","da":"Noctua","nb":"Noctua"}'::jsonb),
('be-quiet','{"fi":"be quiet!","en":"be quiet!","sv":"be quiet!","da":"be quiet!","nb":"be quiet!"}'::jsonb)
on conflict (slug) do nothing;

insert into public.catalog_category_brands(category_id,brand_id,sort_order)
select c.id,b.id,10 from public.catalog_categories c cross join public.catalog_brands b
where c.slug='fans' and b.slug in ('arctic','noctua','be-quiet')
on conflict (category_id,brand_id) do nothing;

insert into public.catalog_spec_fields(key,labels,value_type,unit,options) values
('fanSize','{"fi":"Tuulettimen koko (mm)","en":"Fan size (mm)","sv":"Fan size (mm)","da":"Fan size (mm)","nb":"Fan size (mm)"}'::jsonb,'integer','mm','[]'::jsonb),
('fanCount','{"fi":"Tuulettimien määrä","en":"Fan count","sv":"Fan count","da":"Fan count","nb":"Fan count"}'::jsonb,'integer',null,'[]'::jsonb),
('fanConnector','{"fi":"Tuulettimen liitin","en":"Fan connector","sv":"Fan connector","da":"Fan connector","nb":"Fan connector"}'::jsonb,'select',null,'[{"key":"3-pin","labels":{"fi":"3-pin","en":"3-pin","sv":"3-pin","da":"3-pin","nb":"3-pin"}},{"key":"4-pin","labels":{"fi":"4-pin","en":"4-pin","sv":"4-pin","da":"4-pin","nb":"4-pin"}},{"key":"molex","labels":{"fi":"Molex","en":"Molex","sv":"Molex","da":"Molex","nb":"Molex"}},{"key":"proprietary","labels":{"fi":"Valmistajakohtainen","en":"Proprietary","sv":"Proprietary","da":"Proprietary","nb":"Proprietary"}}]'::jsonb),
('fanControl','{"fi":"Tuulettimen nopeuden säätö","en":"Fan speed control","sv":"Fan speed control","da":"Fan speed control","nb":"Fan speed control"}'::jsonb,'select',null,'[{"key":"pwm","labels":{"fi":"PWM","en":"PWM","sv":"PWM","da":"PWM","nb":"PWM"}},{"key":"dc","labels":{"fi":"DC","en":"DC","sv":"DC","da":"DC","nb":"DC"}},{"key":"fixed","labels":{"fi":"Kiinteä nopeus","en":"Fixed speed","sv":"Fixed speed","da":"Fixed speed","nb":"Fixed speed"}}]'::jsonb),
('fanLighting','{"fi":"Tuulettimen valaistus","en":"Fan lighting","sv":"Fan lighting","da":"Fan lighting","nb":"Fan lighting"}'::jsonb,'select',null,'[{"key":"none","labels":{"fi":"Ei valaistusta","en":"None","sv":"None","da":"None","nb":"None"}},{"key":"rgb","labels":{"fi":"RGB","en":"RGB","sv":"RGB","da":"RGB","nb":"RGB"}},{"key":"argb","labels":{"fi":"ARGB","en":"ARGB","sv":"ARGB","da":"ARGB","nb":"ARGB"}}]'::jsonb)
on conflict (key) do nothing;

insert into public.catalog_category_spec_fields(category_id,spec_field_id,sort_order)
select c.id,f.id,array_position(array['fanSize','fanConnector','fanControl','fanLighting','fanCount'],f.key)*10
from public.catalog_categories c cross join public.catalog_spec_fields f
where c.slug='fans' and f.key in ('fanSize','fanConnector','fanControl','fanLighting','fanCount')
on conflict (category_id,spec_field_id) do nothing;

-- Manufacturer model names only; no generated sale prices, listings or transactions.
-- https://support.arctic.de/de/p12-pwm-pst/docs
-- https://www.noctua.at/en/products/nf-a12x25-pwm
-- https://www.bequiet.com/en/casefans/4609
insert into public.catalog_product_models(category,brand,name,variant,aliases) values
('fans','ARCTIC','P12 PWM PST','120 mm','p12 pwm pst ACFAN00120A'),
('fans','Noctua','NF-A12x25 PWM','120 mm','nf a12x25 pwm'),
('fans','be quiet!','Pure Wings 3','140 mm PWM','pure wings 3 140 pwm')
on conflict do nothing;
