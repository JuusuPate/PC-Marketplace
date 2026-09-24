import { expect, test } from "@playwright/test";

test("dispute search, paging and refresh always request the disputed state", async ({ page }) => {
  const requests: { p_search: string; p_status: string; p_page: number }[] = [];
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const supabase={rpc:async(name,args)=>(await fetch('/test-disputes-api',{method:'POST',body:JSON.stringify(args)})).json()}; export const backendMode='supabase';",
    }),
  );
  await page.route("**/test-disputes-api", (route) => {
    const args = route.request().postDataJSON();
    requests.push(args);
    return route.fulfill({
      json: {
        error: null,
        data: { market: "FI", currency: "EUR", page: args.p_page, page_size: 25, total: 26, transactions: [] },
      },
    });
  });
  // Render the real panel through Vite; only the service transport is mocked.
  await page.route("**/disputes-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const {default: React} = await import('/node_modules/.vite/deps/react.js');
      const {default: ReactDOM} = await import('/node_modules/.vite/deps/react-dom_client.js');
      const {AdminTransactionsPanel} = await import('/src/features/admin/AdminTransactionsPanel.tsx');
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminTransactionsPanel,{locale:'fi',disputes:true}));
      </script></body></html>`,
    }),
  );

  await page.goto("/disputes-test");
  await expect(page.getByRole("heading", { name: "Riitautukset", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Seuraava", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.p_page).toBe(1);
  await page.getByRole("searchbox").fill("GPU");
  await page.getByRole("button", { name: "Hae", exact: true }).click();
  await expect.poll(() => requests.at(-1)).toEqual({ p_search: "GPU", p_status: "disputed", p_page: 0 });
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect.poll(() => requests.length).toBe(4);
  expect(requests.every((r) => r.p_status === "disputed")).toBe(true);
});
