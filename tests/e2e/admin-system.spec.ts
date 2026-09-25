import { expect, test } from "@playwright/test";

test("system snapshot shows partial failure and clears results after access is revoked", async ({ page }) => {
  let denied = false;
  let marketingFailed = true;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/system-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/system-test-api", (route) => {
    const { name } = route.request().postDataJSON();
    if (denied) return route.fulfill({ json: { data: null, error: { code: "42501" } } });
    if (name === "get_admin_overview")
      return route.fulfill({
        json: {
          data: {
            market: "FI",
            currency: "EUR",
            generated_at: "2026-09-25T12:00:00Z",
            users: { total: 0, new_last_7_days: 0 },
            listings: { total: 0, active: 0, draft: 0, reserved: 0, sold: 0, removed: 0 },
            orders: { total: 0, completed: 0, disputed: 0, completed_item_value_minor: 0, completed_fees_minor: 0 },
            reports: { unresolved: 0 },
          },
          error: null,
        },
      });
    if (name === "get_admin_model_market")
      return route.fulfill({ json: { data: { total: 0, items: [], unlinked_listings: 0 }, error: null } });
    if (name === "get_admin_marketing_announcements")
      return route.fulfill({
        json: { data: marketingFailed ? null : [], error: marketingFailed ? { code: "PGRST202" } : null },
      });
    expect(name).toBe("get_admin_audit");
    return route.fulfill({ json: { data: { page: 0, page_size: 25, total: 0, events: [] }, error: null } });
  });
  await page.route("**/system-panel-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminSystemPanel}=await import('/src/features/admin/AdminSystemPanel.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminSystemPanel,{locale:'fi'}));
    </script></body></html>`,
    }),
  );
  await page.goto("/system-panel-test");
  await expect(page.getByText("Haku epäonnistui")).toHaveCount(1);
  await expect(page.getByText("Haku onnistui")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Ei valvonnassa" })).toBeVisible();

  marketingFailed = false;
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Haku epäonnistui")).toHaveCount(0);
  await expect(page.getByText("Haku onnistui")).toHaveCount(4);

  denied = true;
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Haku onnistui")).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
});
