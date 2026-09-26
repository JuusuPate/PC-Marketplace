import { expect, test } from "@playwright/test";

test("model search shows exact variants and can reach later result pages", async ({ page }) => {
  const calls: number[] = [];
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/model-picker-test-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/model-picker-test-api", (route) => {
    const { name, args } = route.request().postDataJSON();
    expect(name).toBe("search_product_models");
    expect(args).toMatchObject({ p_category: "gpu", p_query: "Radeon" });
    calls.push(args.p_page);
    const later = args.p_page === 1;
    return route.fulfill({
      json: {
        error: null,
        data: {
          total: 21,
          items: [
            {
              id: later ? "00000000-0000-4000-8000-000000000002" : "00000000-0000-4000-8000-000000000001",
              category: "gpu",
              brand: "AMD",
              name: later ? "Radeon RX 6900 XT" : "Radeon RX 6800 XT",
              variant: "16 GB",
              aliases: "",
              is_active: true,
              updated_at: "2026-09-25T12:00:00Z",
            },
          ],
          unlinked_listings: 0,
        },
      },
    });
  });
  await page.route("**/model-picker-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {ProductModelPicker}=await import('/src/features/sell/ProductModelPicker.tsx');
    // Keep fixture state outside React: Vite may version component imports separately
    // from this inline script, so hooks here could use a second React instance.
    let selected = null;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    function render(){
      root.render(React.createElement(ProductModelPicker,{category:'gpu',locale:'fi',selectedId:selected && selected.id,onSelect:(model)=>{selected=model;render();}}));
    }
    render();
    </script></body></html>`,
    }),
  );
  await page.goto("/model-picker-test");
  expect(calls).toHaveLength(0);
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Radeon");
  await expect(page.getByRole("button", { name: /Radeon RX 6800 XT.*16 GB/ })).toBeVisible();
  await page.getByRole("button", { name: "Seuraava" }).click();
  await expect(page.getByRole("button", { name: /Radeon RX 6900 XT.*16 GB/ })).toBeVisible();
  expect(calls).toEqual([0, 1]);
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).clear();
  await expect(page.getByRole("button", { name: "Seuraava" })).toHaveCount(0);
  expect(calls).toEqual([0, 1]);
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Radeon");
  const option = page.getByRole("button", { name: /Radeon RX 6800 XT.*16 GB/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByText("Katalogimalli valittu")).toBeVisible();
  await expect(page.getByRole("button", { name: /Radeon RX 6800 XT.*16 GB/ })).toHaveCount(0);
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await expect(page.getByText("Katalogimalli valittu")).toBeVisible();
});
