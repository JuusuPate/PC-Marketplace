import { expect, test, type Page } from "@playwright/test";

async function harness(page: Page, component: string, props = "{locale:'fi'}") {
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/admin-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/admin-panel-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {${component}}=await import('/src/features/admin/${component}.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${component},${props}));
    </script></body></html>`,
    }),
  );
}
test("activity changes ranges, compares actual totals and clears data on denied refresh", async ({ page }) => {
  await harness(page, "AdminActivityPanel");
  let denied = false;
  const requests: { p_start: string; p_end: string }[] = [];
  await page.route("**/admin-test-api", (route) => {
    const { args } = route.request().postDataJSON();
    requests.push(args);
    if (denied) return route.fulfill({ json: { error: { code: "42501" } } });
    const from = Date.parse(args.p_start),
      to = Date.parse(args.p_end);
    const period = (start: string, end: string, n: number) => ({
      start_at: start,
      end_at: end,
      new_users: n,
      new_listings: n,
      orders: { total: n, completed: n, value_minor: n * 12300, fees_minor: n * 500 },
    });
    return route.fulfill({
      json: {
        error: null,
        data: {
          market: "FI",
          currency: "EUR",
          generated_at: new Date().toISOString(),
          current: period(args.p_start, args.p_end, 2),
          previous: period(new Date(from - (to - from)).toISOString(), args.p_start, 1),
        },
      },
    });
  });
  await page.goto("/admin-panel-test");
  await expect(page.getByRole("cell", { name: "246,00" })).toBeVisible();
  await page.getByLabel("Aikaväli", { exact: true }).selectOption("7");
  await page.getByRole("button", { name: "Näytä aikaväli" }).click();
  await expect.poll(() => Date.parse(requests.at(-1)!.p_end) - Date.parse(requests.at(-1)!.p_start)).toBe(7 * 86400000);
  await page.getByLabel("Aikaväli", { exact: true }).selectOption("custom");
  await page.getByLabel("Alkaen (UTC)").fill("2025-02-01T00:00");
  await page.getByLabel("Päättyen (UTC)").fill("2025-03-01T00:00");
  await page.getByRole("button", { name: "Näytä aikaväli" }).click();
  await expect.poll(() => requests.at(-1)?.p_start).toBe("2025-02-01T00:00:00Z");
  denied = true;
  await page.getByRole("button", { name: "Näytä aikaväli" }).click();
  await expect(page.getByRole("alert")).toContainText("Tililläsi ei ole pääsyä");
  await expect(page.getByRole("table")).toHaveCount(0);
});
test("audit search and paging expose before/after evidence and clear revoked data", async ({ page }) => {
  await harness(page, "AdminAuditPanel");
  let denied = false;
  const requests: { p_search: string; p_page: number }[] = [];
  const id = "00000000-0000-4000-8000-000000000001";
  await page.route("**/admin-test-api", (route) => {
    const { args } = route.request().postDataJSON();
    requests.push(args);
    return route.fulfill({
      json: denied
        ? { error: { code: "42501" } }
        : {
            error: null,
            data: {
              page: args.p_page,
              page_size: 25,
              total: 26,
              events: [
                {
                  id,
                  actor_id: id,
                  source: "report",
                  target_type: "report",
                  target_id: id,
                  action: "resolve",
                  created_at: "2025-02-01T00:00:00Z",
                  reason: "Checked evidence",
                  before_data: { resolved: false },
                  after_data: { resolved: true },
                },
              ],
            },
          },
    });
  });
  await page.goto("/admin-panel-test");
  await page.getByText("Muutoksen tiedot", { exact: true }).last().click();
  await expect(page.getByText('"resolved": true', { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.p_page).toBe(1);
  await page.getByRole("searchbox").fill(id);
  await page.getByRole("button", { name: "Hae", exact: true }).click();
  await expect.poll(() => requests.at(-1)).toEqual({ p_search: id, p_page: 0 });
  denied = true;
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Tililläsi ei ole pääsyä");
  await expect(page.getByRole("table")).toHaveCount(0);
});
test("private user details load on demand and disappear after access is revoked", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000001";
  await harness(page, "AdminDetail", `{locale:'fi',kind:'user',id:'${id}'}`);
  let calls = 0,
    denied = false;
  await page.route("**/admin-test-api", (route) => {
    calls++;
    return route.fulfill({
      json: denied
        ? { error: { code: "42501" } }
        : {
            error: null,
            data: {
              id,
              market: "FI",
              currency: "EUR",
              email: "private@example.test",
              listings: 1,
              sales: 0,
              purchases: 0,
              disputes: 0,
              orders_total: 0,
              orders: [],
            },
          },
    });
  });
  await page.goto("/admin-panel-test");
  await expect(page.getByRole("button", { name: "Avaa tiedot" })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Avaa tiedot" }).click();
  await expect(page.getByText("private@example.test")).toBeVisible();
  denied = true;
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Tililläsi ei ole pääsyä");
  await expect(page.getByText("private@example.test")).toHaveCount(0);
});
