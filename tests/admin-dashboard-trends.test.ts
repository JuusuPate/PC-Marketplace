import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { getAdminDashboardTrends, parseAdminDashboardTrends } from "../apps/web/src/lib/admin-dashboard-trends-service";
import { AdminPeriodPicker, AdminTrendChart } from "../apps/web/src/features/admin/AdminCharts";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mock.rpc } }));

function response() {
  return {
    market: "FI",
    currency: "EUR",
    timezone: "Europe/Helsinki",
    days: 7,
    start_date: "2026-09-19",
    end_date: "2026-09-25",
    generated_at: "2026-09-25T12:00:00Z",
    buckets: Array.from({ length: 7 }, (_, index) => ({
      day: `2026-09-${19 + index}`,
      users_new: index,
      listings_new: 0,
      orders_new: 1,
      orders_completed: 1,
      item_value_minor: 12000,
      fees_minor: 240,
      reports_new: 0,
    })),
    categories: [
      {
        slug: "pc",
        labels: { fi: "Tietokoneet", en: "Computers" },
        active_listings: 1,
        asking_average_minor: 12500,
        completed_orders: 1,
        sold_average_minor: 12000,
      },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());

it("parses a complete period, retrieves it through the protected RPC and renders accessible charts", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  const data = await getAdminDashboardTrends(7);
  expect(data.buckets[6].usersNew).toBe(6);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_dashboard_trends", { p_days: 7 });
  const controls = renderToStaticMarkup(
    createElement(AdminPeriodPicker, { locale: "fi", period: 7, onChange: () => {} }),
  );
  expect(controls).toContain("Puolivuosi");
  expect(controls).toContain('aria-pressed="true"');
  const chart = renderToStaticMarkup(
    createElement(AdminTrendChart, { data, field: "usersNew", label: "Uudet käyttäjät", locale: "fi" }),
  );
  expect(chart).toContain("Näytä tarkat luvut");
  expect(chart).toContain("Uudet käyttäjät");
  expect(chart).toContain("21");
});

it("rejects malformed periods, gaps, counts, category samples and denied access", async () => {
  for (const value of [
    { ...response(), days: 8 },
    { ...response(), buckets: response().buckets.slice(1) },
    {
      ...response(),
      buckets: response().buckets.map((row, index) => (index === 3 ? { ...row, day: "2026-09-24" } : row)),
    },
    {
      ...response(),
      buckets: response().buckets.map((row, index) => (index === 0 ? { ...row, orders_completed: 2 } : row)),
    },
    { ...response(), categories: [{ ...response().categories[0], active_listings: 0 }] },
  ])
    expect(() => parseAdminDashboardTrends(value)).toThrow();
  await expect(getAdminDashboardTrends(8 as never)).rejects.toThrow("Invalid dashboard period");
  expect(mock.rpc).not.toHaveBeenCalled();
  mock.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(getAdminDashboardTrends(7)).rejects.toBeInstanceOf(AdminAccessError);
});
