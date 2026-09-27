import { expect, test } from "@playwright/test";

test("sidebar combines multiple categories, technical details and price before pagination", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify(
        Array.from({ length: 60 }, (_, i) => ({
          ...base,
          id: `facet-${i}`,
          title: `FacetDemo ${String(i).padStart(2, "0")}`,
          category: i < 30 ? "gpu" : "cpu",
          brand: i % 2 ? "AMD" : "NVIDIA",
          city: i % 2 ? "Espoo" : "Helsinki",
          priceMinor: 10000 + i * 1000,
          condition: "good",
          publishedAt: new Date(Date.now() - i * 60000).toISOString(),
          specs: {
            "Piirin valmistaja": i % 2 ? "AMD" : "NVIDIA",
            Näyttömuisti: i % 2 ? "8 GB" : "12 GB",
            "Ilmainen postitus": i % 3 === 0 ? "Kyllä" : "Ei",
          },
        })),
      ),
    );
  });
  await page.goto("/kategoriat/komponentit");
  await page.locator(".market-toolbar input").fill("FacetDemo");
  const panel = page.getByRole("complementary", { name: "Suodattimet" });
  const cards = page.locator(".listing-grid .listing-card");
  const pagination = page.getByRole("navigation", { name: "Tuotelistan sivut" });
  await expect(cards).toHaveCount(24);
  await pagination.getByRole("button", { name: "Sivu 2", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Näytönohjaimet", exact: true }).check();
  await expect(pagination.getByRole("status")).toHaveText("1–24 / 30 tuotetta");
  await panel.getByRole("checkbox", { name: "Prosessorit", exact: true }).check();
  await expect(pagination.getByRole("status")).toHaveText("1–24 / 60 tuotetta");
  await panel.getByRole("checkbox", { name: "Prosessorit", exact: true }).uncheck();
  await panel.getByRole("checkbox", { name: "12 GB", exact: true }).check();
  await expect(cards).toHaveCount(15);
  await panel.getByRole("checkbox", { name: "Ilmainen postitus", exact: true }).check();
  await expect(cards).toHaveCount(5);
  await panel.getByLabel("Ylin hinta", { exact: true }).fill("200");
  await expect(cards).toHaveCount(2);
  await page.locator(".market-toolbar select").selectOption("oldest");
  await expect(cards.first().locator(".card-title")).toHaveText("FacetDemo 06");
  await panel.getByLabel("Alin hinta", { exact: true }).fill("300");
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(cards).toHaveCount(0);
  await panel.getByRole("button", { name: "Tyhjennä suodattimet", exact: true }).click();
  await expect(cards).toHaveCount(24);
  await expect(pagination.getByRole("status")).toHaveText("1–24 / 60 tuotetta");
  await panel.getByRole("checkbox", { name: "Näytönohjaimet", exact: true }).check();
  await panel.getByRole("checkbox", { name: "12 GB", exact: true }).check();
  await page.goto("/kategoriat/virtalahteet");
  await expect(panel.getByText("Hyötysuhdeluokitus", { exact: true })).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: "12 GB", exact: true })).toHaveCount(0);
});

test("mobile filters expand, select categories and keep listings in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kategoriat/komponentit");
  const panel = page.getByRole("complementary", { name: "Suodattimet" });
  await expect(panel.getByRole("checkbox", { name: "Muistit", exact: true })).toBeHidden();
  await panel.getByRole("button", { name: /^Suodattimet/ }).click();
  await panel.getByRole("checkbox", { name: "Muistit", exact: true }).check();
  await panel.getByRole("checkbox", { name: "DDR5", exact: true }).check();
  await expect(page.locator(".listing-grid .listing-card").first()).toBeVisible();
  await panel.getByRole("button", { name: /^Suodattimet/ }).click();
  await expect(panel.getByRole("checkbox", { name: "DDR5", exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
