import { expect, test } from "@playwright/test";

test("listing cards show elapsed publication times and both sort directions use those dates", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    const fixtures = [
      ["minute", 25],
      ["hour", 240],
      ["day", 2880],
      ["week", 10080],
      ["date", 14400],
    ] as const;
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        fixtures.map(([id, minutes], i) => ({
          ...base,
          id: `time-${id}`,
          title: `TimeCase ${id}`,
          createdAt: new Date(Date.now() - (fixtures.length - i) * 365 * 86400000).toISOString(),
          publishedAt: new Date(Date.now() - minutes * 60000).toISOString(),
        })),
      ),
    );
  });
  await page.goto("/kategoriat/kaikki");
  await page.locator(".market-toolbar input").fill("TimeCase");
  const cards = page.locator(".listing-grid .listing-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.locator(".card-title")).toHaveText([
    "TimeCase minute",
    "TimeCase hour",
    "TimeCase day",
    "TimeCase week",
    "TimeCase date",
  ]);
  await expect(cards.locator(".card-time")).toHaveText(["25min", "4h", "2pv", "7pv", /\d{1,2}\.\d{1,2}\.\d{4}/]);
  await page.locator(".market-toolbar select").selectOption("oldest");
  await expect(cards.locator(".card-title")).toHaveText([
    "TimeCase date",
    "TimeCase week",
    "TimeCase day",
    "TimeCase hour",
    "TimeCase minute",
  ]);
  await page.locator(".market-toolbar select").selectOption("newest");
  await expect(cards.first().locator(".card-title")).toHaveText("TimeCase minute");
  await expect(cards.first().locator("time")).toHaveAttribute("datetime", /.+Z$/);
});
