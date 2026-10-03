-- Public manufacturer specifications; no user data or authorization changes.
alter table public.catalog_product_models
 add column specs jsonb not null default '{}'::jsonb,
 add column source_url text not null default '' check (char_length(source_url)<=1000 and (source_url='' or source_url ~ '^https://'));

create function public.valid_catalog_specs(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 if jsonb_typeof(value) is distinct from 'object' or pg_column_size(value)>12000 then return false; end if;
 if (select count(*) from jsonb_object_keys(value))>40 then return false; end if;
 return not exists(select 1 from jsonb_each(value) e where e.key !~ '^[a-zA-Z][a-zA-Z0-9_]{0,63}$'
   or jsonb_typeof(e.value)<>'string' or char_length(e.value #>> '{}')>300);
end $$;
revoke all on function public.valid_catalog_specs(jsonb) from public,anon,authenticated;
grant execute on function public.valid_catalog_specs(jsonb) to service_role;
alter table public.catalog_product_models add constraint catalog_product_model_specs_valid check(public.valid_catalog_specs(specs));

create function public.normalize_catalog_model_label() returns trigger
language plpgsql security invoker set search_path='' as $$
declare old_variant text := new.variant;
begin
 new.name := trim(regexp_replace(regexp_replace(replace(new.name,'·',' '),'\mGeForce\M\s*','','gi'),'\s+',' ','g'));
 new.variant := regexp_replace(replace(new.variant,'·',' '),'\mGeForce\M\s*','','gi');
 if new.category='memory' then
   new.variant := regexp_replace(new.variant,'(^|[[:space:]])KF[[:alnum:]/-]+','\1','gi');
 end if;
 new.variant := trim(regexp_replace(regexp_replace(new.variant,'([0-9])\s*GB','\1 GB','gi'),'\s+',' ','g'));
 if old_variant <> new.variant then new.aliases := left(trim(new.aliases||' '||old_variant),500); end if;
 return new;
end $$;
revoke all on function public.normalize_catalog_model_label() from public,anon,authenticated;
create trigger normalize_catalog_model_label before insert or update of name,variant on public.catalog_product_models
for each row execute function public.normalize_catalog_model_label();
-- Keep existing UUIDs and listing references while cleaning their visible names.
update public.catalog_product_models set name=name,variant=variant,updated_at=clock_timestamp()
where name ~* '\mGeForce\M' or position('·' in name||variant)>0 or (category='gpu' and variant ~ '[0-9]GB');

create or replace function public.search_product_models(p_category text,p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_category is null or p_query is null or char_length(p_query)>100 or p_page is null or p_page<0 or p_page>100000 then
 raise exception 'Invalid search' using errcode='22023'; end if;
 with found as (select id,category,brand,name,variant,aliases,is_active,updated_at,specs,source_url from public.catalog_product_models
 where category=p_category and is_active and position(lower(trim(p_query)) in lower(brand||' '||name||' '||variant||' '||aliases))>0),
 page as(select * from found order by lower(brand),lower(name),variant,id limit 20 offset p_page*20)
 select jsonb_build_object('total',(select count(*) from found),'items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke execute on function public.search_product_models(text,text,integer) from public;
grant execute on function public.search_product_models(text,text,integer) to anon,authenticated;

create or replace function public.save_product_model(p_model jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare model_id uuid; previous public.catalog_product_models; saved public.catalog_product_models;
begin
 if (select auth.uid()) is null or not public.is_current_user_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_model) is distinct from 'object' or pg_column_size(p_model)>16384 then raise exception 'Invalid model' using errcode='22023'; end if;
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
    ,specs=case when p_model ? 'specs' then p_model->'specs' else previous.specs end,
   source_url=coalesce(p_model->>'source_url',previous.source_url)
   where id=model_id returning * into saved;
 else
   insert into public.catalog_product_models(category,brand,name,variant,aliases,is_active,specs,source_url)
   values(p_model->>'category',trim(p_model->>'brand'),trim(p_model->>'name'),trim(coalesce(p_model->>'variant','')),trim(coalesce(p_model->>'aliases','')),coalesce((p_model->>'is_active')::boolean,true),coalesce(p_model->'specs','{}'::jsonb),coalesce(p_model->>'source_url',''))
   returning * into saved;
 end if;
 insert into public.catalog_admin_changes(entity_type,entity_id,action,before_data,after_data,changed_by)
 values('product_model',saved.id,case when model_id is null then 'created' else 'updated' end,case when model_id is null then null else to_jsonb(previous) end,to_jsonb(saved),(select auth.uid()));
 return saved.id;
end $$;
revoke execute on function public.save_product_model(jsonb) from public,anon;
grant execute on function public.save_product_model(jsonb) to authenticated;
