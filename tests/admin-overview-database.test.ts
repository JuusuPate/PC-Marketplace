import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const adminId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  // Supabase supplies these schemas/roles; application tables and functions below
  // are installed from the actual, unmodified migration chain.
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
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
  }
}, 30000);

beforeEach(async () => {
  await db.exec("truncate auth.users cascade;");
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'admin@example.test', '{}'), ($2, 'user@example.test', '{\"role\":\"admin\"}')",
    [adminId, userId],
  );
  await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [adminId]);
});

afterAll(async () => {
  await db?.close();
});

async function asRole(
  role: "anon" | "authenticated" | "service_role",
  id: string | null,
  sql = "select public.get_admin_overview() as overview",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role};`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ""]);
    return tx.query(sql);
  });
}

async function listing(status = "active", market = "FI", currency = "EUR") {
  const result = await db.query<{ id: string }>(
    `insert into public.listings
    (seller_id, market_country_code, title, description, category, condition, price_minor, currency, city, status)
    values ($1, $2, 'Test gaming PC', 'A sufficiently detailed test description.', 'pc', 'good', 12500, $3, 'Mikkeli', $4::public.listing_status)
    returning id`,
    [adminId, market, currency, status],
  );
  return result.rows[0].id;
}

async function order(status: string, price: number, fee: number, currency = "EUR") {
  const listingId = await listing();
  await db.query(
    `insert into public.orders
    (listing_id, buyer_id, seller_id, buyer_country_code, seller_country_code, item_price_minor, marketplace_fee_minor,
      payment_processing_minor, shipping_minor, total_minor, currency, payment_provider, status)
    values ($1, $2, $3, 'FI', 'FI', $4, $5, 100, 500, $4::bigint + $5::bigint + 600, $6, 'test', $7::public.order_status)`,
    [listingId, userId, adminId, price, fee, currency, status],
  );
}

describe("admin aggregate authorization in PostgreSQL", () => {
  it("rejects anon even with an admin UUID", async () => {
    await expect(asRole("anon", adminId)).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects an authenticated role without a signed-in identity", async () => {
    await expect(asRole("authenticated", null)).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects regular users including forged admin metadata", async () => {
    await expect(asRole("authenticated", userId)).rejects.toMatchObject({ code: "42501" });
  });

  it("requires an admin identity even for service_role", async () => {
    await expect(asRole("service_role", null)).rejects.toMatchObject({ code: "42501" });
  });

  it("applies role revocation on the next request", async () => {
    await expect(asRole("authenticated", adminId)).resolves.toBeDefined();
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(asRole("authenticated", adminId)).rejects.toMatchObject({ code: "42501" });
  });

  it("does not grant raw report reads or role assignment to an admin browser", async () => {
    await expect(asRole("authenticated", adminId, "select * from public.reports")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      asRole("authenticated", userId, `insert into public.user_roles (user_id, role) values ('${userId}', 'admin')`),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("admin overview database metrics", () => {
  it("returns actual zeros for tables without listings, orders or reports", async () => {
    const result = await asRole("authenticated", adminId);
    expect(result.rows[0].overview).toMatchObject({
      market: "FI",
      currency: "EUR",
      users: { total: 2, new_last_7_days: 2 },
      listings: { total: 0, active: 0, draft: 0, reserved: 0, sold: 0, removed: 0 },
      orders: { total: 0, completed: 0, disputed: 0, completed_item_value_minor: 0, completed_fees_minor: 0 },
      reports: { unresolved: 0 },
    });
  });

  it("counts all listing states, recent profiles and unresolved Finnish reports", async () => {
    await db.query("update public.profiles set joined_at = now() - interval '8 days' where id = $1", [adminId]);
    for (const status of ["active", "draft", "reserved", "sold", "removed"]) await listing(status);
    // Seed a valid legacy Nordic draft without disabling application constraints.
    await db.exec(`insert into public.catalog_market_categories (category_id, market_country_code, is_enabled)
      select id, 'SE', true from public.catalog_categories where slug = 'pc'
      on conflict (category_id, market_country_code) do update set is_enabled = true;`);
    const foreignListing = await listing("draft", "SE", "SEK");
    const localListing = await listing("active");
    await db.query(
      `insert into public.reports (reporter_id, listing_id, reason, resolved_at)
      values ($1, $2, 'test', null), ($1, $2, 'resolved', now()), ($1, $3, 'foreign', null)`,
      [userId, localListing, foreignListing],
    );
    const result = await asRole("authenticated", adminId);
    expect(result.rows[0].overview).toMatchObject({
      users: { total: 2, new_last_7_days: 1 },
      listings: { total: 6, active: 2, draft: 1, reserved: 1, sold: 1, removed: 1 },
      reports: { unresolved: 1 },
    });
  });

  it("sums item values and fees from completed EUR orders only", async () => {
    await order("completed", 12500, 250);
    await order("completed", 7500, 150);
    for (const status of ["pending_payment", "paid", "disputed", "refunded", "cancelled"])
      await order(status, 99900, 1998);
    await order("completed", 99900, 1998, "SEK");
    const result = await asRole("authenticated", adminId);
    expect(result.rows[0].overview).toMatchObject({
      orders: {
        total: 7,
        completed: 2,
        disputed: 1,
        completed_item_value_minor: 20000,
        completed_fees_minor: 400,
      },
    });
    expect(JSON.stringify(result.rows[0].overview)).not.toContain("example.test");
    expect(JSON.stringify(result.rows[0].overview)).not.toContain(adminId);
  });
});
