import { expect, test } from "@playwright/test";

test("catalog price explorer filters categories, pages and periods, clears stale and denied data, and works on mobile", async ({
  page,
}) => {
  let denied = false;
  let delayPrice = false;
  const calls: { name: string; args: Record<string, any> }[] = [];
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/model-chart-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/model-chart-api", async (route) => {
    const { name, args } = route.request().postDataJSON();
    calls.push({ name, args });
    if (denied) return route.fulfill({ json: { data: null, error: { code: "42501" } } });
    if (name === "get_admin_market_data")
      return route.fulfill({
        json: {
          data: { market: "FI", currency: "EUR", generated_at: "2026-09-25T12:00:00Z", categories: [] },
          error: null,
        },
      });
    if (name === "get_admin_model_market") {
      const models = Array.from(
        { length: args.p_category === "gpu" ? 21 : args.p_category === "cpu" ? 1 : 0 },
        (_, i) => ({
          id: id(args.p_category === "cpu" ? 50 : i + 1),
          category: args.p_category,
          brand: args.p_category === "cpu" ? "AMD" : "NVIDIA",
          name:
            args.p_category === "cpu"
              ? "Ryzen 5 5600"
              : i === 0
                ? "GeForce RTX 3070"
                : i === 1
                  ? "GeForce RTX 3080"
                  : `Catalog GPU ${i + 1}`,
          variant: "",
          aliases: "",
          is_active: true,
          updated_at: "2026-09-25T12:00:00Z",
          active_listings: 0,
          asking_average_minor: null,
          completed_orders: 10,
          sold_average_minor: 22000,
        }),
      ).filter((m) => m.name.toLowerCase().includes(args.p_query.toLowerCase()));
      return route.fulfill({
        json: {
          data: {
            total: models.length,
            items: models.slice(args.p_page * 20, (args.p_page + 1) * 20),
            unlinked_listings: 0,
          },
          error: null,
        },
      });
    }
    expect(name).toBe("get_admin_model_price_trends");
    const days = args.p_days as number;
    const day = (n: number) => new Date(Date.UTC(2026, 8, 25 - days + 1 + n)).toISOString().slice(0, 10);
    const buckets = Array.from({ length: days }, (_, i) => {
      const count = i === 0 || args.p_model_id === id(2) ? 0 : (i % 3) + 1;
      const price = Math.round(22000 + Math.sin(i / 3) * 4000);
      return { day: day(i), sales_count: count, value_minor: count * price, average_minor: count ? price : null };
    });
    const count = buckets.reduce((sum, b) => sum + b.sales_count, 0),
      value = buckets.reduce((sum, b) => sum + b.value_minor, 0);
    const data = {
      model_id: args.p_model_id,
      days,
      market: "FI",
      currency: "EUR",
      timezone: "Europe/Helsinki",
      start_date: day(0),
      end_date: day(days - 1),
      previous_start_date: day(-days),
      previous_end_date: day(-1),
      generated_at: "2026-09-25T12:00:00Z",
      current: { sales_count: count, value_minor: value, average_minor: count ? Math.round(value / count) : null },
      previous: { sales_count: 2, value_minor: 40000, average_minor: 20000 },
      buckets,
    };
    if (delayPrice && args.p_model_id === id(1)) await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ json: { data, error: null } });
  });
  await page.route("**/model-chart-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    await import('/src/styles/index.css'); await import('/src/features/admin/styles/admin-dashboard.css');
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminMarketDataPanel}=await import('/src/features/admin/AdminMarketDataPanel.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminMarketDataPanel,{locale:'fi'}));
    </script></body></html>`,
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/model-chart-test");
  const board = page.getByRole("region", { name: "Tuotteiden hintakehitys" });
  const selectedTitle = board.locator(".admin-model-detail > h3");
  await expect(selectedTitle).toHaveText("NVIDIA GeForce RTX 3070");
  await expect(board.locator(".admin-model-metrics dt")).toHaveText([
    "Keskihinta",
    "Keskihinnan muutos €",
    "Keskihinnan muutos %",
    "Toteutuneet kaupat",
  ]);
  await expect(board.locator(".admin-line-stroke")).toBeVisible();
  await board.locator(".admin-line-interaction").focus();
  await page.keyboard.press("Home");
  await expect(board.locator(".admin-chart-readout")).toContainText("Ei havaintoja");
  await page.keyboard.press("End");
  await expect(board.locator(".admin-chart-readout")).toContainText("€");
  for (const [label, days] of [
    ["Viikko", 7],
    ["90 pv", 90],
    ["Puolivuosi", 180],
    ["Vuosi", 365],
    ["30 pv", 30],
  ] as const) {
    await board.getByRole("button", { name: label, exact: true }).click();
    await expect(board.locator(".admin-line-stroke")).toBeVisible();
    expect(calls.filter((c) => c.name === "get_admin_model_price_trends").at(-1)!.args.p_days).toBe(days);
  }
  await board.screenshot({ path: "test-results/admin-model-charts-desktop.png" });
  await board.getByRole("button", { name: /RTX 3080/ }).click();
  await expect(selectedTitle).toHaveText("NVIDIA GeForce RTX 3080");
  await expect(board.locator(".admin-line-stroke")).toHaveCount(0);
  await expect(board.locator(".admin-model-metrics")).toContainText("Ei vertailuhavaintoja");
  // A slow response for the previous selection must not overwrite the current model.
  delayPrice = true;
  await board.getByRole("button", { name: /RTX 3070/ }).click();
  await expect
    .poll(() => calls.filter((c) => c.name === "get_admin_model_price_trends").at(-1)!.args.p_model_id)
    .toBe(id(1));
  await board.getByRole("button", { name: /RTX 3080/ }).click();
  await expect(selectedTitle).toHaveText("NVIDIA GeForce RTX 3080");
  await page.waitForTimeout(800);
  await expect(selectedTitle).toHaveText("NVIDIA GeForce RTX 3080");
  await board.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(selectedTitle).toHaveText("NVIDIA Catalog GPU 21");
  await board.getByRole("searchbox", { name: "Hae katalogista" }).fill("3070");
  await expect(selectedTitle).toHaveText("NVIDIA GeForce RTX 3070");
  await board.getByLabel("Tuotekategoria").selectOption("cpu");
  await expect(selectedTitle).toHaveText("AMD Ryzen 5 5600");
  await expect(board.getByRole("searchbox")).toHaveValue("");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board.locator(".admin-line-stroke")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await board.screenshot({ path: "test-results/admin-model-charts-mobile.png" });
  await board.getByLabel("Tuotekategoria").selectOption("other");
  await expect(board.getByText("Haulla ei löytynyt katalogituotteita.")).toBeVisible();
  await expect(board.locator(".admin-model-detail")).toHaveCount(0);
  denied = true;
  await board.getByLabel("Tuotekategoria").selectOption("gpu");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(board).toHaveCount(0);
});
