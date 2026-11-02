import { expect, test } from "@playwright/test";
async function login(page: import("@playwright/test").Page, admin = false) {
  await page.goto("/kirjaudu");
  await page
    .getByRole("button", { name: admin ? "Käytä admin-demotunnusta" : "Käytä demotunnusta", exact: true })
    .click();
}
test("profile opens a dropdown, not the removed account dialog; pages survive reload", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Oma tili", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Oma tili", exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const name of ["Profiili", "Käyttäjäasetukset", "Omat ilmoitukset", "Ostokseni", "Suosikit", "Kirjaudu ulos"])
    await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Ylläpito", exact: true })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Profiili", exact: true }).click();
  await expect(page).toHaveURL(/\/oma-tili$/);
  await expect(page.getByRole("heading", { name: "Profiili", exact: true })).toBeVisible();
  await expect(page.getByText("demo@pcmarket.fi", { exact: true })).toBeVisible();
  await expect(page.locator(".account-wrap")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Profiili", exact: true })).toBeVisible();
  const favourites = page
    .getByRole("navigation", { name: "Tilin sivut", exact: true })
    .getByRole("button", { name: "Suosikit", exact: true });
  await favourites.click();
  await expect(page.getByRole("dialog", { name: "Suosikit", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await expect(favourites).toBeFocused();
  await expect(page).toHaveURL(/\/oma-tili$/);
});
test("keyboard, outside click and mobile settings work without overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const trigger = page.getByRole("button", { name: "Oma tili", exact: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Profiili", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Kirjaudu ulos", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  const box = await page.getByRole("menu", { name: "Oma tili", exact: true }).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.getByRole("menuitem", { name: "Käyttäjäasetukset", exact: true }).click();
  await expect(page).toHaveURL(/\/oma-tili\/asetukset$/);
  await page.getByLabel("Kieli", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "User settings", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "My account", exact: true }).click();
  await page.mouse.click(8, 700);
  await expect(page.getByRole("menu", { name: "My account", exact: true })).toHaveCount(0);
});
test("favourites keep their existing action and admin links are role-specific", async ({ page }) => {
  await login(page, true);
  await page.getByRole("button", { name: "Oma tili", exact: true }).click();
  await page.getByRole("menuitem", { name: "Suosikit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".account-wrap")).toHaveCount(0);
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await page.getByRole("button", { name: "Oma tili", exact: true }).click();
  await page.getByRole("menuitem", { name: "Ylläpito", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
test("direct private pages require sign-in and logout removes the private page", async ({ page }) => {
  await page.goto("/oma-tili/ilmoitukset");
  await expect(page).toHaveURL(/\/kirjaudu\?paluu=%2Foma-tili%2Filmoitukset$/);
  await page.getByRole("button", { name: "Käytä demotunnusta", exact: true }).click();
  await expect(page).toHaveURL(/\/oma-tili\/ilmoitukset$/);
  await expect(page.getByRole("heading", { name: "Omat ilmoitukset", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Oma tili", exact: true }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4183\/$/);
  await expect(page.getByRole("button", { name: "Kirjaudu", exact: true })).toBeVisible();
  await expect(page.locator(".account-page__panel")).toHaveCount(0);
});
test("my listings still open the existing owner-only editor", async ({ page }) => {
  await login(page);
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const session = JSON.parse(localStorage.getItem("pc-marketplace.demo-session")!);
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI")!;
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify([
        {
          ...base,
          id: "account-listing-test",
          title: "Tilin testikomponentti",
          seller: { ...base.seller, id: session.id },
          status: "active",
        },
      ]),
    );
  });
  await page.goto("/oma-tili/ilmoitukset");
  await expect(page.getByText("Tilin testikomponentti", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Muokkaa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Muokkaa ilmoitusta", exact: true })).toBeVisible();
});

test("own-listing status filters show complete counts and keep other sellers out", async ({ page }) => {
  await login(page);
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const session = JSON.parse(localStorage.getItem("pc-marketplace.demo-session")!);
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI")!;
    const statuses = ["active", "sold", "draft", "reserved", "removed", undefined];
    const mine = statuses.map((status, i) => ({
      ...base,
      id: `own-filter-${i}`,
      title: `Own filter ${status ?? "legacy"}`,
      seller: { ...base.seller, id: session.id },
      status,
    }));
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify([...mine, { ...base, id: "not-mine-filter", title: "Another seller's item", status: "sold" }]),
    );
  });
  await page.goto("/oma-tili/ilmoitukset");
  const filters = page.getByRole("group", { name: "Ilmoitusten tila", exact: true });
  const rows = page.locator("#own-listings-results .account-listing");
  for (const [name, count] of [
    ["Kaikki", 6],
    ["Aktiiviset", 2],
    ["Myydyt", 1],
    ["Luonnokset", 1],
  ] as const)
    await expect(filters.getByRole("button", { name: new RegExp(`^${name}\\s+${count}$`) })).toBeVisible();
  await expect(rows).toHaveCount(6);
  await filters.getByRole("button", { name: /^Myydyt/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Own filter sold");
  await expect(rows.getByRole("button", { name: "Muokkaa", exact: true })).toBeDisabled();
  await filters.getByRole("button", { name: /^Aktiiviset/ }).click();
  await expect(rows).toHaveCount(2);
  await expect(filters.getByRole("button", { name: /^Aktiiviset/ })).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await filters.getByRole("button", { name: /^Luonnokset/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Own filter draft");
  await filters.getByRole("button", { name: /^Kaikki/ }).click();
  await expect(rows).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText("Another seller's item", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const mine = JSON.parse(localStorage.getItem("pc-marketplace.demo-listings")!);
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(mine.filter((item: any) => item.status !== "sold")),
    );
  });
  await page.reload();
  await filters.getByRole("button", { name: /^Myydyt\s+0$/ }).click();
  await expect(page.getByText("Tässä ryhmässä ei ole ilmoituksia.", { exact: true })).toBeVisible();
  await expect(filters.getByRole("button", { name: /^Kaikki\s+5$/ })).toBeVisible();
});

test("empty own-listing groups retain their zero counts", async ({ page }) => {
  await login(page);
  await page.goto("/oma-tili/ilmoitukset");
  const filters = page.getByRole("group", { name: "Ilmoitusten tila", exact: true });
  for (const name of ["Kaikki", "Aktiiviset", "Myydyt", "Luonnokset"]) {
    const button = filters.getByRole("button", { name: new RegExp(`^${name}\\s+0$`) });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Ei omia ilmoituksia vielä.", { exact: true })).toBeVisible();
  }
});

test("loading and failed own-listing reads do not expose stale rows or claim zero totals", async ({ page }) => {
  await page.route("**/own-listing-state-test?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AccountPage}=await import('/src/features/account/AccountPage.tsx');
    const {getMessages}=await import('/src/i18n');
    const {DEMO_LISTINGS}=await import('/src/data/demo-listings.ts');
    const loading=new URL(location.href).searchParams.get('state')==='loading';
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AccountPage,{
      copy:getMessages('fi'),locale:'fi',user:{id:'owner',name:'Owner',email:'owner@example.test',countryCode:'FI',role:'user'},
      tab:'listings',ownListings:[DEMO_LISTINGS[0]],ownListingsLoading:loading,ownListingsError:!loading,orders:[],
      onNavigate:()=>{},onEditListing:()=>{},onLocale:()=>{},onCookieSettings:()=>{},onFavourites:()=>{}
    }));
    </script></body></html>`,
    }),
  );
  for (const state of ["loading", "error"]) {
    await page.goto(`/own-listing-state-test?state=${state}`);
    const filters = page.getByRole("group", { name: "Ilmoitusten tila", exact: true });
    await expect(filters.locator(".account-page__filter-count")).toHaveText(["—", "—", "—", "—"]);
    for (const button of await filters.getByRole("button").all()) await expect(button).toBeDisabled();
    await expect(page.locator(".account-listing")).toHaveCount(0);
    await expect(page.getByText("Ei omia ilmoituksia vielä.", { exact: true })).toHaveCount(0);
    if (state === "error") await expect(page.getByRole("alert")).toContainText("Omia ilmoituksia ei voitu ladata.");
    else await expect(page.getByRole("status")).toHaveText("Ladataan omia ilmoituksia…");
  }
});
