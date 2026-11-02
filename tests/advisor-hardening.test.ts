import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const adminId = "00000000-0000-4000-8000-000000000011";
const userId = "00000000-0000-4000-8000-000000000012";
const tables = [
  "catalog_categories",
  "catalog_market_categories",
  "catalog_brands",
  "catalog_category_brands",
  "catalog_navigation_items",
  "catalog_spec_fields",
  "catalog_category_spec_fields",
  "catalog_product_models",
] as const;
const identities = [
  ["anon", null],
  ["authenticated", null],
  ["authenticated", userId],
  ["authenticated", adminId],
] as const;
let db: PGlite;
let before: Awaited<ReturnType<typeof visibility>>[];

// Vertaa oikeaa vanhaa ja uutta migraatioketjua samoilla riveillä. Näin testi
// havaitsee myös tahattoman käyttöoikeuden laajennuksen, ei vain policyjen nimet.
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
    alter table storage.objects enable row level security;
    create function storage.extension(p_name text) returns text language sql immutable as $$
      select reverse(split_part(reverse(p_name), '.', 1));
    $$;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const target = files.find((file) => file.endsWith("_advisor_access_and_catalog_indexes.sql"))!;
  expect(target).toBeTruthy();
  for (const file of files.filter((file) => file < target)) {
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  }
  await db.query(
    `insert into auth.users (id,email,raw_user_meta_data) values
      ($1,'admin@example.test','{}'), ($2,'user@example.test','{"role":"admin"}')`,
    [adminId, userId],
  );
  await db.query("insert into public.user_roles (user_id,role) values ($1,'admin')", [adminId]);
  // Katalogin laajuus ei ole tämän testin kohde: säilytä pari oikeaa mallia
  // kategoriasta, jotta oikeusvertailu ei hidastu tuhansien siemenmallien mukana.
  await db.exec(`
    delete from public.catalog_product_models where id not in (
      select id from (
        select id,row_number() over (partition by category order by id) as position
        from public.catalog_product_models
      ) sample where position <= 2
    );
    update public.catalog_categories set is_active=false where slug='cooling';
    update public.catalog_market_categories set is_enabled=false
      where category_id=(select id from public.catalog_categories where slug='fans');
    update public.catalog_product_models set is_active=false
      where id=(select id from public.catalog_product_models where category='gpu' order by id limit 1);
    update public.catalog_brands set is_active=false
      where id=(select id from public.catalog_brands order by id limit 1);
    update public.catalog_category_brands set is_active=false
      where (category_id,brand_id)=(select category_id,brand_id from public.catalog_category_brands order by category_id,brand_id limit 1);
    update public.catalog_spec_fields set is_active=false
      where id=(select id from public.catalog_spec_fields order by id limit 1);
    update public.catalog_category_spec_fields set is_active=false
      where (category_id,spec_field_id)=(select category_id,spec_field_id from public.catalog_category_spec_fields order by category_id,spec_field_id limit 1);
    update public.catalog_navigation_items set is_active=false
      where id=(select id from public.catalog_navigation_items order by id limit 1);
  `);
  before = [];
  for (const [role, id] of identities) before.push(await visibility(role, id));
  // Hallitun Supabasen tapahtumatriggeri ei kuulu sovelluksen vanhaan ketjuun.
  // Lisää vastaava aito tapahtumatriggeri, jotta oikeuden poisto ja DDL-toiminta voidaan testata yhdessä.
  await db.exec(`
    create function public.rls_auto_enable() returns event_trigger language plpgsql
      security definer set search_path='pg_catalog' as $$
    declare cmd record;
    begin
      for cmd in select * from pg_event_trigger_ddl_commands()
        where command_tag='CREATE TABLE' and schema_name='public' and object_type='table'
      loop
        execute format('alter table %s enable row level security',cmd.object_identity);
      end loop;
    end;
    $$;
    grant execute on function public.rls_auto_enable() to anon,authenticated;
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
  `);
  await db.exec(await readFile(new URL(target, directory), "utf8"));
}, 120000);

afterAll(async () => {
  await db?.close();
});

async function asRole(role: "anon" | "authenticated", id: string | null, sql: string) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? ""]);
    return tx.query(sql);
  });
}
async function visibility(role: "anon" | "authenticated", id: string | null) {
  const result: Record<string, unknown[]> = {};
  for (const table of tables) {
    result[table] = (
      await asRole(role, id, `select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`)
    ).rows;
  }
  return result;
}

describe("advisor hardening", () => {
  it.each(identities)("preserves exact catalog visibility for %s / %s", async (role, id) => {
    const index = identities.findIndex(([r, user]) => r === role && user === id);
    const after = await visibility(role, id);
    expect(after).toEqual(before[index]);
    if (id === adminId) {
      for (const table of tables) expect(after[table].length).toBeGreaterThan(before[2][table].length);
    }
  });

  it("stops admin visibility immediately when the protected role is revoked", async () => {
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    try {
      expect(await visibility("authenticated", adminId)).toEqual(before[2]);
    } finally {
      await db.query("insert into public.user_roles (user_id,role) values ($1,'admin')", [adminId]);
    }
  });

  it("keeps direct catalog writes denied even for an admin", async () => {
    for (const [, id] of identities) {
      await expect(
        asRole("authenticated", id, "update public.catalog_product_models set is_active=true where false"),
      ).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("keeps restricted tables inaccessible and admin RPCs protected", async () => {
    for (const [role, id] of identities.filter(([, id]) => id !== adminId)) {
      for (const table of ["user_roles", "reports", "marketplace_settings"]) {
        await expect(asRole(role, id, `select * from public.${table}`)).rejects.toMatchObject({ code: "42501" });
      }
      await expect(asRole(role, id, "select public.get_admin_overview()")).rejects.toMatchObject({ code: "42501" });
    }
    expect((await asRole("authenticated", adminId, "select public.is_current_user_admin() as allowed")).rows).toEqual([
      { allowed: true },
    ]);
  });

  it("covers the reported foreign keys with valid full leading-column indexes", async () => {
    const uncovered = await db.query(`
      select c.conname from pg_constraint c
      where c.contype='f' and c.connamespace='public'::regnamespace
        and c.conname in (
          'catalog_admin_changes_changed_by_fkey','catalog_category_brands_brand_id_fkey',
          'catalog_category_spec_fields_spec_field_id_fkey','legal_pages_updated_by_fkey',
          'listing_shipping_countries_country_code_fkey','listings_category_catalog_fk',
          'marketplace_setting_changes_setting_id_fkey','orders_buyer_country_code_fkey',
          'orders_seller_country_code_fkey','profiles_country_code_fkey',
          'reports_listing_id_fkey','reviews_reviewer_id_fkey','reviews_subject_id_fkey'
        ) and not exists (
          select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
            and i.indpred is null and i.indexprs is null and i.indkey[0]=c.conkey[1]
        )
    `);
    expect(uncovered.rows).toEqual([]);
  });

  it("removes browser execution while keeping automatic RLS on new tables", async () => {
    const result = await db.query(`select
      has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon,
      has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as signed_in,
      has_function_privilege(current_user,'public.rls_auto_enable()','EXECUTE') as owner`);
    expect(result.rows).toEqual([{ anon: false, signed_in: false, owner: true }]);
    await db.exec("create table public.advisor_trigger_probe(id integer)");
    expect(
      (await db.query("select relrowsecurity from pg_class where oid='public.advisor_trigger_probe'::regclass")).rows,
    ).toEqual([{ relrowsecurity: true }]);
    await db.exec("drop table public.advisor_trigger_probe");
  });
});
