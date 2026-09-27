import { expect, test } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`merged home design keeps navigation and content usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Löydä seuraava päivityksesi." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Uusimmat ilmoitukset" }).locator(".listing-card")).toHaveCount(5);
    await expect(page.getByRole("region", { name: "Sinulle suositeltua" })).toBeVisible();
    await expect(page.locator("#marketplace")).toHaveCount(0);
    expect(await page.locator(".storefront-hero").evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(
      width,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Suomi", exact: true }).click();
    await expect(page.getByRole("menu", { name: "Select language" })).toBeVisible();
    await page.getByRole("menuitemradio", { name: "English", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find your next upgrade." })).toBeVisible();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Select language" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "English", exact: true })).toBeFocused();
    await page.locator(".site-footer").getByRole("link", { name: "Safety", exact: true }).click();
    await expect(page).toHaveURL(/\/turvallisuus$/);
    await expect(page.locator(".safety-hero")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Dashboard tarvitsee palveluyhteyden" })).toBeVisible();
  });
}

test("recommendations expand once to 48, survive navigation, and reset on reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const source = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        Array.from({ length: 80 }, (_, i) => ({
          ...source,
          id: `recommendation-${i}`,
          title: `Component ${i}`,
          seller: { ...source.seller, id: `seller-${i}` },
          status: "active",
          publishedAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
      ),
    );
  });
  await page.reload();
  const grid = page.locator("#recommendation-grid");
  await expect(grid.locator(".listing-card")).toHaveCount(24);
  const first = await grid.locator(".card-title").allTextContents();
  await page.getByRole("button", { name: "Lisää suositeltuja", exact: true }).click();
  await expect(grid.locator(".listing-card")).toHaveCount(48);
  expect((await grid.locator(".card-title").allTextContents()).slice(0, 24)).toEqual(first);
  await expect(page.getByRole("button", { name: "Lisää suositeltuja", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Selaa tuotteita", exact: true }).click();
  await expect(page.locator("#marketplace")).toBeVisible();
  await page.locator(".site-footer .brand").click();
  await expect(grid.locator(".listing-card")).toHaveCount(48);
  await page.reload();
  await expect(grid.locator(".listing-card")).toHaveCount(24);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".storefront-hero").evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe(
    "none",
  );
});

test("spiral pauses, respects reduced motion and the official section disappears and returns", async ({ page }) => {
  let available = false;
  await page.route("**/src/lib/home-official-service.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `import {SIMULATED_LISTINGS} from '/src/data/simulated-listings.ts'; export async function loadOfficialListings(){const r=await fetch('/official-fixture');const {available}=await r.json();return {listings:available?SIMULATED_LISTINGS.slice(0,5):[],hasMore:false,nextOffset:5};}`,
    }),
  );
  await page.route("**/official-fixture", (route) => route.fulfill({ json: { available } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".home-feed--official")).toHaveCount(0);
  const card = page.locator(".infinite-spiral__item").nth(1);
  await expect(card).toBeAttached();
  await expect.poll(() => card.getAttribute("style")).toContain("translate3d");
  const stationary = await card.getAttribute("style");
  await page.waitForTimeout(180);
  expect(await card.getAttribute("style")).toBe(stationary);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => card.getAttribute("style")).not.toBe(stationary);
  await page.getByRole("button", { name: "Pysäytä animaatio" }).click();
  await expect(page.getByRole("button", { name: "Jatka animaatiota" })).toHaveAttribute("aria-pressed", "true");
  const paused = await card.getAttribute("style");
  await page.waitForTimeout(180);
  expect(await card.getAttribute("style")).toBe(paused);
  available = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".home-feed--official .listing-card")).toHaveCount(5);
  available = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".home-feed--official")).toHaveCount(0);
});
