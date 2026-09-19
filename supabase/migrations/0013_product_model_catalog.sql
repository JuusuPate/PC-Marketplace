-- Product identity is independent of listing titles and translated spec labels.
insert into public.catalog_categories (slug, parent_id, labels, icon_key, is_sellable, sort_order)
select s.slug, c.id, s.labels::jsonb, 'components', true, s.n
from (values
 ('psu','{"fi":"Virtalähteet","sv":"Nätaggregat","en":"Power supplies","da":"Strømforsyninger","nb":"Strømforsyninger"}',55),
 ('storage','{"fi":"Tallennuslaitteet","sv":"Lagring","en":"Storage","da":"Lager","nb":"Lagring"}',56),
 ('case','{"fi":"Kotelot","sv":"Chassin","en":"Cases","da":"Kabinetter","nb":"Kabinetter"}',57),
 ('cooling','{"fi":"Jäähdytys","sv":"Kylning","en":"Cooling","da":"Køling","nb":"Kjøling"}',58)
) s(slug,labels,n) join public.catalog_categories c on c.slug='components'
on conflict (slug) do nothing;
insert into public.catalog_market_categories(category_id,market_country_code,is_enabled,sort_order)
select id,'FI',true,sort_order from public.catalog_categories where slug in ('psu','storage','case','cooling')
on conflict do nothing;

