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
