import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getAdminMarketData, parseAdminMarketData } from "../apps/web/src/lib/admin-market-data-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { AdminMarketDataSummary } from "../apps/web/src/features/admin/AdminMarketDataPanel";
import { isAdminMarketDataPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  currency: "EUR",
  period: "all_time",
  generated_at: "2026-09-18T12:00:00Z",
  categories: [
    {
      slug: "pc",
      labels: { fi: "Tietokoneet", sv: "Datorer", en: "Computers" },
      active_listings: 2,
      asking_average_minor: 12599,
      completed_orders: 0,
      sold_average_minor: null,
    },
  ],
});
beforeEach(() => vi.clearAllMocks());
it("requests real market data", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect((await getAdminMarketData()).categories[0].askingAverageMinor).toBe(12599);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_market_data");
});
it.each(["42501", "PGRST301", "PGRST302"])("handles denial %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminMarketData()).rejects.toBeInstanceOf(AdminAccessError);
});
it("preserves backend errors", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminMarketData()).rejects.toBe(error);
});
it("rejects malformed scope, labels, duplicate categories, unsafe values and missing samples", () => {
  for (const change of [
    { market: "SE" },
    { currency: "SEK" },
    { period: "month" },
    { generated_at: "bad" },
    { categories: null },
  ])
    expect(() => parseAdminMarketData({ ...response(), ...change })).toThrow();
  for (const change of [
    { active_listings: -1 },
    { active_listings: 1.5 },
    { active_listings: Number.MAX_SAFE_INTEGER + 1 },
    { asking_average_minor: null },
    { asking_average_minor: "12599" },
    { sold_average_minor: 0 },
    { labels: {} },
    { slug: "" },
  ]) {
    const data = response();
    Object.assign(data.categories[0], change);
    expect(() => parseAdminMarketData(data)).toThrow();
  }
  const data = response();
  data.categories.push(data.categories[0]);
  expect(() => parseAdminMarketData(data)).toThrow();
});
it("renders translated labels, exact cents and missing sample instead of a zero price", () => {
  for (const [locale, label, empty] of [
    ["fi", "Tietokoneet", "Ei tietoa"],
    ["sv", "Datorer", "Inga data"],
    ["en", "Computers", "No data"],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(AdminMarketDataSummary, { data: parseAdminMarketData(response()), locale }),
    );
    expect(html).toContain(label);
    expect(html).toContain(empty);
    expect(html).toMatch(/125[,.]99/);
  }
});
it("falls back to Finnish labels and renders the no activity state", () => {
  const data = response();
  Object.assign(data.categories[0], { labels: { fi: "Tietokoneet" }, active_listings: 0, asking_average_minor: null });
  const html = renderToStaticMarkup(
    createElement(AdminMarketDataSummary, { data: parseAdminMarketData(data), locale: "en" }),
  );
  expect(html).toContain("Tietokoneet");
  expect(html).toContain("No active listings or completed orders yet.");
});
it("recognizes only the market data route", () => {
  expect(isAdminMarketDataPath("/admin/market-data/")).toBe(true);
  expect(isAdminMarketDataPath("/admin/market-data/x")).toBe(false);
});
