import { expect, test } from "@playwright/test";

test("catalogue pages contain 24 items, sort globally, and reset when filtering", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        Array.from({ length: 53 }, (_, i) => ({
          ...base,
          id: `pagination-${i}`,
          title: `PaginationDemo ${String(i).padStart(2, "0")}`,
          category: i % 2 ? "cpu" : "gpu",
          priceMinor: 10000 + i * 100,
          createdAt: "2020-01-01",
          publishedAt: new Date(Date.now() - i * 60000).toISOString(),
        })),
      ),
    );
  });
  await page.goto("/kategoriat/kaikki");
  const search = page.locator(".market-toolbar input");
  await search.fill("PaginationDemo");
  const cards = page.locator(".listing-grid .listing-card");
  const pagination = page.getByRole("navigation", { name: "Tuotelistan sivut" });
  await expect(cards).toHaveCount(24);
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 00");
  await expect(pagination.getByRole("status")).toHaveText("1–24 / 53 tuotetta");
  await expect(pagination.getByRole("button", { name: "Edellinen" })).toBeDisabled();
  await pagination.getByRole("button", { name: "Sivu 2", exact: true }).click();
  await expect(cards).toHaveCount(24);
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 24");
  await expect(pagination.getByRole("button", { name: "Sivu 2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#marketplace-list-title")).toBeFocused();
  await pagination.getByRole("button", { name: "Seuraava" }).click();
  await expect(cards).toHaveCount(5);
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 48");
  await expect(pagination.getByRole("button", { name: "Seuraava" })).toBeDisabled();
  await page.locator(".market-toolbar select").selectOption("oldest");
  await expect(cards).toHaveCount(24);
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 52");
  await expect(pagination.getByRole("button", { name: "Sivu 1", exact: true })).toHaveAttribute("aria-current", "page");
  await pagination.getByRole("button", { name: "Sivu 2", exact: true }).click();
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 28");
  await search.fill("PaginationDemo 00");
  await expect(cards).toHaveCount(1);
  await expect(pagination.getByRole("status")).toHaveText("1–1 / 1 tuotetta");
  await expect(pagination.getByRole("button")).toHaveCount(0);
  await search.fill("PaginationDemo");
  await page.setViewportSize({ width: 390, height: 844 });
  await pagination.getByRole("button", { name: "Sivu 3", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator(".market-toolbar select").selectOption("priceHigh");
  await expect(cards.first().locator(".card-title")).toHaveText("PaginationDemo 52");
  await search.fill("NoSuchPaginationProduct");
  await expect(cards).toHaveCount(0);
  await expect(pagination).toHaveCount(0);
});
