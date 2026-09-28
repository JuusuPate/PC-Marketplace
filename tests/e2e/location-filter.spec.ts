import { expect, test } from "@playwright/test";

test("location filter lists all regions and municipalities and combines parent/child choices", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        ["Helsinki", "Helsingfors", "Espoo", "Mariehamn", "Tampere", "Espoo, Tapiola"].map((city, i) => ({
          ...base,
          id: `geo-${i}`,
          title: `GeoDemo ${i}`,
          city,
        })),
      ),
    );
  });
  await page.goto("/kategoriat/kaikki");
  await page.locator(".market-toolbar input").fill("GeoDemo");
  const location = page.locator(".market-location");
  const cards = page.locator(".listing-grid .listing-card");
  await expect(location.locator("summary")).toHaveText("Sijainti");
  await expect(location.locator(".market-location__region")).toHaveCount(19);
  await expect(location.locator(".market-location__cities input")).toHaveCount(308);
  await expect(cards).toHaveCount(6);
  await location.getByRole("checkbox", { name: "Uusimaa", exact: true }).check();
  await expect(cards).toHaveCount(3);
  await location.getByRole("button", { name: "Kunnat: Uusimaa", exact: true }).click();
  await location.getByRole("checkbox", { name: "Helsinki", exact: true }).uncheck();
  await expect(location.getByRole("checkbox", { name: "Uusimaa", exact: true })).toBeChecked({ indeterminate: true });
  await expect(cards).toHaveCount(1);
  await location.getByRole("checkbox", { name: "Ahvenanmaa", exact: true }).check();
  await expect(cards).toHaveCount(2);
  await location.getByRole("button", { name: "Kunnat: Ahvenanmaa", exact: true }).click();
  await expect(location.getByRole("checkbox", { name: "Maarianhamina - Mariehamn", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Tyhjennä suodattimet", exact: true }).click();
  await expect(cards).toHaveCount(6);
  await location.getByRole("searchbox").fill("Helsingfors");
  await expect(location.locator(".market-location__region")).toHaveCount(1);
  await location.getByRole("checkbox", { name: "Helsinki", exact: true }).check();
  await expect(cards).toHaveCount(2);
  await location.getByRole("searchbox").fill("");
  await expect(location.getByRole("checkbox", { name: "Espoo, Tapiola", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Suodattimet/ }).click();
  await location.getByRole("button", { name: "Kunnat: Lappi", exact: true }).click();
  await expect(location.getByRole("checkbox", { name: "Inari", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
