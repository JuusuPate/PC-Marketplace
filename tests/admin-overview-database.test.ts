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
  await db.exec("truncate public.marketing_announcement_changes, public.marketing_announcements cascade;");
  await db.exec("truncate public.marketplace_setting_changes;");
  await db.exec("update public.marketplace_settings set enabled = true, version = 1, updated_by = null;");
  await db.exec("truncate auth.users cascade;");
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'admin@example.test', '{}'), ($2, 'user@example.test', '{\"role\":\"admin\"}')",
    [adminId, userId],
  );
  await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [adminId]);
});

describe("listing creation setting", () => {
  const read = "select public.get_admin_listing_creation_setting() as setting";
  const save = (enabled: string, version: string) =>
    `select public.save_admin_listing_creation_setting(${enabled}, ${version}) as setting`;
  const draft =
    "select public.create_listing_draft('FI','A valid title','A sufficiently long description','gpu','good',12345,'EUR','Mikkeli','{}',array['FI'],null) as id";

  it("exposes only a public boolean and keeps admin reads and writes protected", async () => {
    expect((await asRole("anon", null, "select public.get_listing_creation_enabled() as enabled")).rows[0]).toEqual({
      enabled: true,
    });
    for (const [role, identity] of [
      ["anon", null],
      ["authenticated", null],
      ["authenticated", userId],
      ["service_role", null],
    ] as const) {
      await expect(asRole(role, identity, read)).rejects.toMatchObject({ code: "42501" });
      await expect(asRole(role, identity, save("false", "1"))).rejects.toMatchObject({ code: "42501" });
    }
    await expect(asRole("authenticated", userId, "select * from public.marketplace_settings")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      asRole("authenticated", userId, "select * from public.marketplace_setting_changes"),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await asRole("authenticated", adminId, read)).rows[0].setting).toMatchObject({
      enabled: true,
      version: 1,
    });
  });

  it("blocks new drafts and publication during a pause but preserves existing listings", async () => {
    const draftId = (await asRole("authenticated", userId, draft)).rows[0].id;
    const activeId = await listing();
    const hiddenId = await listing("removed");
    const paused = (await asRole("authenticated", adminId, save("false", "1"))).rows[0].setting as any;
    expect(paused).toMatchObject({ enabled: false, version: 2 });
    expect((await asRole("anon", null, "select public.get_listing_creation_enabled() as enabled")).rows[0]).toEqual({
      enabled: false,
    });
    await expect(asRole("authenticated", userId, draft)).rejects.toMatchObject({ code: "P0001" });
    await expect(
      asRole("authenticated", userId, `select public.publish_listing_draft('${draftId}')`),
    ).rejects.toMatchObject({ code: "P0001" });
    await db.query("update public.listings set title='Edited existing listing' where id=$1", [activeId]);
    await db.query("update public.listings set status='active' where id=$1", [hiddenId]);
    expect((await db.query("select status from public.listings where id=$1", [draftId])).rows[0]).toMatchObject({
      status: "draft",
    });
    await asRole("authenticated", adminId, save("true", "2"));
    await asRole("authenticated", userId, `select public.publish_listing_draft('${draftId}')`);
    expect((await db.query("select status from public.listings where id=$1", [draftId])).rows[0]).toMatchObject({
      status: "active",
    });
    const audit = (await asRole("authenticated", adminId, "select public.get_admin_audit('listing_creation') as data"))
      .rows[0].data as any;
    expect(audit.events).toMatchObject([
      { source: "settings", target_type: "listing_creation", action: "update" },
      { source: "settings", target_type: "listing_creation", action: "update" },
    ]);
  });

  it("rejects stale, invalid and revoked writes without changing the setting", async () => {
    await expect(asRole("authenticated", adminId, save("null", "1"))).rejects.toMatchObject({ code: "22023" });
    await expect(asRole("authenticated", adminId, save("false", "0"))).rejects.toMatchObject({ code: "22023" });
    await asRole("authenticated", adminId, save("false", "1"));
    await expect(asRole("authenticated", adminId, save("true", "1"))).rejects.toMatchObject({ code: "40001" });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(asRole("authenticated", adminId, save("true", "2"))).rejects.toMatchObject({ code: "42501" });
    expect((await asRole("anon", null, "select public.get_listing_creation_enabled() as enabled")).rows[0]).toEqual({
      enabled: false,
    });
    expect((await db.query("select count(*)::int as total from public.marketplace_setting_changes")).rows[0]).toEqual({
      total: 1,
    });
  });
});

afterAll(async () => {
  await db?.close();
});

