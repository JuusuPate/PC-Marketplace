import { expect, test } from "@playwright/test";

test("admin pauses new listings, sees stale-write conflict and loses data after revocation", async ({ page }) => {
  let enabled = true;
  let version = 1;
  let conflict = false;
  let denied = false;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/settings-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/settings-test-api", (route) => {
    const { name, args } = route.request().postDataJSON();
    if (denied) return route.fulfill({ json: { data: null, error: { code: "42501" } } });
    if (name === "save_admin_listing_creation_setting") {
      if (conflict) return route.fulfill({ json: { data: null, error: { code: "40001" } } });
      expect(args.p_expected_version).toBe(version);
      enabled = args.p_enabled;
      version += 1;
    } else expect(name).toBe("get_admin_listing_creation_setting");
    return route.fulfill({
      json: { data: { enabled, version, updated_at: "2026-09-25T12:00:00Z", updated_by: null }, error: null },
    });
  });
  await page.route("**/settings-panel-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminSettingsPanel}=await import('/src/features/admin/AdminSettingsPanel.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminSettingsPanel,{locale:'fi'}));
    </script></body></html>`,
    }),
  );
  await page.goto("/settings-panel-test");
  await expect(page.getByText("Sallittu", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Salli uusien ilmoitusten luonti" }).uncheck();
  await page.getByRole("button", { name: "Tallenna asetus" }).click();
  await expect(page.getByText("Keskeytetty", { exact: true })).toBeVisible();

  conflict = true;
  await page.getByRole("checkbox", { name: "Salli uusien ilmoitusten luonti" }).check();
  await page.getByRole("button", { name: "Tallenna asetus" }).click();
  await expect(page.getByText("Asetusta muutettiin muualla. Päivitä ennen tallentamista.")).toBeVisible();
  await expect(page.getByText("Keskeytetty", { exact: true })).toBeVisible();

  denied = true;
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Keskeytetty", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
});

test("seller sees the paused state and can recheck when creation resumes", async ({ page }) => {
  let enabled = false;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/seller-setting-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/seller-setting-api", (route) => {
    const { name } = route.request().postDataJSON();
    if (name === "get_listing_creation_enabled") return route.fulfill({ json: { data: enabled, error: null } });
    expect(name).toBe("search_product_models");
    return route.fulfill({ json: { data: { total: 0, items: [] }, error: null } });
  });
  await page.route("**/seller-settings-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {CreateListingPage}=await import('/src/features/sell/CreateListingPage.tsx');
    const {fi}=await import('/src/i18n/messages/fi.ts');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(CreateListingPage,{
      copy:fi,locale:'fi',market:'FI',user:{id:'seller-1',name:'Seller',role:'user'},
      onCancel:()=>{},onPublish:async()=>{}
    }));
    </script></body></html>`,
    }),
  );
  await page.goto("/seller-settings-test");
  await expect(
    page.getByText("Uusien ilmoitusten julkaisu on tilapäisesti keskeytetty.", { exact: false }),
  ).toBeVisible();
  enabled = true;
  await page.getByRole("button", { name: "Tarkista uudelleen" }).click();
  await expect(
    page.getByText("Uusien ilmoitusten julkaisu on tilapäisesti keskeytetty.", { exact: false }),
  ).toHaveCount(0);
});
