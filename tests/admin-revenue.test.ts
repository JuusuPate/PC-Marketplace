import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getAdminRevenue, parseAdminRevenue, currentRevenueYear } from "../apps/web/src/lib/admin-revenue-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { AdminRevenueSummary } from "../apps/web/src/features/admin/AdminRevenuePanel";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { isAdminRevenuePath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  currency: "EUR",
  year: 2026,
  timezone: "Europe/Helsinki",
  date_basis: "order_created_at",
  generated_at: "2026-09-18T12:00:00Z",
  totals: { completed_orders: 1, item_value_minor: 12599, fees_minor: 251 },
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    completed_orders: i === 0 ? 1 : 0,
    item_value_minor: i === 0 ? 12599 : 0,
    fees_minor: i === 0 ? 251 : 0,
  })),
});
beforeEach(() => vi.clearAllMocks());
it("recognizes only the revenue route", () => {
  expect(isAdminRevenuePath("/admin/revenue/")).toBe(true);
  expect(isAdminRevenuePath("/admin/revenue/unknown")).toBe(false);
});
it("requests the selected year and verifies the response period", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect(await getAdminRevenue(2026)).toMatchObject({ totals: { feesMinor: 251 } });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_revenue", { p_year: 2026 });
  await expect(getAdminRevenue(2025)).rejects.toThrow("Unexpected revenue year");
});
it.each(["42501", "PGRST301", "PGRST302"])("handles denied access %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminRevenue(2026)).rejects.toBeInstanceOf(AdminAccessError);
});
it("preserves backend errors", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminRevenue(2026)).rejects.toBe(error);
});
it("bounds years before requesting data", async () => {
  for (const year of [1999, 2101, 2026.5, NaN, Infinity]) await expect(getAdminRevenue(year)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects unsafe, malformed and inconsistent monthly data", () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "123"]) {
    const data = response();
    Object.assign(data.totals, { fees_minor: value });
    expect(() => parseAdminRevenue(data)).toThrow();
  }
  for (const change of [
    { year: 1999 },
    { market: "SE" },
    { currency: "SEK" },
    { timezone: "UTC" },
    { date_basis: "completed_at" },
    { generated_at: "invalid" },
    { months: [] },
    { months: null },
  ])
    expect(() => parseAdminRevenue({ ...response(), ...change })).toThrow();
  const data = response();
  data.months[1].month = 1;
  expect(() => parseAdminRevenue(data)).toThrow();
  const mismatch = response();
  mismatch.totals.fees_minor++;
  expect(() => parseAdminRevenue(mismatch)).toThrow();
});
it("uses Helsinki year at the UTC year boundary", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2025-12-31T22:30:00Z"));
    expect(currentRevenueYear()).toBe(2026);
  } finally {
    vi.useRealTimers();
  }
});
it("renders twelve localized months and exact cents", () => {
  for (const locale of ["fi", "sv", "en"] as const) {
    const html = renderToStaticMarkup(
      createElement(AdminRevenueSummary, { data: parseAdminRevenue(response()), locale }),
    );
    expect(html).toMatch(/125[,.]99/);
    expect(html).toMatch(/2[,.]51/);
    expect(html.match(/<tr>/g)).toHaveLength(14);
  }
});
it("guards revenue during authentication and for ordinary users", () => {
  const props = { locale: "fi" as const, overview: false, revenue: true, onLogin: vi.fn(), onNavigate: vi.fn() };
  const user = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    countryCode: "FI" as const,
    locale: "fi" as const,
    role: "user" as const,
  };
  for (const authLoading of [true, false])
    expect(renderToStaticMarkup(createElement(AdminDashboardPage, { ...props, user, authLoading }))).not.toContain(
      "admin-revenue-year",
    );
  expect(mock.rpc).not.toHaveBeenCalled();
});
