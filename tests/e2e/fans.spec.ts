import { expect, test } from "@playwright/test";

test("fans appear under components and technical filters keep RGB separate from ARGB", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.goto("/");
  await page.evaluate(async () => {
    const { DEMO_LISTINGS } = await import("/src/data/demo-listings.ts");
    const base = DEMO_LISTINGS.find((item: any) => item.seller.countryCode === "FI");
    localStorage.setItem(
      "pc-marketplace.demo-listings",
      JSON.stringify([
        {
          ...base,
          id: "test-fan-1",
          title: "Test fan ARGB",
          category: "fans",
          specs: { fanSize: "120", fanLighting: "ARGB", fanControl: "PWM" },
        },
        {
          ...base,
          id: "test-fan-2",
          title: "Test fan RGB",
          category: "fans",
          specs: { fanSize: "140", fanLighting: "RGB", fanControl: "DC" },
        },
        { ...base, id: "test-cooler", title: "Test cooler", category: "cooling", specs: {} },
      ]),
    );
  });
  await page.goto("/kategoriat/komponentit");
  const panel = page.getByRole("complementary", { name: "Suodattimet" });
  await page.locator(".market-toolbar input").fill("Test");
  await panel.getByRole("checkbox", { name: "Tuulettimet", exact: true }).check();
  const cards = page.locator(".listing-grid .listing-card");
  await expect(cards).toHaveCount(2);
  await panel.getByRole("checkbox", { name: "ARGB", exact: true }).check();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Test fan ARGB");
  await page.goto("/kategoriat/tuulettimet");
  await expect(page.getByRole("heading", { name: "Tuulettimet", exact: true })).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: "120 mm", exact: true })).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: "AIO", exact: true })).toHaveCount(0);
});

test("seller can describe a fan using the new category and guided fields", async ({ page }) => {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta" }).click();
  await page.locator('[data-listing-field="category"]').selectOption("fans");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.locator('[data-listing-field="title"]').fill("ARCTIC P12 PWM PST");
  await page.locator('[data-listing-field="price"]').fill("10");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.getByLabel("Tuulettimen koko (mm)", { exact: true }).fill("120");
  await page.getByLabel("Tuulettimien määrä", { exact: true }).fill("3");
  await page.getByLabel("Tuulettimen liitin").selectOption("4-pin");
  await page.getByLabel("Tuulettimen nopeuden säätö").selectOption("PWM");
  await page.getByLabel("Tuulettimen valaistus").selectOption("Ei valaistusta");
  await expect(page.getByLabel("Prosessorikanta", { exact: true })).toHaveCount(0);
});
