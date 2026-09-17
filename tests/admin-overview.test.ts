import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdminOverviewPath, isAdminPath } from "../apps/web/src/config/admin-routes";
import { AdminDashboardPage, AdminOverviewPanel } from "../apps/web/src/features/admin/AdminDashboardPage";
import { AdminAccessError, adminService, parseAdminOverview } from "../apps/web/src/lib/admin-service";
import type { DemoUser } from "../apps/web/src/types";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));

function response() {
  return {
    generated_at: "2026-09-16T12:00:00Z",
    market: "FI",
    currency: "EUR",
    users: { total: 3, new_last_7_days: 1 },
    listings: { total: 5, active: 1, draft: 1, reserved: 1, sold: 1, removed: 1 },
    orders: { total: 2, completed: 1, disputed: 1, completed_item_value_minor: 12500, completed_fees_minor: 250 },
    reports: { unresolved: 1 },
  };
}

const admin: DemoUser = {
  id: "admin-id",
  name: "Admin",
  email: "admin@example.test",
  role: "admin",
  countryCode: "FI",
  locale: "fi",
};
const pageProps = { locale: "fi" as const, authLoading: false, overview: true, onLogin: vi.fn(), onNavigate: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe("admin routes", () => {
  it("protects the admin namespace and accepts trailing slashes", () => {
    for (const path of ["/admin", "/admin/", "/admin/users", "/admin/unknown/"]) expect(isAdminPath(path)).toBe(true);
    for (const path of ["/", "/administrator", "/admin-panel", "/kategoriat/kaikki"])
      expect(isAdminPath(path)).toBe(false);
    expect(isAdminOverviewPath("/admin/")).toBe(true);
    expect(isAdminOverviewPath("/admin/users")).toBe(false);
  });
});

describe("overview service", () => {
  it("loads only the protected aggregate RPC", async () => {
    mock.rpc.mockResolvedValue({ data: response(), error: null });
    expect(await adminService.getOverview()).toMatchObject({
      users: { total: 3 },
      orders: { completedFeesMinor: 250 },
    });
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_overview");
  });

  it.each(["42501", "PGRST301", "PGRST302"])("treats %s as denied access", async (code) => {
    mock.rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(adminService.getOverview()).rejects.toBeInstanceOf(AdminAccessError);
  });

  it("keeps missing migration and connection failures visible", async () => {
    const error = { code: "PGRST202", message: "Function not found" };
    mock.rpc.mockResolvedValue({ data: null, error });
    await expect(adminService.getOverview()).rejects.toBe(error);
  });

  it("accepts an empty database as real zero metrics", () => {
    const empty = response();
    for (const metrics of [empty.users, empty.listings, empty.orders, empty.reports]) {
      for (const key of Object.keys(metrics)) (metrics as Record<string, number>)[key] = 0;
    }
    const html = renderToStaticMarkup(
      createElement(AdminOverviewPanel, { data: parseAdminOverview(empty), locale: "fi" }),
    );
    expect(html).toContain("Rekisteröityneet käyttäjät");
    expect(html).toContain(">0</strong>");
    expect(html).toContain("0,00");
    expect(html).not.toContain("NaN");
  });

  it.each([
    null,
    {},
    { ...response(), market: "SE" },
    { ...response(), currency: "SEK" },
    { ...response(), generated_at: "invalid" },
  ])("rejects malformed or out-of-market responses", (value) => {
    expect(() => parseAdminOverview(value)).toThrow();
  });

  it.each([-1, 1.2, "5", Number.MAX_SAFE_INTEGER + 1, null])("rejects invalid count %s", (value) => {
    expect(() => parseAdminOverview({ ...response(), users: { total: value, new_last_7_days: 1 } })).toThrow();
  });

  it("formats money from cents and supports Finnish, Swedish and English", () => {
    for (const locale of ["fi", "sv", "en"] as const) {
      const html = renderToStaticMarkup(
        createElement(AdminOverviewPanel, { data: parseAdminOverview(response()), locale }),
      );
      expect(html).toContain(locale === "en" ? "125.00" : "125,00");
      expect(html).toContain(locale === "en" ? "2.50" : "2,50");
      expect(html).not.toContain("12500");
    }
  });
});

describe("dashboard guard", () => {
  it("waits for session resolution before showing protected content", () => {
    const html = renderToStaticMarkup(
      createElement(AdminDashboardPage, { ...pageProps, user: admin, authLoading: true }),
    );
    expect(html).toContain("Tarkistetaan istuntoa");
    expect(html).not.toContain("Rekisteröityneet käyttäjät");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("offers sign-in to an anonymous visitor", () => {
    const html = renderToStaticMarkup(createElement(AdminDashboardPage, { ...pageProps, user: null }));
    expect(html).toContain("Kirjaudu jatkaaksesi");
    expect(html).not.toContain("Rekisteröityneet käyttäjät");
  });

  it("denies a regular account even if its email looks like an admin", () => {
    const html = renderToStaticMarkup(
      createElement(AdminDashboardPage, { ...pageProps, user: { ...admin, role: "user", email: "admin@pcmarket.fi" } }),
    );
    expect(html).toContain("Tarvitset ylläpitäjän oikeudet");
    expect(html).not.toContain("Rekisteröityneet käyttäjät");
  });

  it("keeps unfinished admin URLs inside the protected namespace", () => {
    const html = renderToStaticMarkup(
      createElement(AdminDashboardPage, { ...pageProps, user: admin, overview: false }),
    );
    expect(html).toContain("Ylläpidon sivua ei löytynyt");
    expect(html).not.toContain("Rekisteröityneet käyttäjät");
  });
});
