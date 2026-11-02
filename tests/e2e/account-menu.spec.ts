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