describe("admin detail authorization", () => {
  it("limits details to admins and returns real order/shipment and user records", async () => {
    await order("completed", 10000, 500);
    const orderId = (await db.query<{ id: string }>("select id from public.orders")).rows[0].id;
    const sql = `select public.get_admin_order_detail('${orderId}') as data`;
    const userSql = `select public.get_admin_user_detail('${userId}') as data`;
    for (const query of [sql, userSql]) {
      for (const [role, identity] of [
        ["anon", null],
        ["authenticated", null],
        ["authenticated", userId],
        ["service_role", null],
      ] as const)
        await expect(asRole(role, identity, query)).rejects.toMatchObject({ code: "42501" });
    }
    const user = (await asRole("authenticated", adminId, userSql)).rows[0].data as any;
    expect(user).toMatchObject({
      email: "user@example.test",
      listings: 0,
      sales: 0,
      purchases: 1,
      disputes: 0,
      orders_total: 1,
    });
    expect(user.orders[0]).toMatchObject({ id: orderId, direction: "purchase", item_price_minor: 10000 });
    const empty = (await asRole("authenticated", adminId, sql)).rows[0].data as any;
    expect(empty).toMatchObject({ id: orderId, shipment: null, inspection_deadline: null, payment_reference: null });
    await db.query(
      "insert into public.shipments(order_id,carrier,tracking_code,shipped_at) values($1,'Test carrier','TRACK123',now())",
      [orderId],
    );
    const shipped = (await asRole("authenticated", adminId, sql)).rows[0].data as any;
    expect(shipped.shipment).toMatchObject({ carrier: "Test carrier", tracking_code: "TRACK123", delivered_at: null });
    expect(shipped.shipment.shipped_at).toEqual(expect.any(String));
    expect(JSON.stringify(shipped)).not.toContain("pickup");
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    for (const query of [sql, userSql])
      await expect(asRole("authenticated", adminId, query)).rejects.toMatchObject({ code: "42501" });
  });
  it("validates missing IDs and bounds user history to newest 25", async () => {
    for (const name of ["get_admin_order_detail", "get_admin_user_detail"]) {
      await expect(asRole("authenticated", adminId, `select public.${name}(null)`)).rejects.toMatchObject({
        code: "22023",
      });
      await expect(
        asRole("authenticated", adminId, `select public.${name}('00000000-0000-4000-8000-000000000099')`),
      ).rejects.toMatchObject({ code: "P0002" });
    }
    for (let i = 0; i < 26; i++) await order("completed", 10000, 500);
    const data = (await asRole("authenticated", adminId, `select public.get_admin_user_detail('${adminId}') as data`))
      .rows[0].data as any;
    expect(data.orders_total).toBe(26);
    expect(data.orders).toHaveLength(25);
    expect(data.sales).toBe(26);
  });
});

