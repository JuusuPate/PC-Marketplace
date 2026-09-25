import { expect, test } from "@playwright/test";

test("hiding requires a reason, restoration does not, and revoked access clears data", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000001";
  let version = 0;
  let hidden = false;
  let deny = false;
  let writes = 0;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/moderation-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/moderation-test-api", (route) => {
    const { name, args } = route.request().postDataJSON();
    if (name === "moderate_admin_listing") {
      writes++;
      if (deny) return route.fulfill({ json: { error: { code: "42501" } } });
      expect(args).toMatchObject({
        p_listing_id: id,
        p_expected_version: version,
        p_reason: hidden ? "" : "Reviewed listing evidence",
      });
      hidden = args.p_action === "hide";
      version++;
      return route.fulfill({ json: { data: null, error: null } });
    }
    return route.fulfill({
      json: {
        error: null,
        data: {
          market: "FI",
          currency: "EUR",
          page: 0,
          page_size: 25,
          total: 1,
          listings: [
            {
              id,
              title: "Test gaming PC",
              seller_id: id,
              seller_name: "Test seller",
              status: hidden ? "removed" : "active",
              price_minor: 12500,
              created_at: "2026-09-25T12:00:00Z",
              moderation_hidden: hidden,
              moderation_version: version,
            },
          ],
        },
      },
    });
  });
  await page.route("**/moderation-panel-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminListingsPanel}=await import('/src/features/admin/AdminListingsPanel.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminListingsPanel,{locale:'fi'}));
    </script></body></html>`,
    }),
  );
  await page.goto("/moderation-panel-test");
  const reason = page.getByRole("textbox", { name: /Perustelu/ });
  await expect(page.getByRole("button", { name: "Piilota ilmoitus" })).toBeDisabled();
  await reason.fill("Reviewed listing evidence");
  await page.getByRole("button", { name: "Piilota ilmoitus" }).click();
  await expect(page.getByRole("button", { name: "Palauta ilmoitus" })).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByRole("textbox", { name: /Palautuksen perustelu/ })).toBeEmpty();
  await expect(page.getByRole("button", { name: "Palauta ilmoitus" })).toBeEnabled();
  await page.getByRole("button", { name: "Palauta ilmoitus" }).click();
  await expect(page.getByRole("button", { name: "Piilota ilmoitus" })).toBeDisabled();
  expect(writes).toBe(2);
  await reason.fill("Reviewed listing evidence");
  deny = true;
  await page.getByRole("button", { name: "Piilota ilmoitus" }).click();
  await expect(reason).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
});
