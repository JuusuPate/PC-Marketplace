import { expect, test } from "@playwright/test";

test("report decisions require a reason, refresh after success, and handle conflicts and revoked access", async ({
  page,
}) => {
  let version = 0;
  let resolved = false;
  let mode = "success";
  let writes = 0;
  const id = "00000000-0000-4000-8000-000000000001";
  await page.route("**/src/lib/supabase.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const supabase = {rpc: async (name,args) => (await fetch('/test-report-api',{method:'POST',body:JSON.stringify({name,args})})).json()}; export const backendMode='supabase';`,
    }),
  );
  await page.route("**/test-report-api", async (route) => {
    const { name, args } = route.request().postDataJSON();
    if (name === "review_admin_report") {
      writes++;
      if (mode !== "success")
        return route.fulfill({ json: { error: { code: mode === "conflict" ? "40001" : "42501" } } });
      expect(args.p_note).toBe("Tarkistettu ilmoitus huolellisesti.");
      expect(args.p_expected_version).toBe(version);
      resolved = args.p_action === "resolve";
      version++;
      return route.fulfill({ json: { data: null, error: null } });
    }
    return route.fulfill({
      json: {
        error: null,
        data: {
          market: "FI",
          page: 0,
          page_size: 25,
          total: 1,
          reports: [
            {
              id,
              reporter_id: id,
              reporter_name: "Reporter",
              listing_id: id,
              listing_title: "Test listing",
              listing_status: "active",
              seller_id: id,
              seller_name: "Seller",
              reason: "scam",
              details: "Report details",
              created_at: "2026-09-23T12:00:00Z",
              resolved_at: resolved ? "2026-09-24T12:00:00Z" : null,
              review_version: version,
              last_decision: version
                ? {
                    actor_id: id,
                    action: resolved ? "resolve" : "reopen",
                    note: "Tarkistettu ilmoitus huolellisesti.",
                    created_at: "2026-09-24T12:00:00Z",
                  }
                : null,
            },
          ],
        },
      },
    });
  });
  // Render the real panel through Vite; only the service transport is mocked.
  await page.route("**/report-decision-test", (route) =>
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
      const {AdminReportsPanel} = await import('/src/features/admin/AdminReportsPanel.tsx');
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdminReportsPanel,{locale:'fi'}));
      </script></body></html>`,
    }),
  );
  await page.goto("/report-decision-test");
  const note = page.getByRole("textbox", { name: /Päätöksen perustelu/ });
  await expect(page.getByRole("button", { name: "Merkitse käsitellyksi" })).toBeDisabled();
  await note.fill("Tarkistettu ilmoitus huolellisesti.");
  await page.getByRole("button", { name: "Merkitse käsitellyksi" }).click();
  await expect(page.getByText("Päätös tallennettu.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Avaa raportti uudelleen" })).toBeVisible();
  expect(writes).toBe(1);
  await note.fill("Tarkistettu ilmoitus huolellisesti.");
  mode = "conflict";
  await page.getByRole("button", { name: "Avaa raportti uudelleen" }).click();
  await expect(page.getByRole("alert")).toContainText("Päivitä lista");
  await expect(page.getByRole("button", { name: "Avaa raportti uudelleen" })).toBeDisabled();
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await note.fill("Tarkistettu ilmoitus huolellisesti.");
  mode = "denied";
  await page.getByRole("button", { name: "Avaa raportti uudelleen" }).click();
  await expect(note).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
});
