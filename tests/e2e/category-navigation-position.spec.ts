import { expect, test } from "@playwright/test";

for (const width of [390, 860, 1080, 1180]) {
  test(`category submenu stays reachable at ${width}px, including after scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/kategoriat/komponentit");
    const trigger = page.locator(".category-navigation-link").filter({ hasText: "Komponentit" });
    const menu = page.locator(".category-navigation-submenu[aria-label='Komponentit']");
    for (const scrollY of [0, 400]) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await trigger.hover();
      await expect(menu).toBeVisible();
      await expect(async () => {
        const navBox = await page.locator(".category-navigation").boundingBox();
        const menuBox = await menu.boundingBox();
        expect(Math.abs(menuBox!.y - (navBox!.y + navBox!.height))).toBeLessThanOrEqual(1);
        expect(menuBox!.x).toBeGreaterThanOrEqual(0);
        expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
      }).toPass();
      const firstLink = menu.getByRole("link").first();
      const box = await firstLink.boundingBox();
      const triggerBox = await trigger.boundingBox();
      await page.mouse.move(triggerBox!.x + triggerBox!.width / 2, box!.y + box!.height / 2, { steps: 20 });
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 20 });
      await expect(menu).toBeVisible();
    }
    await menu.getByRole("link", { name: "Prosessorit" }).click();
    await expect(page).toHaveURL(/\/kategoriat\/prosessorit/);
  });
}

test("category submenu keeps keyboard disclosure and Escape focus", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 900 });
  await page.goto("/kategoriat/komponentit");
  const componentToggle = page
    .locator(".category-navigation-item")
    .filter({ hasText: "Komponentit" })
    .locator("button");
  await componentToggle.focus();
  await page.keyboard.press("Enter");
  await expect(componentToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator(".category-navigation-submenu[aria-label='Komponentit'] a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(componentToggle).toHaveAttribute("aria-expanded", "false");
  await expect(componentToggle).toBeFocused();
});

for (const width of [982, 1440]) {
  test(`hovering a category without a submenu closes the open menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 884 });
    await page.goto("/kategoriat/komponentit");
    const menu = page.locator(".category-navigation-submenu[aria-label='Komponentit']");
    const components = page.locator(".category-navigation-link").filter({ hasText: "Komponentit" });
    const plainLinks = page.locator(".category-navigation-item:not(.has-submenu) > .category-navigation-link");
    expect(await plainLinks.count()).toBeGreaterThan(0);
    for (const link of await plainLinks.all()) {
      await components.hover();
      await expect(menu).toBeVisible();
      await link.hover();
      await expect(menu).toBeHidden();
      await expect(page.locator(".category-navigation-item.is-menu-open")).toHaveCount(0);
    }
  });
}

test("component links use the chosen priority order", async ({ page }) => {
  await page.goto("/");
  await page.locator(".category-navigation-link").filter({ hasText: "Komponentit" }).hover();
  const menu = page.locator('.category-navigation-submenu[aria-label="Komponentit"]');
  await expect(menu).toBeVisible();
  expect(
    await menu.getByRole("link").evaluateAll((links) => links.map((link) => link.firstChild!.textContent!.trim())),
  ).toEqual([
    "Kaikki komponentit",
    "Näytönohjaimet",
    "Prosessorit",
    "Emolevyt",
    "Muistit",
    "Tallennuslaitteet",
    "Virtalähteet",
    "Kotelot",
    "Jäähdytys",
    "Tuulettimet",
  ]);
});

test("gaming PC shortcuts remain separate from all PCs and filter actual prices", async ({ page }) => {
  await page.route("**/src/lib/catalog-service.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const catalogService={getNavigation:async()=>({source:"supabase",marketCountryCode:"FI",categories:[{id:"pc",slug:"pc",items:[{id:"server-1000",label:"Alle 1 000 €",href:"/kategoriat/pelitietokoneet?maxPrice=1000",filter:{kind:"price_max_minor",maxPriceMinor:100000}},{id:"server-featured",label:"Nostetut",href:"/kategoriat/pelitietokoneet?featured=true",filter:{kind:"featured",featuredOnly:true}}]}]})};`,
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI")!;
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        [49900, 75000, 125000].map((priceMinor, i) => ({
          ...base,
          id: `pc-preset-${i}`,
          title: `PikahakuPC ${i}`,
          category: "pc",
          priceMinor,
        })),
      ),
    );
  });
  await page.goto("/kategoriat/pelitietokoneet");
  const trigger = page.locator(".category-navigation-link").filter({ hasText: "Pelikoneet" });
  const menu = page.locator('.category-navigation-submenu[aria-label="Pelikoneet"]');
  await trigger.hover();
  expect(
    await menu.getByRole("link").evaluateAll((links) => links.map((link) => link.firstChild!.textContent!.trim())),
  ).toEqual(["Kaikki pelitietokoneet", "Alle 500 €", "Alle 1 000 €", "Nostetut"]);
  const search = page.locator(".market-toolbar input");
  const cards = page.locator(".listing-grid .listing-card");
  await menu.getByRole("link", { name: "Alle 500 €", exact: true }).click();
  await expect(page).toHaveURL(/maxPrice=500#marketplace$/);
  await search.fill("PikahakuPC");
  await expect(cards).toHaveCount(1);
  await page.reload();
  await search.fill("PikahakuPC");
  await expect(cards).toHaveCount(1);
  await trigger.hover();
  await menu.getByRole("link", { name: "Alle 1 000 €", exact: true }).click();
  await expect(page).toHaveURL(/maxPrice=1000#marketplace$/);
  await search.fill("PikahakuPC");
  await expect(cards).toHaveCount(2);
  await trigger.hover();
  await menu.getByRole("link", { name: "Kaikki pelitietokoneet", exact: true }).click();
  await expect(page).toHaveURL(/pelitietokoneet#marketplace$/);
  await search.fill("PikahakuPC");
  await expect(cards).toHaveCount(3);
});
