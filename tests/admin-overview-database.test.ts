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

describe("admin transaction directory", () => {
  const directory = (search = "", status = "", page = 0) =>
    asRole(
      "authenticated",
      adminId,
      `select public.get_admin_transactions('${search.replaceAll("'", "''")}', '${status.replaceAll("'", "''")}', ${page}) as directory`,
    );
  it("rejects anonymous, regular, absent and revoked admin identities", async () => {
    for (const [role, identity] of [
      ["anon", adminId],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, "select public.get_admin_transactions()")).rejects.toMatchObject({
        code: "42501",
      });
    await directory();
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(directory()).rejects.toMatchObject({ code: "42501" });
  });
  it("returns a genuine empty page without demo orders", async () => {
    expect((await directory()).rows[0].directory).toMatchObject({
      market: "FI",
      currency: "EUR",
      total: 0,
      transactions: [],
    });
  });
  it("filters every state and preserves the stored monetary breakdown", async () => {
    const statuses = [
      "pending_payment",
      "paid",
      "shipped",
      "delivered",
      "inspection",
      "disputed",
      "completed",
      "refunded",
      "cancelled",
    ];
    for (const status of statuses) await order(status, 12599, 251);
    expect((await directory()).rows[0].directory).toMatchObject({ total: 9 });
    for (const status of statuses) {
      const data = (await directory("", status)).rows[0].directory as { transactions: Array<Record<string, unknown>> };
      expect(data).toMatchObject({
        total: 1,
        transactions: [
          {
            status,
            item_price_minor: 12599,
            marketplace_fee_minor: 251,
            payment_processing_minor: 100,
            shipping_minor: 500,
            total_minor: 13450,
          },
        ],
      });
      expect(Object.keys(data.transactions[0]).sort()).toEqual(
        [
          "id",
          "listing_id",
          "title",
          "buyer_id",
          "buyer_name",
          "seller_id",
          "seller_name",
          "status",
          "item_price_minor",
          "marketplace_fee_minor",
          "payment_processing_minor",
          "shipping_minor",
          "total_minor",
          "created_at",
        ].sort(),
      );
    }
  });
  it("excludes non-EUR and non-Finnish buyers, sellers and listings", async () => {
    await order("completed", 1000, 20, "SEK");
    await order("paid", 1000, 20);
    await db.exec("update public.orders set buyer_country_code = 'SE' where status = 'paid'");
    await order("shipped", 1000, 20);
    await db.exec("update public.orders set seller_country_code = 'SE' where status = 'shipped'");
    await order("refunded", 1000, 20);
    await db.exec(`insert into public.catalog_market_categories (category_id, market_country_code, is_enabled)
      select id, 'SE', true from public.catalog_categories where slug = 'pc'
      on conflict (category_id, market_country_code) do update set is_enabled = true;`);
    const foreignId = await listing("draft", "SE", "SEK");
    await db.query("update public.orders set listing_id = $1 where status = 'refunded'", [foreignId]);
    await order("cancelled", 1000, 20);
    expect((await directory()).rows[0].directory).toMatchObject({ total: 1, transactions: [{ status: "cancelled" }] });
  });
  it("searches literal titles and exact order, listing, buyer and seller identifiers", async () => {
    await order("paid", 1000, 0);
    const row = (await db.query<{ id: string; listing_id: string }>("select id, listing_id from public.orders"))
      .rows[0];
    await db.query("update public.listings set title = 'Special 100%_PC' where id = $1", [row.listing_id]);
    for (const search of ["special", "%_", row.id.toUpperCase(), row.listing_id, userId, adminId])
      expect((await directory(search)).rows[0].directory).toMatchObject({ total: 1, transactions: [{ id: row.id }] });
    expect((await directory("absent")).rows[0].directory).toMatchObject({ total: 0, transactions: [] });
    expect((await directory("special", "completed")).rows[0].directory).toMatchObject({ total: 0 });
  });
  it("uses deterministic bounded pagination", async () => {
    for (let i = 0; i < 27; i++) await order("paid", 1000, 0);
    await db.exec("update public.orders set created_at = '2026-01-01'");
    const first = (await directory()).rows[0].directory as { transactions: Array<{ id: string }> };
    const second = (await directory("", "", 1)).rows[0].directory as { transactions: Array<{ id: string }> };
    expect(first).toMatchObject({ total: 27 });
    expect(first.transactions).toHaveLength(25);
    expect(second.transactions).toHaveLength(2);
    const ids = [...first.transactions, ...second.transactions].map((row) => row.id);
    expect(new Set(ids).size).toBe(27);
    expect(ids).toEqual([...ids].sort());
    expect((await directory("", "", 2)).rows[0].directory).toMatchObject({ total: 27, transactions: [] });
  });
  it("bounds inputs at the database boundary", async () => {
    for (const args of [
      "'', '', -1",
      "'', '', 1000001",
      "'', '', null",
      "null, '', 0",
      "repeat('x', 101), '', 0",
      "'', null, 0",
      "'', 'unknown', 0",
    ])
      await expect(
        asRole("authenticated", adminId, `select public.get_admin_transactions(${args})`),
      ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("admin revenue", () => {
  const revenue = (year = 2026) =>
    asRole("authenticated", adminId, `select public.get_admin_revenue(${year}) as revenue`);
  it("denies anonymous, regular, absent and revoked identities", async () => {
    for (const [role, id] of [
      ["anon", adminId],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, id, "select public.get_admin_revenue(2026)")).rejects.toMatchObject({ code: "42501" });
    await revenue();
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(revenue()).rejects.toMatchObject({ code: "42501" });
  });
  it("returns twelve zero months for an empty year", async () => {
    const data = (await revenue()).rows[0].revenue as { months: Array<{ month: number }> };
    expect(data).toMatchObject({
      year: 2026,
      timezone: "Europe/Helsinki",
      date_basis: "order_created_at",
      totals: { completed_orders: 0, item_value_minor: 0, fees_minor: 0 },
    });
    expect(data.months.map((r) => r.month)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const row of data.months)
      expect(row).toMatchObject({ completed_orders: 0, item_value_minor: 0, fees_minor: 0 });
  });
  it("matches Overview and excludes non-completed states and non-EUR orders", async () => {
    await order("completed", 12599, 251);
    await order("completed", 7500, 0);
    for (const status of [
      "pending_payment",
      "paid",
      "shipped",
      "delivered",
      "inspection",
      "disputed",
      "refunded",
      "cancelled",
    ])
      await order(status, 99999, 999);
    await order("completed", 99999, 999, "SEK");
    await db.exec("update public.orders set created_at='2026-02-10T10:00:00Z'");
    const data = (await revenue()).rows[0].revenue as { months: Array<unknown>; totals: unknown };
    expect(data.totals).toEqual({ completed_orders: 2, item_value_minor: 20099, fees_minor: 251 });
    expect(data.months[1]).toMatchObject({ month: 2, completed_orders: 2, item_value_minor: 20099, fees_minor: 251 });
    expect((await asRole("authenticated", adminId)).rows[0].overview).toMatchObject({
      orders: { completed: 2, completed_item_value_minor: 20099, completed_fees_minor: 251 },
    });
  });
  it("uses Helsinki half-open year and month boundaries independent of session timezone", async () => {
    const dates = [
      "2025-12-31T21:59:59Z",
      "2025-12-31T22:00:00Z",
      "2026-01-31T21:59:59Z",
      "2026-01-31T22:00:00Z",
      "2026-03-31T20:59:59Z",
      "2026-03-31T21:00:00Z",
      "2026-12-31T21:59:59Z",
      "2026-12-31T22:00:00Z",
    ];
    for (let i = 0; i < dates.length; i++) {
      await order("completed", 1000 + i, 10 + i);
      await db.query("update public.orders set created_at=$1 where item_price_minor=$2", [dates[i], 1000 + i]);
    }
    const data = (await revenue()).rows[0].revenue as { months: Array<{ completed_orders: number }> };
    expect(data).toMatchObject({ totals: { completed_orders: 6 } });
    expect(data.months.map((r) => r.completed_orders)).toEqual([2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
    await db.exec("set timezone='America/New_York'");
    expect((await revenue()).rows[0].revenue).toMatchObject({ months: data.months });
    await db.exec("set timezone='UTC'");
  });
  it("excludes foreign buyers, sellers and listing markets", async () => {
    await order("completed", 1000, 10);
    await order("completed", 2000, 20);
    await order("completed", 3000, 30);
    await db.exec(
      "update public.orders set created_at='2026-01-15'; update public.orders set buyer_country_code='SE' where item_price_minor=1000; update public.orders set seller_country_code='SE' where item_price_minor=2000;",
    );
    await db.exec(
      `insert into public.catalog_market_categories (category_id, market_country_code, is_enabled) select id,'SE',true from public.catalog_categories where slug='pc' on conflict (category_id,market_country_code) do update set is_enabled=true;`,
    );
    const foreignId = await listing("draft", "SE", "SEK");
    await db.query("update public.orders set listing_id=$1 where item_price_minor=3000", [foreignId]);
    expect((await revenue()).rows[0].revenue).toMatchObject({
      totals: { completed_orders: 0, item_value_minor: 0, fees_minor: 0 },
    });
  });
  it("removes refunded orders on the next request", async () => {
    await order("completed", 1000, 20);
    await db.exec("update public.orders set created_at='2026-01-01'");
    expect((await revenue()).rows[0].revenue).toMatchObject({ totals: { completed_orders: 1 } });
    await db.exec("update public.orders set status='refunded'");
    expect((await revenue()).rows[0].revenue).toMatchObject({ totals: { completed_orders: 0, fees_minor: 0 } });
  });
  it("rejects invalid year boundaries", async () => {
    for (const value of ["null", "1999", "2101"])
      await expect(asRole("authenticated", adminId, `select public.get_admin_revenue(${value})`)).rejects.toMatchObject(
        { code: "22023" },
      );
    for (const year of [2000, 2100]) await expect(revenue(year)).resolves.toBeDefined();
  });
});

describe("admin market data", () => {
  const sql = "select public.get_admin_market_data() as data";
  async function data() {
    return (await asRole("authenticated", adminId, sql)).rows[0].data as any;
  }
  it.each([
    ["anon", adminId],
    ["authenticated", null],
    ["authenticated", userId],
    ["service_role", null],
  ] as const)("denies %s with identity %s", async (role, id) => {
    await expect(asRole(role, id, sql)).rejects.toMatchObject({ code: "42501" });
  });
  it("enforces revoked roles on refresh", async () => {
    await data();
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(data()).rejects.toMatchObject({ code: "42501" });
  });
  it("returns catalog categories with zero samples and null prices", async () => {
    const result = await data();
    expect(result).toMatchObject({ market: "FI", currency: "EUR", period: "all_time" });
    expect(result.categories.length).toBeGreaterThan(0);
    expect(
      result.categories.every(
        (c: any) =>
          c.active_listings === 0 &&
          c.completed_orders === 0 &&
          c.asking_average_minor === null &&
          c.sold_average_minor === null,
      ),
    ).toBe(true);
    expect(result.categories.some((c: any) => c.slug === "components")).toBe(false);
  });
  it("keeps listing and order samples independent and rounds half cents", async () => {
    const id = await listing();
    await order("completed", 10000, 100);
    await order("completed", 10001, 900);
    await db.query("update public.listings set price_minor = 50000 where id = $1", [id]);
    const row = (await data()).categories.find((c: any) => c.slug === "pc");
    expect(row).toMatchObject({
      active_listings: 3,
      asking_average_minor: 25000,
      completed_orders: 2,
      sold_average_minor: 10001,
    });
  });
  it("excludes inactive asks, foreign markets/currencies and noncompleted orders", async () => {
    for (const state of ["draft", "reserved", "sold", "removed"]) await listing(state);
    await listing("draft", "SE", "EUR");
    await listing("draft", "FI", "SEK");
    for (const state of [
      "pending_payment",
      "paid",
      "shipped",
      "delivered",
      "inspection",
      "disputed",
      "cancelled",
      "refunded",
    ])
      await order(state, 111, 0);
    await order("completed", 333, 0, "SEK");
    const row = (await data()).categories.find((c: any) => c.slug === "pc");
    expect(row).toMatchObject({ active_listings: 9, completed_orders: 0, sold_average_minor: null });
  });
  it("requires FI buyer, seller and listing and removes refunded sales", async () => {
    await order("completed", 12599, 200);
    expect((await data()).categories.find((c: any) => c.slug === "pc").sold_average_minor).toBe(12599);
    for (const column of ["buyer_country_code", "seller_country_code"]) {
      await db.exec(`update public.orders set ${column} = 'SE'`);
      expect((await data()).categories.find((c: any) => c.slug === "pc").completed_orders).toBe(0);
      await db.exec(`update public.orders set ${column} = 'FI'`);
    }
    await db.exec("update public.listings set status = 'draft', market_country_code = 'SE'");
    expect((await data()).categories.find((c: any) => c.slug === "pc").completed_orders).toBe(0);
    await db.exec(
      "update public.listings set market_country_code = 'FI'; update public.orders set status = 'refunded'",
    );
    expect((await data()).categories.find((c: any) => c.slug === "pc").sold_average_minor).toBeNull();
  });
  it("retains historical data for disabled catalog categories without personal fields", async () => {
    await order("completed", 12345, 100);
    await db.exec(
      "update public.catalog_market_categories set is_enabled = false where category_id = (select id from public.catalog_categories where slug = 'pc')",
    );
    try {
      const row = (await data()).categories.find((c: any) => c.slug === "pc");
      expect(row.completed_orders).toBe(1);
      expect(Object.keys(row).sort()).toEqual(
        ["slug", "labels", "active_listings", "asking_average_minor", "completed_orders", "sold_average_minor"].sort(),
      );
    } finally {
      await db.exec(
        "update public.catalog_market_categories set is_enabled = true where category_id = (select id from public.catalog_categories where slug = 'pc')",
      );
    }
  });
});