describe("admin activity and audit", () => {
  const activity = "select public.get_admin_activity('2025-02-01','2025-03-01') as data";
  it("denies anonymous, missing, forged and revoked identities", async () => {
    for (const sql of [activity, "select public.get_admin_audit()"])
      for (const [role, identity] of [
        ["anon", null],
        ["authenticated", null],
        ["authenticated", userId],
        ["service_role", null],
      ] as const)
        await expect(asRole(role, identity, sql)).rejects.toMatchObject({ code: "42501" });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    for (const sql of [activity, "select public.get_admin_audit()"])
      await expect(asRole("authenticated", adminId, sql)).rejects.toMatchObject({ code: "42501" });
  });
  it("uses half-open equal ranges and only FI/EUR completed amounts", async () => {
    await order("completed", 10000, 500);
    await order("refunded", 20000, 1000);
    await db.exec(
      "update public.orders set created_at='2025-02-01'; update public.listings set created_at='2025-02-01'; update public.profiles set joined_at='2025-02-01';",
    );
    const endId = await listing();
    await db.query("update public.listings set created_at='2025-03-01' where id=$1", [endId]);
    const previousId = await listing();
    await db.query("update public.listings set created_at='2025-01-31' where id=$1", [previousId]);
    const data = (await asRole("authenticated", adminId, activity)).rows[0].data as any;
    expect(data.current).toMatchObject({
      new_users: 2,
      new_listings: 2,
      orders: { total: 2, completed: 1, value_minor: 10000, fees_minor: 500 },
    });
    expect(data.previous).toMatchObject({ new_users: 0, new_listings: 1, orders: { total: 0, value_minor: 0 } });
    expect(Date.parse(data.current.start_at) - Date.parse(data.previous.start_at)).toBe(28 * 86400000);
  });
  it("rejects invalid ranges and audit paging", async () => {
    for (const args of [
      "null,now()",
      "now(),null",
      "now(),now()",
      "'infinity',now()",
      "now()-interval '367 days',now()",
      "now(),now()+interval '1 day'",
    ])
      await expect(asRole("authenticated", adminId, `select public.get_admin_activity(${args})`)).rejects.toMatchObject(
        { code: "22023" },
      );
    for (const args of ["null,0", "'',null", "'',-1", "'',1000001", `'${"x".repeat(101)}',0`])
      await expect(asRole("authenticated", adminId, `select public.get_admin_audit(${args})`)).rejects.toMatchObject({
        code: "22023",
      });
  });
  it("keeps equal elapsed duration across Helsinki daylight saving transitions", async () => {
    await db.exec("set timezone = 'Europe/Helsinki'");
    try {
      const data = (
        await asRole(
          "authenticated",
          adminId,
          "select public.get_admin_activity('2025-03-30T12:00:00Z','2025-03-31T12:00:00Z') as data",
        )
      ).rows[0].data as any;
      expect(Date.parse(data.previous.end_at) - Date.parse(data.previous.start_at)).toBe(86400000);
    } finally {
      await db.exec("set timezone = 'UTC'");
    }
  });
  it("shows both audit sources, filters literal IDs and cannot mutate evidence", async () => {
    const listingId = await listing();
    const reportId = (
      await db.query<{ id: string }>(
        "insert into public.reports(reporter_id,listing_id,reason) values($1,$2,'scam') returning id",
        [userId, listingId],
      )
    ).rows[0].id;
    await asRole(
      "authenticated",
      adminId,
      `select public.review_admin_report('${reportId}','resolve','Reviewed all evidence',0)`,
    );
    await db.query(
      "insert into public.catalog_admin_changes(entity_type,entity_id,action,after_data,changed_by) values('listing_featured',$1,'updated','{}',$2)",
      [listingId, adminId],
    );
    const all = (await asRole("authenticated", adminId, "select public.get_admin_audit() as data")).rows[0].data as any;
    expect(all.total).toBe(2);
    expect(all.events.map((e: any) => e.source).sort()).toEqual(["catalog", "report"]);
    const filtered = (await asRole("authenticated", adminId, `select public.get_admin_audit('${reportId}') as data`))
      .rows[0].data as any;
    expect(filtered.total).toBe(1);
    expect(filtered.events[0]).toMatchObject({
      actor_id: adminId,
      reason: "Reviewed all evidence",
      before_data: { resolved: false, version: 0 },
      after_data: { resolved: true, version: 1 },
    });
    expect(
      ((await asRole("authenticated", adminId, "select public.get_admin_audit('%') as data")).rows[0].data as any)
        .total,
    ).toBe(0);
    await expect(asRole("authenticated", adminId, "delete from public.catalog_admin_changes")).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("audited report decisions", () => {
  async function report() {
    const listingId = await listing();
    return (
      await db.query<{ id: string }>(
        "insert into public.reports(reporter_id,listing_id,reason) values($1,$2,'scam') returning id",
        [userId, listingId],
      )
    ).rows[0].id;
  }
  const decide = (id: string, action = "resolve", version = 0, note = "Checked the report") =>
    `select public.review_admin_report('${id}','${action}','${note}',${version})`;
  it("records both transitions, exposes the latest decision and rejects stale retries including ABA", async () => {
    const id = await report();
    await asRole("authenticated", adminId, decide(id));
    expect(
      (await db.query<any>("select resolved_at,review_version from public.reports where id=$1", [id])).rows[0],
    ).toMatchObject({ review_version: 1, resolved_at: expect.any(Date) });
    await expect(asRole("authenticated", adminId, decide(id))).rejects.toMatchObject({ code: "40001" });
    await asRole("authenticated", adminId, decide(id, "reopen", 1, "Review new evidence"));
    await expect(asRole("authenticated", adminId, decide(id))).rejects.toMatchObject({ code: "40001" });
    const rows = (
      await db.query<any>(
        "select actor_id,action,note,version from public.report_decisions where report_id=$1 order by version",
        [id],
      )
    ).rows;
    expect(rows).toEqual([
      { actor_id: adminId, action: "resolve", note: "Checked the report", version: 1 },
      { actor_id: adminId, action: "reopen", note: "Review new evidence", version: 2 },
    ]);
    const result = (await asRole("authenticated", adminId, "select public.get_admin_reports() as data")).rows[0]
      .data as any;
    expect(result.reports[0]).toMatchObject({
      resolved_at: null,
      review_version: 2,
      last_decision: { actor_id: adminId, action: "reopen", note: "Review new evidence" },
    });
    expect((await db.query<any>("select status from public.listings")).rows[0].status).toBe("active");
  });
  it("rejects unauthorized decisions and direct audit changes", async () => {
    const id = await report();
    for (const [role, identity] of [
      ["anon", null],
      ["authenticated", null],
      ["authenticated", userId],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, decide(id))).rejects.toMatchObject({ code: "42501" });
    for (const sql of [
      "select * from public.report_decisions",
      "delete from public.report_decisions",
      "update public.reports set resolved_at=now()",
    ])
      await expect(asRole("authenticated", adminId, sql)).rejects.toMatchObject({ code: "42501" });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(asRole("authenticated", adminId, decide(id))).rejects.toMatchObject({ code: "42501" });
    expect((await db.query<any>("select count(*)::int as n from public.report_decisions")).rows[0].n).toBe(0);
  });
  it("validates input, missing reports and current status without partial writes", async () => {
    const id = await report();
    for (const sql of [
      decide(id, "bad"),
      decide(id, "resolve", -1),
      decide(id, "resolve", 0, "short"),
      decide(id, "resolve", 0, "x".repeat(2001)),
      `select public.review_admin_report('${id}',null,'Checked the report',0)`,
      `select public.review_admin_report('${id}','resolve',null,0)`,
      `select public.review_admin_report('${id}','resolve','Checked the report',null)`,
    ])
      await expect(asRole("authenticated", adminId, sql)).rejects.toMatchObject({ code: "22023" });
    await expect(asRole("authenticated", adminId, decide(id, "reopen"))).rejects.toMatchObject({ code: "40001" });
    await expect(
      asRole("authenticated", adminId, decide("00000000-0000-4000-8000-000000000099")),
    ).rejects.toMatchObject({ code: "P0002" });
    expect((await db.query<any>("select count(*)::int as n from public.report_decisions")).rows[0].n).toBe(0);
  });
});

describe("admin report directory authorization", () => {
  const query = (search = "", status = "open", page = 0) =>
    `select public.get_admin_reports('${search.replaceAll("'", "''")}', '${status}', ${page}) as data`;

  it("rejects anonymous, missing, forged and revoked identities without table grants", async () => {
    for (const [role, id] of [
      ["anon", null],
      ["authenticated", null],
      ["authenticated", userId],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, id, query())).rejects.toMatchObject({ code: "42501" });
    await expect(asRole("authenticated", adminId, "select * from public.reports")).rejects.toMatchObject({
      code: "42501",
    });
    await db.query("delete from public.user_roles where user_id = $1", [adminId]);
    await expect(asRole("authenticated", adminId, query())).rejects.toMatchObject({ code: "42501" });
  });

  it("filters FI reports, pages stably and keeps details available only through the admin RPC", async () => {
    const listingId = await listing();
    const first = (
      await db.query<{ id: string }>(
        "insert into public.reports (reporter_id, listing_id, reason, details, created_at) values ($1, $2, 'scam', 'Needs review', '2026-09-21') returning id",
        [userId, listingId],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.reports (reporter_id, listing_id, reason, resolved_at, created_at) values ($1, $2, 'other', now(), '2026-09-22')",
      [userId, listingId],
    );
    const open = (await asRole("authenticated", adminId, query())).rows[0].data as any;
    expect(open).toMatchObject({ market: "FI", page: 0, page_size: 25, total: 1 });
    expect(open.reports[0]).toMatchObject({
      id: first,
      reporter_id: userId,
      listing_id: listingId,
      details: "Needs review",
    });
    const resolved = (await asRole("authenticated", adminId, query("", "resolved"))).rows[0].data as any;
    expect(resolved.total).toBe(1);
    expect(resolved.reports[0].resolved_at).not.toBeNull();
    expect(((await asRole("authenticated", adminId, query("", "", 1))).rows[0].data as any).reports).toEqual([]);
    expect(((await asRole("authenticated", adminId, query(first))).rows[0].data as any).total).toBe(1);
    expect(((await asRole("authenticated", adminId, query("%"))).rows[0].data as any).total).toBe(0);
  });

  it("rejects invalid filters and pages", async () => {
    for (const args of [
      "null, 'open', 0",
      "'', null, 0",
      "'', 'bad', 0",
      "'', 'open', -1",
      "'', 'open', 1000001",
      `'${"x".repeat(101)}', 'open', 0`,
    ])
      await expect(asRole("authenticated", adminId, `select public.get_admin_reports(${args})`)).rejects.toMatchObject({
        code: "22023",
      });
  });
});

describe("private own-report lookup", () => {
  it("returns only the caller's listing IDs without granting raw report reads", async () => {
    const mine = await listing();
    const theirs = await listing();
    await db.query(
      "insert into public.reports (reporter_id, listing_id, reason) values ($1, $2, 'scam'), ($3, $4, 'other')",
      [userId, mine, adminId, theirs],
    );
    const result = await asRole("authenticated", userId, "select listing_id from public.get_my_reported_listing_ids()");
    expect(result.rows).toEqual([{ listing_id: mine }]);
    await expect(asRole("authenticated", userId, "select * from public.reports")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(asRole("anon", null, "select * from public.get_my_reported_listing_ids()")).rejects.toMatchObject({
      code: "42501",
    });
  });
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

describe("admin dashboard trends", () => {
  const sql = (days: string) => `select public.get_admin_dashboard_trends(${days}) as data`;
  const read = async (days = "7") => (await asRole("authenticated", adminId, sql(days))).rows[0].data as any;

  it("allows only current admins and validates the five supported periods", async () => {
    for (const [role, identity] of [
      ["anon", adminId],
      ["authenticated", null],
      ["authenticated", userId],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, sql("7"))).rejects.toMatchObject({ code: "42501" });
    for (const days of ["null", "0", "8", "366"]) await expect(read(days)).rejects.toMatchObject({ code: "22023" });
    for (const days of [7, 30, 90, 180, 365]) {
      const data = await read(String(days));
      expect(data.buckets).toHaveLength(days);
      expect(data.buckets[0].day).toBe(data.start_date);
      expect(data.buckets[days - 1].day).toBe(data.end_date);
    }
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(read()).rejects.toMatchObject({ code: "42501" });
  });

  it("groups real FI/EUR events by Helsinki day and excludes refunded sales", async () => {
    const listingId = await listing();
    await order("completed", 12000, 240);
    await order("refunded", 99000, 990);
    await db.query("insert into public.reports (reporter_id, listing_id, reason) values ($1, $2, 'Other')", [
      userId,
      listingId,
    ]);
    const data = await read();
    expect(data).toMatchObject({ days: 7, market: "FI", currency: "EUR", timezone: "Europe/Helsinki" });
    expect(data.buckets.at(-1)).toMatchObject({
      users_new: 2,
      listings_new: 3,
      orders_new: 2,
      orders_completed: 1,
      item_value_minor: 12000,
      fees_minor: 240,
      reports_new: 1,
    });
    expect(data.categories.find((row: any) => row.slug === "pc")).toMatchObject({
      active_listings: 3,
      asking_average_minor: 12500,
      completed_orders: 1,
      sold_average_minor: 12000,
    });
    await db.exec("update public.orders set created_at = now() - interval '8 days' where status = 'completed'");
    const older = await read();
    expect(older.buckets.reduce((sum: number, row: any) => sum + row.orders_completed, 0)).toBe(0);
    expect(older.categories.find((row: any) => row.slug === "pc").sold_average_minor).toBeNull();
    await db.exec("set timezone='America/New_York'");
    try {
      expect((await read()).buckets.map((row: any) => row.day)).toEqual(older.buckets.map((row: any) => row.day));
    } finally {
      await db.exec("set timezone='UTC'");
    }
  });
});

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
        [
          "id",
          "title",
          "seller_id",
          "seller_name",
          "status",
          "price_minor",
          "created_at",
          "moderation_hidden",
          "moderation_version",
        ].sort(),
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

describe("listing moderation", () => {
  const decision = (id: string, action: "hide" | "restore", version: number, reason = "Reviewed listing evidence") =>
    `select public.moderate_admin_listing('${id}', '${action}', '${reason}', ${version})`;

  it("hides with a reason and restores without one while preserving the audit event", async () => {
    const id = await listing();
    await asRole("authenticated", adminId, decision(id, "hide", 0));
    expect(
      (await db.query("select status, moderation_hidden, moderation_version from public.listings where id=$1", [id]))
        .rows[0],
    ).toMatchObject({ status: "removed", moderation_hidden: true, moderation_version: 1 });
    expect(
      (await asRole("anon", null, `select count(*)::int as total from public.listings where id='${id}'`)).rows[0],
    ).toMatchObject({ total: 0 });
    const audit = (await asRole("authenticated", adminId, `select public.get_admin_audit('${id}', 0) as audit`)).rows[0]
      .audit as any;
    expect(audit.events).toMatchObject([{ source: "moderation", action: "hide", reason: "Reviewed listing evidence" }]);
    await expect(asRole("authenticated", adminId, decision(id, "restore", 0))).rejects.toMatchObject({ code: "40001" });
    await asRole("authenticated", adminId, decision(id, "restore", 1, ""));
    expect(
      (await db.query("select status, moderation_hidden, moderation_version from public.listings where id=$1", [id]))
        .rows[0],
    ).toMatchObject({ status: "active", moderation_hidden: false, moderation_version: 2 });
    expect(
      (
        await db.query(
          "select action, reason, version from public.listing_moderation_decisions where listing_id=$1 order by version",
          [id],
        )
      ).rows,
    ).toMatchObject([
      { action: "hide", reason: "Reviewed listing evidence", version: 1 },
      { action: "restore", reason: null, version: 2 },
    ]);
  });

  it("denies non-admin identities, revoked admin access, invalid decisions and manual removals", async () => {
    const id = await listing();
    for (const [role, identity] of [
      ["anon", adminId],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const)
      await expect(asRole(role, identity, decision(id, "hide", 0))).rejects.toMatchObject({ code: "42501" });
    for (const sql of [
      decision(id, "hide", 0, "short"),
      decision(id, "hide", 0, ""),
      `select public.moderate_admin_listing('${id}', 'delete', 'Long enough reason', 0)`,
    ])
      await expect(asRole("authenticated", adminId, sql)).rejects.toMatchObject({ code: "22023" });
    await db.query("update public.listings set status='removed' where id=$1", [id]);
    await expect(asRole("authenticated", adminId, decision(id, "restore", 0))).rejects.toMatchObject({ code: "40001" });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(asRole("authenticated", adminId, decision(id, "hide", 0))).rejects.toMatchObject({ code: "42501" });
    expect(
      (await db.query("select count(*)::int as total from public.listing_moderation_decisions")).rows[0],
    ).toMatchObject({ total: 0 });
  });

  it("does not hide a listing with an active order", async () => {
    await order("paid", 12500, 100);
    const id = (await db.query<{ listing_id: string }>("select listing_id from public.orders")).rows[0].listing_id;
    await expect(asRole("authenticated", adminId, decision(id, "hide", 0))).rejects.toMatchObject({ code: "23514" });
    expect(
      (await db.query("select status, moderation_version from public.listings where id=$1", [id])).rows[0],
    ).toMatchObject({ status: "active", moderation_version: 0 });
  });
});

describe("marketing announcements", () => {
  const save = (id: string | null, version: number | null, title = "Autumn hardware picks", published = false) =>
    `select public.save_admin_marketing_announcement(${id ? `'${id}'` : "null"}, 'fi', '${title}', 'Find the right components for your build.', ${published}, ${version ?? "null"})`;
  const publicAnnouncement = (locale = "fi") =>
    `select public.get_public_marketing_announcement('${locale}') as announcement`;

  it("keeps drafts private and publishes only the requested language", async () => {
    for (const [role, identity] of [
      ["anon", null],
      ["authenticated", null],
      ["authenticated", userId],
      ["service_role", null],
    ] as const) {
      await expect(asRole(role, identity, "select public.get_admin_marketing_announcements()")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(asRole(role, identity, save(null, null))).rejects.toMatchObject({ code: "42501" });
    }
    await asRole("authenticated", adminId, save(null, null));
    const row = (await db.query<{ id: string }>("select id from public.marketing_announcements")).rows[0];
    expect((await asRole("anon", null, publicAnnouncement())).rows[0].announcement).toBeNull();
    expect((await asRole("authenticated", userId, publicAnnouncement())).rows[0].announcement).toBeNull();
    await expect(asRole("anon", null, "select * from public.marketing_announcements")).rejects.toMatchObject({
      code: "42501",
    });
    await asRole("authenticated", adminId, save(row.id, 1, "Autumn hardware picks", true));
    expect((await asRole("anon", null, publicAnnouncement())).rows[0].announcement).toMatchObject({
      id: row.id,
      title: "Autumn hardware picks",
      body: "Find the right components for your build.",
    });
    expect((await asRole("anon", null, publicAnnouncement("sv"))).rows[0].announcement).toBeNull();
    expect(
      (await asRole("authenticated", adminId, "select public.get_admin_marketing_announcements() as data")).rows[0]
        .data,
    ).toMatchObject([{ id: row.id, is_published: true, version: 2 }]);
    const changes = (await db.query("select action from public.marketing_announcement_changes order by created_at"))
      .rows;
    expect(changes).toMatchObject([{ action: "create" }, { action: "update" }]);
    const audit = (await asRole("authenticated", adminId, `select public.get_admin_audit('${row.id}', 0) as data`))
      .rows[0].data;
    expect(audit.events).toMatchObject([
      { source: "marketing", target_type: "announcement", action: "update" },
      { source: "marketing", target_type: "announcement", action: "create" },
    ]);
  });

  it("rejects stale, malformed and revoked writes without changing published content", async () => {
    await asRole("authenticated", adminId, save(null, null, "Autumn hardware picks", true));
    const row = (await db.query<{ id: string }>("select id from public.marketing_announcements")).rows[0];
    await expect(asRole("authenticated", adminId, save(row.id, 2))).rejects.toMatchObject({ code: "40001" });
    await expect(asRole("authenticated", adminId, save(null, null, "x"))).rejects.toMatchObject({ code: "22023" });
    await expect(asRole("authenticated", adminId, publicAnnouncement("de"))).rejects.toMatchObject({
      code: "22023",
    });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(asRole("authenticated", adminId, save(row.id, 1))).rejects.toMatchObject({ code: "42501" });
    expect((await asRole("anon", null, publicAnnouncement())).rows[0].announcement).toMatchObject({
      title: "Autumn hardware picks",
    });
    expect(
      (await db.query("select count(*)::int as total from public.marketing_announcement_changes")).rows[0],
    ).toMatchObject({ total: 1 });
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

describe("product model catalog", () => {
  const search = (category = "gpu", query = "", page = 0) =>
    `select public.search_product_models('${category}','${query}',${page}) as data`;
  const market = (category = "gpu") => `select public.get_admin_model_market('${category}') as data`;
  const model = async (category = "gpu") =>
    (
      await db.query<any>("select * from public.catalog_product_models where category=$1 order by name limit 1", [
        category,
      ])
    ).rows[0];
  const save = (data: unknown) =>
    `select public.save_product_model('${JSON.stringify(data).replaceAll("'", "''")}'::jsonb) as id`;
  it("keeps at least three starter models in every launch category while allowing catalog growth", async () => {
    const rows = (
      await db.query<any>("select category,count(*)::integer as n from public.catalog_product_models group by category")
    ).rows;
    for (const category of [
      "gpu",
      "cpu",
      "motherboard",
      "memory",
      "psu",
      "storage",
      "case",
      "cooling",
      "pc",
      "other",
    ]) {
      expect(rows.find((row) => row.category === category)?.n).toBeGreaterThanOrEqual(3);
    }
    expect(
      (await db.query<any>("select distinct brand from public.catalog_product_models where category='cpu'")).rows
        .map((r) => r.brand)
        .sort(),
    ).toEqual(expect.arrayContaining(["AMD", "Intel"]));
    const amdGpus = (
      await db.query<{ name: string; variant: string }>(
        "select name, variant from public.catalog_product_models where category='gpu' and brand='AMD' order by name",
      )
    ).rows;
    expect(amdGpus).toEqual(
      expect.arrayContaining([
        { name: "Radeon RX 6800 XT", variant: "16 GB" },
        { name: "Radeon RX 6900 XT", variant: "16 GB" },
      ]),
    );
  });
  it("allows public literal and alias search with category isolation", async () => {
    // Dedicated fixtures keep search assertions independent of user-added models.
    const marker = "catalog-test-" + crypto.randomUUID();
    const fixture = (
      await db.query<{ id: string }>(
        "insert into public.catalog_product_models(category,brand,name,aliases) values('gpu','Test',$1,$2) returning id",
        [marker, marker + "%_"],
      )
    ).rows[0];
    try {
      const r = (await asRole("anon", null, search("gpu", marker + "%_"))).rows[0].data as any;
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe(fixture.id);
      expect(((await asRole("anon", null, search("cpu", marker))).rows[0].data as any).total).toBe(0);
      // A literal wildcard suffix must not behave as a SQL wildcard.
      expect(((await asRole("anon", null, search("gpu", marker + "%missing"))).rows[0].data as any).total).toBe(0);
      const first = (await asRole("anon", null, search("gpu"))).rows[0].data as any;
      const beyondLastPage = Math.ceil(first.total / 20);
      expect(((await asRole("anon", null, search("gpu", "", beyondLastPage))).rows[0].data as any).items).toEqual([]);
    } finally {
      await db.query("delete from public.catalog_product_models where id=$1", [fixture.id]);
    }
  });
  it("denies direct writes and non-admin catalog mutation/market access", async () => {
    for (const [role, id] of [
      ["anon", null],
      ["authenticated", userId],
      ["authenticated", null],
      ["service_role", null],
    ] as const) {
      await expect(asRole(role, id, save({ category: "cpu", brand: "X", name: "Y" }))).rejects.toMatchObject({
        code: "42501",
      });
      await expect(asRole(role, id, market())).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      asRole(
        "authenticated",
        adminId,
        "insert into public.catalog_product_models(category,brand,name) values('cpu','X','Y')",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("supports admin creation, edits, audit, duplicate prevention and optimistic concurrency", async () => {
    const payload = {
      category: "cpu",
      brand: "Test",
      name: "Catalog test",
      variant: "v1",
      aliases: "find-me",
      is_active: true,
    };
    const id = (await asRole("authenticated", adminId, save(payload))).rows[0].id;
    try {
      const row = (await db.query<any>("select * from public.catalog_product_models where id=$1", [id])).rows[0];
      await asRole("authenticated", adminId, save({ ...row, aliases: "updated" }));
      await expect(asRole("authenticated", adminId, save({ ...row, aliases: "stale" }))).rejects.toMatchObject({
        code: "40001",
      });
      await expect(
        asRole("authenticated", adminId, save({ ...payload, brand: " TEST ", name: "catalog TEST" })),
      ).rejects.toMatchObject({ code: "23505" });
      expect(
        (await db.query<any>("select count(*)::integer n from public.catalog_admin_changes where entity_id=$1", [id]))
          .rows[0].n,
      ).toBe(2);
      await expect(asRole("authenticated", adminId, save({ ...row, category: "gpu" }))).rejects.toMatchObject({
        code: "22023",
      });
    } finally {
      await db.query("delete from public.catalog_product_models where id=$1", [id]);
    }
  });
  it("binds model IDs atomically through create RPC and removes the reserved transport key", async () => {
    const m = await model();
    const result = await asRole(
      "authenticated",
      adminId,
      `select public.create_listing_draft('FI','A valid title','A sufficiently long description','gpu','good',12345,'EUR','Mikkeli','{"_catalog_model_id":"${m.id}","Model":"example"}',array['FI'],null) as id`,
    );
    const row = (
      await db.query<any>("select catalog_model_id,specs from public.listings where id=$1", [result.rows[0].id])
    ).rows[0];
    expect(row.catalog_model_id).toBe(m.id);
    expect(row.specs).toEqual({ Model: "example" });
  });
  it("rejects mismatched models and supports explicit unlink on editing", async () => {
    const id = await listing(),
      gpu = await model(),
      pc = await model("pc");
    await expect(
      db.query("update public.listings set specs=jsonb_build_object('_catalog_model_id',$1::text) where id=$2", [
        gpu.id,
        id,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await db.query("update public.listings set specs=jsonb_build_object('_catalog_model_id',$1::text) where id=$2", [
      pc.id,
      id,
    ]);
    await db.query("update public.listings set specs='{\"_catalog_model_id\":null}' where id=$1", [id]);
    expect(
      (await db.query<any>("select catalog_model_id from public.listings where id=$1", [id])).rows[0].catalog_model_id,
    ).toBeNull();
  });
  it("hides archived models but preserves existing references and model stats", async () => {
    const m = await model("pc");
    const id = await listing();
    await db.query("update public.listings set catalog_model_id=$1 where id=$2", [m.id, id]);
    await asRole("authenticated", adminId, save({ ...m, is_active: false }));
    try {
      expect(((await asRole("anon", null, search("pc", m.name))).rows[0].data as any).total).toBe(0);
      await db.query("update public.listings set status='sold' where id=$1", [id]);
      await expect(
        db.query("update public.listings set catalog_model_id=$1 where id=$2", [m.id, await listing()]),
      ).rejects.toMatchObject({ code: "22023" });
      expect(
        ((await asRole("authenticated", adminId, market("pc"))).rows[0].data as any).items.some(
          (r: any) => r.id === m.id,
        ),
      ).toBe(true);
    } finally {
      await db.query("update public.catalog_product_models set is_active=true where id=$1", [m.id]);
    }
  });
  it("separates models and counts only linked eligible samples using order prices", async () => {
    const m = await model("pc");
    await order("completed", 10001, 200);
    await order("refunded", 999999, 200);
    await listing();
    await db.query("update public.listings set catalog_model_id=$1 where id in(select listing_id from public.orders)", [
      m.id,
    ]);
    const r = (await asRole("authenticated", adminId, market("pc"))).rows[0].data as any;
    expect(r.unlinked_listings).toBe(1);
    expect(r.items.find((x: any) => x.id === m.id)).toMatchObject({
      active_listings: 2,
      asking_average_minor: 12500,
      completed_orders: 1,
      sold_average_minor: 10001,
    });
    expect(
      r.items
        .filter((x: any) => x.id !== m.id)
        .every((x: any) => x.completed_orders === 0 && x.sold_average_minor === null),
    ).toBe(true);
  });
  it("rechecks revocation and validates bounds and sellable categories", async () => {
    await expect(
      asRole("authenticated", adminId, save({ category: "components", brand: "X", name: "Y" })),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(asRole("anon", null, search("gpu", "", -1))).rejects.toMatchObject({ code: "22023" });
    await expect(asRole("anon", null, search("gpu", "a".repeat(101)))).rejects.toMatchObject({ code: "22023" });
    await db.query("delete from public.user_roles where user_id=$1", [adminId]);
    await expect(asRole("authenticated", adminId, market())).rejects.toMatchObject({ code: "42501" });
  });
});
