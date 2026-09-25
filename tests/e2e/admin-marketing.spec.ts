import { expect, test } from "@playwright/test";

test("admin can draft and publish a home announcement; revoked access clears the editor", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000001";
  let row: Record<string, unknown> | null = null;
  let denied = false;
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/marketing-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/marketing-test-api", (route) => {
    const { name, args } = route.request().postDataJSON();
    if (denied) return route.fulfill({ json: { data: null, error: { code: "42501" } } });
    if (name === "get_admin_marketing_announcements")
      return route.fulfill({ json: { data: row ? [row] : [], error: null } });
    expect(name).toBe("save_admin_marketing_announcement");
    expect(args).toMatchObject({
      p_locale: "fi",
      p_title: "Autumn hardware picks",
      p_body: "Find your next component.",
      p_expected_version: row ? 1 : null,
    });
    row = {
      id,
      locale: "fi",
      title: args.p_title,
      body: args.p_body,
      is_published: args.p_published,
      version: row ? 2 : 1,
      updated_at: "2026-09-25T12:00:00Z",
    };
    return route.fulfill({ json: { data: null, error: null } });
  });
  await page.route("**/marketing-panel-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AdminMarketingPanel}=await import('/src/features/admin/AdminMarketingPanel.tsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminMarketingPanel,{locale:'fi'}));
    </script></body></html>`,
    }),
  );
  await page.goto("/marketing-panel-test");
  await page.getByRole("button", { name: "Uusi tiedote" }).click();
  await page.getByRole("textbox", { name: "Otsikko" }).fill("Autumn hardware picks");
  await page.getByRole("textbox", { name: "Viesti" }).fill("Find your next component.");
  await page.getByRole("button", { name: "Tallenna tiedote" }).click();
  await expect(page.getByText("Luonnos")).toBeVisible();
  await page.getByRole("button", { name: "Muokkaa" }).click();
  await page.getByRole("checkbox", { name: "Näytä etusivulla" }).check();
  await page.getByRole("button", { name: "Tallenna tiedote" }).click();
  await expect(page.getByText("Julkaistu", { exact: true })).toBeVisible();
  denied = true;
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Julkaistu", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
});