create table public.catalog_product_models (
 id uuid primary key default gen_random_uuid(),
 category text not null references public.catalog_categories(slug) on update restrict on delete restrict,
 brand text not null check (char_length(trim(brand)) between 1 and 80),
 name text not null check (char_length(trim(name)) between 1 and 120),
 variant text not null default '' check (char_length(variant)<=160),
 aliases text not null default '' check (char_length(aliases)<=500),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index catalog_product_models_identity on public.catalog_product_models(category,lower(trim(brand)),lower(trim(name)),lower(trim(variant)));
create index catalog_product_models_category on public.catalog_product_models(category, name, id);
alter table public.catalog_product_models enable row level security;
create policy "public reads enabled product models" on public.catalog_product_models for select to anon,authenticated
using (is_active and exists(select 1 from public.catalog_categories c where c.slug=category and public.is_catalog_category_public(c.id)));
create policy "admin reads all product models" on public.catalog_product_models for select to authenticated using(public.is_current_user_admin());
revoke all on public.catalog_product_models from public,anon,authenticated;
grant select on public.catalog_product_models to anon,authenticated;
grant all on public.catalog_product_models to service_role;
alter table public.catalog_admin_changes drop constraint catalog_admin_changes_entity_type_check;
alter table public.catalog_admin_changes add constraint catalog_admin_changes_entity_type_check check(entity_type in ('navigation_item','listing_featured','product_model'));

alter table public.listings add column catalog_model_id uuid references public.catalog_product_models(id) on delete restrict;
create index listings_catalog_model_idx on public.listings(catalog_model_id);
create function public.bind_listing_product_model() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Existing create/update RPCs pass the selection atomically through a reserved transport key.
 if new.specs ? '_catalog_model_id' then
   new.catalog_model_id := nullif(new.specs->>'_catalog_model_id','')::uuid;
   new.specs := new.specs - '_catalog_model_id';
 elsif tg_op='UPDATE' then
   if new.category is distinct from old.category then new.catalog_model_id := null; end if;
 end if;
 if new.catalog_model_id is not null then
   if tg_op='INSERT' then
     if not exists(select 1 from public.catalog_product_models m where m.id=new.catalog_model_id and m.category=new.category and m.is_active) then
       raise exception 'Invalid product model' using errcode='22023'; end if;
   elsif new.catalog_model_id is distinct from old.catalog_model_id or new.category is distinct from old.category then
     if not exists(select 1 from public.catalog_product_models m where m.id=new.catalog_model_id and m.category=new.category and m.is_active) then
       raise exception 'Invalid product model' using errcode='22023'; end if;
   end if;
 end if;
 return new;
end $$;
create trigger bind_listing_product_model before insert or update of specs,category,catalog_model_id on public.listings
for each row execute function public.bind_listing_product_model();
revoke execute on function public.bind_listing_product_model() from public,anon,authenticated;

create function public.search_product_models(p_category text,p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_category is null or p_query is null or char_length(p_query)>100 or p_page is null or p_page<0 or p_page>100000 then
 raise exception 'Invalid search' using errcode='22023'; end if;
 with found as (select id,category,brand,name,variant,aliases,is_active,updated_at from public.catalog_product_models
 where category=p_category and is_active and position(lower(trim(p_query)) in lower(brand||' '||name||' '||variant||' '||aliases))>0),
 page as(select * from found order by lower(brand),lower(name),variant,id limit 20 offset p_page*20)
 select jsonb_build_object('total',(select count(*) from found),'items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke execute on function public.search_product_models(text,text,integer) from public;
grant execute on function public.search_product_models(text,text,integer) to anon,authenticated;

create function public.save_product_model(p_model jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare model_id uuid; previous public.catalog_product_models; saved public.catalog_product_models;
begin
 if (select auth.uid()) is null or not public.is_current_user_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_model) is distinct from 'object' or pg_column_size(p_model)>4096 then raise exception 'Invalid model' using errcode='22023'; end if;
 if not exists(select 1 from public.catalog_categories c join public.catalog_market_categories m on m.category_id=c.id
 where c.slug=p_model->>'category' and c.is_sellable and c.is_active and m.market_country_code='FI' and m.is_enabled) then
 raise exception 'Invalid category' using errcode='22023'; end if;
 model_id := nullif(p_model->>'id','')::uuid;
 if model_id is not null then
   select * into previous from public.catalog_product_models where id=model_id for update;
   if not found then raise exception 'Model not found' using errcode='22023'; end if;
   if previous.category <> p_model->>'category' then raise exception 'Model category cannot change' using errcode='22023'; end if;
   if p_model->>'updated_at' is distinct from previous.updated_at::text and (p_model->>'updated_at')::timestamptz is distinct from previous.updated_at then
     raise exception 'Model changed; reload before editing' using errcode='40001'; end if;
   update public.catalog_product_models set brand=trim(p_model->>'brand'),name=trim(p_model->>'name'),variant=trim(coalesce(p_model->>'variant','')),
   aliases=trim(coalesce(p_model->>'aliases','')),is_active=coalesce((p_model->>'is_active')::boolean,true),updated_at=clock_timestamp()
   where id=model_id returning * into saved;
 else
   insert into public.catalog_product_models(category,brand,name,variant,aliases,is_active)
   values(p_model->>'category',trim(p_model->>'brand'),trim(p_model->>'name'),trim(coalesce(p_model->>'variant','')),trim(coalesce(p_model->>'aliases','')),coalesce((p_model->>'is_active')::boolean,true))
   returning * into saved;
 end if;
 insert into public.catalog_admin_changes(entity_type,entity_id,action,before_data,after_data,changed_by)
 values('product_model',saved.id,case when model_id is null then 'created' else 'updated' end,case when model_id is null then null else to_jsonb(previous) end,to_jsonb(saved),(select auth.uid()));
 return saved.id;
end $$;
revoke execute on function public.save_product_model(jsonb) from public,anon;
grant execute on function public.save_product_model(jsonb) to authenticated;

create function public.get_admin_model_market(p_category text,p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_current_user_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_category is null or p_query is null or char_length(p_query)>100 or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid search' using errcode='22023'; end if;
 with found as (select * from public.catalog_product_models where category=p_category and position(lower(trim(p_query)) in lower(brand||' '||name||' '||variant||' '||aliases))>0),
 page as(select * from found order by lower(brand),lower(name),variant,id limit 20 offset p_page*20),
 asking as(select l.catalog_model_id,count(*) as n,round(avg(l.price_minor)) as price from public.listings l join page m on m.id=l.catalog_model_id where l.market_country_code='FI' and l.currency='EUR' and l.status='active' group by l.catalog_model_id),
 sold as(select l.catalog_model_id,count(*) as n,round(avg(o.item_price_minor)) as price from public.orders o join public.listings l on l.id=o.listing_id join page m on m.id=l.catalog_model_id where o.status='completed' and o.currency='EUR' and o.buyer_country_code='FI' and o.seller_country_code='FI' and l.market_country_code='FI' group by l.catalog_model_id),
 rows as(select p.*,coalesce(a.n,0) as active_listings,a.price as asking_average_minor,coalesce(s.n,0) as completed_orders,s.price as sold_average_minor from page p left join asking a on a.catalog_model_id=p.id left join sold s on s.catalog_model_id=p.id)
 select jsonb_build_object('total',(select count(*) from found),'items',coalesce((select jsonb_agg(to_jsonb(rows) order by lower(brand),lower(name),variant,id) from rows),'[]'::jsonb),
 'unlinked_listings',(select count(*) from public.listings where category=p_category and market_country_code='FI' and currency='EUR' and status='active' and catalog_model_id is null)) into result;
 return result;
end $$;
revoke execute on function public.get_admin_model_market(text,text,integer) from public,anon;
grant execute on function public.get_admin_model_market(text,text,integer) to authenticated;

-- Small starter catalog, no invented price observations. Variants remain distinct.
insert into public.catalog_product_models(category,brand,name,variant,aliases) values
('gpu','NVIDIA','GeForce RTX 3070','8 GB','rtx3070 3070'),
('gpu','NVIDIA','GeForce RTX 3080','10 GB','rtx3080 3080'),
('gpu','NVIDIA','GeForce RTX 3060 Ti','8 GB','rtx3060ti 3060ti'),
('cpu','AMD','Ryzen 5 5600','','r5 5600'),
('cpu','AMD','Ryzen 7 5800X','','r7 5800x'),
('cpu','Intel','Core i5-12400F','','i5 12400f 12400f'),
('motherboard','MSI','B550-A PRO','','b550 a pro'),
('motherboard','MSI','PRO B650-P WIFI','','b650 p wifi'),
('motherboard','MSI','PRO B660M-P WIFI DDR4','','b660m p ddr4'),
('memory','Kingston','FURY Beast','KF432C16BBK2/16 · 16 GB (2 x 8 GB) DDR4-3200','16gb ram'),
('memory','Kingston','FURY Beast','KF432C16BBK2/32 · 32 GB (2 x 16 GB) DDR4-3200','32gb ram'),
('memory','Kingston','FURY Beast','KF432C16BBK2/64 · 64 GB (2 x 32 GB) DDR4-3200','64gb ram'),
('psu','Corsair','RM650x','2021','650w cp-9020198'),
('psu','Corsair','RM750x','2021','750w cp-9020199'),
('psu','Corsair','RM850x','2021','850w cp-9020200'),
('storage','Samsung','970 EVO Plus','1 TB','1tb ssd mz-v7s1t0bw'),
('storage','Samsung','980 PRO','1 TB','1tb ssd mz-v8p1t0bw'),
('storage','Samsung','990 EVO','1 TB','1tb ssd mz-v9e1t0bw'),
('case','Fractal Design','Define R5','','define r5'),
('case','Fractal Design','Meshify C','','meshify c'),
('case','Fractal Design','Focus G','','focus g'),
('cooling','Noctua','NH-D15','','nhd15'),
('cooling','Noctua','NH-U12S','','nhu12s'),
('cooling','Noctua','NH-L9i','','nhl9i'),
('pc','MSI','Trident 3','Series · configuration varies','trident3'),
('pc','MSI','Infinite A','Series · configuration varies','infinite'),
('pc','MSI','Codex 3','Series · configuration varies','codex3'),
('other','Logitech','G502 HERO','','g502 mouse hiiri'),
('other','Logitech','G203 LIGHTSYNC','','g203 mouse hiiri'),
('other','Logitech','PRO X SUPERLIGHT 2','','superlight2 mouse hiiri');
