import { expect, test } from "@playwright/test";

for (const width of [390, 1920]) {
  test(`category header is compact and listing cards have a complete border at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 940 });
    await page.goto("/kategoriat/kaikki");
    const hero = page.locator(".category-route-hero");
    const sell = hero.getByRole("button", { name: "Myy tuote" });
    const card = page.locator(".listing-grid .listing-card").first();
    await expect(sell).toBeVisible();
    await expect(card).toBeVisible();
    const box = await hero.boundingBox();
    expect(box!.height).toBeLessThan(width === 390 ? 350 : 330);
    await expect(sell).toHaveCSS("border-top-width", "1px");
    await expect(sell).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    for (const side of ["top", "right", "bottom", "left"]) await expect(card).toHaveCSS(`border-${side}-width`, "1px");
    await expect(card).toHaveCSS("border-style", "solid");
    await expect(page.locator(".price-signal")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.locator(".card-title").click();
    await expect(page.locator(".detail-content h1")).toBeVisible();
    await expect(page.locator(".price-signal")).toHaveCount(0);
  });
}

test("old locally stored demo badges never become market claims", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify([{ ...DEMO_LISTINGS[0], id: "legacy-price", title: "Legacy badge fixture", priceSignal: "fair" }]),
    );
  });
  await page.goto("/kategoriat/kaikki");
  await page.locator(".market-toolbar input").fill("Legacy badge fixture");
  await expect(page.locator(".listing-grid .listing-card")).toHaveCount(1);
  await expect(page.locator(".price-signal")).toHaveCount(0);
});
