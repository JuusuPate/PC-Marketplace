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

describe("admin user directory", () => {
  const directory = (search = "", page = 0) =>
    asRole(
      "authenticated",
      adminId,
      `select public.get_admin_users('${search.replaceAll("'", "''")}', ${page}) as directory`,
    );

  it("rejects anonymous, regular, missing and revoked identities", async () => {
    for (const [role, identity] of [
      ["anon", adminId],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, "select public.get_admin_users()")).rejects.toMatchObject({ code: "42501" });
    await directory();
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(directory()).rejects.toMatchObject({ code: "42501" });
  });

  it("returns real profile fields and server roles without email or metadata", async () => {
    const result = await directory();
    const data = result.rows[0].directory as { users: Array<{ id: string; role: string }> };
    expect(data).toMatchObject({ market: "FI", page: 0, page_size: 25, total: 2 });
    expect(data.users.find((row) => row.id === adminId)?.role).toBe("admin");
    expect(data.users.find((row) => row.id === userId)?.role).toBe("user");
    for (const row of data.users)
      expect(Object.keys(row).sort()).toEqual(["id", "display_name", "locale", "joined_at", "role"].sort());
    expect(JSON.stringify(data)).not.toContain("example.test");
  });

  it("searches names literally and supports exact IDs in the Finland-only schema", async () => {
    await db.query("update public.profiles set display_name = 'Boss 100%_PC' where id = $1", [adminId]);
    await db.query("update public.profiles set country_code = 'SE' where id = $1", [userId]);
    expect((await directory("boss")).rows[0].directory).toMatchObject({ total: 1 });
    expect((await directory("%_")).rows[0].directory).toMatchObject({ total: 1 });
    expect((await directory(adminId)).rows[0].directory).toMatchObject({ total: 1 });
    expect((await directory(userId)).rows[0].directory).toMatchObject({ total: 1 });
    expect((await directory("missing")).rows[0].directory).toMatchObject({ total: 0, users: [] });
  });

  it("bounds pages and sorts tied dates without duplicates", async () => {
    await db.exec(`insert into auth.users (id, email) select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      'test' || i || '@example.test' from generate_series(3, 32) i;
      update public.profiles set joined_at = '2026-01-01';`);
    const first = (await directory()).rows[0].directory as { users: Array<{ id: string }> };
    const second = (await directory("", 1)).rows[0].directory as { users: Array<{ id: string }> };
    expect(first).toMatchObject({ total: 32 });
    expect(first.users).toHaveLength(25);
    expect(second.users).toHaveLength(7);
    expect(new Set([...first.users, ...second.users].map((row) => row.id)).size).toBe(32);
    expect(first.users[0].id).toBe(adminId);
    expect((await directory("", 2)).rows[0].directory).toMatchObject({ total: 32, users: [] });
  });

  it("rejects invalid inputs at the database boundary", async () => {
    for (const args of ["'', -1", "'', 1000001", "'', null", "null, 0", "repeat('a', 101), 0"])
      await expect(asRole("authenticated", adminId, `select public.get_admin_users(${args})`)).rejects.toMatchObject({
        code: "22023",
      });
  });
});

describe("admin listing directory", () => {
  const directory = (search = "", status = "", page = 0) =>
    asRole(
      "authenticated",
      adminId,
      `select public.get_admin_listings('${search.replaceAll("'", "''")}', '${status.replaceAll("'", "''")}', ${page}) as directory`,
    );

  it("rejects anonymous, ordinary, missing and revoked identities", async () => {
    for (const [role, identity] of [
      ["anon", adminId],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, "select public.get_admin_listings()")).rejects.toMatchObject({
        code: "42501",
      });
    await directory();
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(directory()).rejects.toMatchObject({ code: "42501" });
  });

  it("returns all states and filters FI/EUR without exposing private listing fields", async () => {
    for (const status of ["active", "draft", "reserved", "sold", "removed"]) await listing(status);
    await db.exec(`insert into public.catalog_market_categories (category_id, market_country_code, is_enabled)
      select id, 'SE', true from public.catalog_categories where slug = 'pc'
      on conflict (category_id, market_country_code) do update set is_enabled = true;`);
    await listing("draft", "SE", "SEK");
    const result = (await directory()).rows[0].directory as { listings: Array<Record<string, unknown>> };
    expect(result).toMatchObject({ market: "FI", currency: "EUR", total: 5, page_size: 25 });
    expect(result.listings).toHaveLength(5);
    for (const row of result.listings) {
      expect(Object.keys(row).sort()).toEqual(
        ["id", "title", "seller_id", "seller_name", "status", "price_minor", "created_at"].sort(),
      );
      expect(row.price_minor).toBe(12500);
    }
    for (const status of ["active", "draft", "reserved", "sold", "removed"])
      expect((await directory("", status)).rows[0].directory).toMatchObject({ total: 1, listings: [{ status }] });
  });

  it("searches titles literally and accepts listing and seller identifiers", async () => {
    const id = await listing();
    await db.query("update public.listings set title = 'Boss 100%_PC' where id = $1", [id]);
    await listing();
    for (const search of ["boss", "%_", id, id.toUpperCase()])
      expect((await directory(search)).rows[0].directory).toMatchObject({ total: 1, listings: [{ id }] });
    expect((await directory(adminId)).rows[0].directory).toMatchObject({ total: 2 });
    expect((await directory("missing")).rows[0].directory).toMatchObject({ total: 0, listings: [] });
    expect((await directory("boss", "sold")).rows[0].directory).toMatchObject({ total: 0, listings: [] });
  });

  it("paginates tied dates deterministically without duplicate listings", async () => {
    for (let i = 0; i < 27; i++) await listing();
    await db.exec("update public.listings set created_at = '2026-01-01'");
    const first = (await directory()).rows[0].directory as { listings: Array<{ id: string }> };
    const second = (await directory("", "", 1)).rows[0].directory as { listings: Array<{ id: string }> };
    expect(first).toMatchObject({ total: 27 });
    expect(first.listings).toHaveLength(25);
    expect(second.listings).toHaveLength(2);
    const ids = [...first.listings, ...second.listings].map((row) => row.id);
    expect(new Set(ids).size).toBe(27);
    expect(ids).toEqual([...ids].sort());
    expect((await directory("", "", 2)).rows[0].directory).toMatchObject({ total: 27, listings: [] });
  });

  it("rejects malformed parameters at the database boundary", async () => {
    for (const args of [
      "'', '', -1",
      "'', '', 1000001",
      "'', '', null",
      "null, '', 0",
      "repeat('x', 101), '', 0",
      "'', null, 0",
      "'', 'unknown', 0",
    ])
      await expect(asRole("authenticated", adminId, `select public.get_admin_listings(${args})`)).rejects.toMatchObject(
        { code: "22023" },
      );
  });
});
