import { expect, test } from "@playwright/test";

test("dashboard curves support every period, exact values, keyboard and mobile, and clear denied data", async ({
  page,
}) => {
  let denied = false;
  const requested: number[] = [];
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/chart-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/chart-test-api", (route) => {
    const { name, args } = route.request().postDataJSON();
    if (name === "get_admin_dashboard_trends") {
      requested.push(args.p_days);
      if (denied) return route.fulfill({ json: { data: null, error: { code: "42501" } } });
      const days = args.p_days as number;
      const buckets = Array.from({ length: days }, (_, index) => ({
        day: new Date(Date.UTC(2026, 8, 25 - days + 1 + index)).toISOString().slice(0, 10),
        users_new: Math.round(20 + 12 * Math.sin(index / 3)),
        listings_new: 2 * index,
        orders_new: index,
        orders_completed: Math.floor(index / 2),
        item_value_minor: index * 9000,
        fees_minor: index * 300,
        reports_new: index % 4,
      }));
      return route.fulfill({
        json: {
          data: {
            days,
            market: "FI",
            currency: "EUR",
            timezone: "Europe/Helsinki",
            start_date: buckets[0].day,
            end_date: buckets.at(-1)!.day,
            generated_at: "2026-09-25T12:00:00Z",
            buckets,
            categories: [],
          },
          error: null,
        },
      });
    }
    if (name === "get_admin_overview")
      return route.fulfill({
        json: {
          data: {
            market: "FI",
            currency: "EUR",
            generated_at: "2026-09-25T12:00:00Z",
            users: { total: 620, new_last_7_days: 82 },
            listings: { total: 240, active: 160, draft: 20, reserved: 10, sold: 40, removed: 10 },
            orders: {
              total: 100,
              completed: 70,
              disputed: 1,
              completed_item_value_minor: 890000,
              completed_fees_minor: 12300,
            },
            reports: { unresolved: 2 },
          },
          error: null,
        },
      });
    expect(name).toBe("get_admin_activity");
    const current = {
      start_at: args.p_start,
      end_at: args.p_end,
      new_users: 12,
      new_listings: 20,
      orders: { total: 10, completed: 5, value_minor: 100000, fees_minor: 2000 },
    };
    const previous = {
      ...current,
      start_at: new Date(Date.parse(args.p_start) - (Date.parse(args.p_end) - Date.parse(args.p_start))).toISOString(),
      end_at: args.p_start,
    };
    return route.fulfill({
      json: {
        data: { market: "FI", currency: "EUR", generated_at: new Date().toISOString(), current, previous },
        error: null,
      },
    });
  });
  await page.route("**/chart-dashboard-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    await import('/src/styles/index.css');
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminDashboardPage}=await import('/src/features/admin/AdminDashboardPage.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminDashboardPage,{locale:'fi',user:{id:'admin-1',name:'Admin',role:'admin'},authLoading:false,overview:true,onLogin:()=>{},onNavigate:()=>{}}));
    </script></body></html>`,
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/chart-dashboard-test");
  const board = page.locator(".admin-trends-section");
  await expect(board.locator(".admin-line-stroke")).toBeVisible();
  for (const [label, days] of [
    ["Viikko", 7],
    ["90 pv", 90],
    ["Puolivuosi", 180],
    ["Vuosi", 365],
    ["30 pv", 30],
  ] as const) {
    await board.getByRole("button", { name: label, exact: true }).click();
    await expect(board.locator(".admin-line-stroke")).toBeVisible();
    expect(requested.at(-1)).toBe(days);
    await expect(board.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await board.getByRole("button", { name: /Uudet ilmoitukset/ }).click();
  await expect(board.locator(".admin-trend-card h3")).toHaveText("Uudet ilmoitukset");
  await board.locator(".admin-line-interaction").focus();
  await page.keyboard.press("Home");
  await expect(board.locator(".admin-chart-readout")).toHaveText(/27\..*2026 · 0/);
  await page.keyboard.press("End");
  await expect(board.locator(".admin-chart-readout")).toContainText("58");
  await board.getByRole("button", { name: /Uudet käyttäjät/ }).click();
  await board.screenshot({ path: "test-results/admin-charts-desktop.png" });
  await board.getByText("Näytä tarkat luvut", { exact: true }).click();
  await expect(board.locator("tbody tr")).toHaveCount(30);
  await board.getByText("Näytä tarkat luvut", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board.locator(".admin-line-stroke")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await board.screenshot({ path: "test-results/admin-charts-mobile.png" });
  denied = true;
  await board.getByRole("button", { name: "Viikko", exact: true }).click();
  await expect(board.getByRole("alert")).toBeVisible();
  await expect(board.locator(".admin-line-stroke")).toHaveCount(0);
});
