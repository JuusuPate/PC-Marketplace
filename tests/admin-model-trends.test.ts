import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getModelPriceTrends, parseModelPriceTrends } from "../apps/web/src/lib/admin-model-trends-service";
import { AdminDailyChart } from "../apps/web/src/features/admin/AdminCharts";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mock.rpc } }));
const id = "00000000-0000-4000-8000-000000000001";
function response() {
  const empty = { sales_count: 0, value_minor: 0, average_minor: null };
  return {
    model_id: id,
    market: "FI",
    currency: "EUR",
    timezone: "Europe/Helsinki",
    days: 7,
    start_date: "2026-09-19",
    end_date: "2026-09-25",
    previous_start_date: "2026-09-12",
    previous_end_date: "2026-09-18",
    generated_at: "2026-09-25T12:00:00Z",
    current: { sales_count: 3, value_minor: 70000, average_minor: 23333 },
    previous: { sales_count: 1, value_minor: 20000, average_minor: 20000 },
    buckets: Array.from({ length: 7 }, (_, i) => ({
      day: `2026-09-${19 + i}`,
      ...(i === 0
        ? { sales_count: 1, value_minor: 10000, average_minor: 10000 }
        : i === 6
          ? { sales_count: 2, value_minor: 60000, average_minor: 30000 }
          : empty),
    })),
  };
}
it("uses the weighted period average, computes changes and keeps no-sale days as chart gaps", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  const d = await getModelPriceTrends(id, 7);
  expect(mock.rpc).toHaveBeenCalledWith("get_admin_model_price_trends", { p_model_id: id, p_days: 7 });
  expect(d.changeMinor).toBe(3333);
  expect(d.changePercent).toBeCloseTo(16.665);
  const html = renderToStaticMarkup(
    createElement(AdminDailyChart, {
      days: d.days,
      buckets: d.buckets.map((b) => ({ day: b.day, value: b.averageMinor })),
      total: d.current.averageMinor,
      label: "Hinnat",
      locale: "fi",
      money: true,
    }),
  );
  expect(html).toContain("233,33");
  expect(html).toContain("Ei havaintoja");
  expect(html.match(/class="admin-line-stroke"/g)).toHaveLength(2);
  expect(html).not.toContain("NaN");
  const missing = parseModelPriceTrends({
    ...response(),
    previous: { sales_count: 0, value_minor: 0, average_minor: null },
  });
  expect(missing.changeMinor).toBeNull();
  expect(missing.changePercent).toBeNull();
  const zero = parseModelPriceTrends({ ...response(), previous: { sales_count: 1, value_minor: 0, average_minor: 0 } });
  expect(zero.changePercent).toBeNull();
  const negative = parseModelPriceTrends({
    ...response(),
    previous: { sales_count: 1, value_minor: 30000, average_minor: 30000 },
  });
  expect(negative.changeMinor).toBe(-6667);
});
it("rejects wrong periods, totals, samples, identifiers, scope and access denial", async () => {
  for (const bad of [
    { ...response(), days: 8 },
    { ...response(), model_id: "bad" },
    { ...response(), market: "SE" },
    { ...response(), buckets: response().buckets.slice(1) },
    { ...response(), previous_end_date: "2026-09-19" },
    { ...response(), current: { sales_count: 2, value_minor: 70000, average_minor: 35000 } },
    { ...response(), previous: { sales_count: 0, value_minor: 0, average_minor: 0 } },
    { ...response(), previous: { sales_count: 1, value_minor: Number.MAX_SAFE_INTEGER + 1, average_minor: 1 } },
  ])
    expect(() => parseModelPriceTrends(bad)).toThrow();
  mock.rpc.mockResolvedValue({
    data: { ...response(), model_id: "00000000-0000-4000-8000-000000000002" },
    error: null,
  });
  await expect(getModelPriceTrends(id, 7)).rejects.toThrow("scope");
  mock.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(getModelPriceTrends(id, 7)).rejects.toBeInstanceOf(AdminAccessError);
});
