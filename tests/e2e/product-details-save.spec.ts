import { expect, test, type Page } from "@playwright/test";

async function startManual(page: Page, category: string) {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption(category);
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  if (!["pc", "fans"].includes(category))
    await page.getByRole("button", { name: "Kirjoitan itse", exact: true }).click();
  await page.locator('[data-listing-field="title"]').fill("Oma testituote");
  await page.locator('[data-listing-field="price"]').fill("50");
}

const categories = [
  { category: "gpu", field: "Piirimalli", value: "RTX 3080" },
  { category: "cpu", field: "Ytimien määrä", value: "6" },
  { category: "memory", field: "Kapasiteetti", value: "32 GB" },
  { category: "motherboard", field: "Piirisarja", value: "B550" },
  { category: "psu", field: "Teho (W)", value: "550 W" },
  { category: "storage", field: "Kapasiteetti", value: "1 TB" },
  { category: "case", field: "Kotelotyyppi", value: "Mid Tower" },
  { category: "cooling", field: "Jäähdytyksen tyyppi", value: "Ilmajäähy" },
  { category: "pc", field: null, value: "En tiedä teknisiä tietoja" },
  { category: "fans", field: null, value: "Oma testituote" },
  { category: "other", field: null, value: "Oma testituote" },
];
for (const { category, field, value } of categories) {
  test(`${category} product details save, reopen and survive description navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startManual(page, category);
    if (field)
      await page.getByLabel(field, { exact: true }).filter({ visible: true }).and(page.locator("input")).fill(value);
    if (category === "pc")
      await page.getByRole("checkbox", { name: "En tiedä teknisiä tietoja", exact: false }).check();
    await page.getByRole("button", { name: "Tallenna", exact: true }).click();
    const summary = page.locator(".listing-details-summary");
    await expect(summary).toContainText(value);
    await expect(page.locator('[data-listing-field="title"]')).not.toBeVisible();
    await expect(page.locator("#edit-saved-product-details")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Seuraava", exact: true }).click();
    await page.getByRole("button", { name: "Takaisin tuotetietoihin", exact: true }).click();
    await expect(summary).toContainText(value);
    await page.locator("#edit-saved-product-details").click();
    await expect(page.locator('[data-listing-field="title"]')).toHaveValue("Oma testituote");
    await expect(page.locator('[data-listing-field="price"]')).toHaveValue("50");
    if (field) await expect(page.getByLabel(field, { exact: true }).and(page.locator("input"))).toHaveValue(value);
    if (category === "pc")
      await expect(page.getByRole("checkbox", { name: "En tiedä teknisiä tietoja", exact: false })).toBeChecked();
  });
}

test("inconsistent RAM cannot be saved, and changing category clears the saved summary", async ({ page }) => {
  await startManual(page, "memory");
  await page.getByLabel("Kapasiteetti", { exact: true }).fill("32 GB");
  await page.getByLabel("Muistimoduulien määrä", { exact: true }).fill("2");
  await page.getByLabel("Moduulin kapasiteetti (GB)", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.locator("#profile-error")).toContainText("RAMin kokonaismäärän tulee vastata");
  await expect(page.locator("#edit-saved-product-details")).toHaveCount(0);
  await page.getByLabel("Moduulin kapasiteetti (GB)", { exact: true }).fill("16");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.locator(".listing-details-summary")).toContainText("32 GB");
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("cpu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await expect(page.getByRole("button", { name: "Kirjoitan itse", exact: true })).toBeVisible();
  await expect(page.locator(".listing-details-summary")).toHaveCount(0);
});

test("catalog details save without losing the model, and Muokkaa enables specification edits", async ({ page }) => {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("memory");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.getByRole("button", { name: "Tuotekatalogista", exact: true }).click();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("KF432C16BBK2/32");
  await page.getByRole("button", { name: "Kingston FURY Beast 32 GB (2 x 16 GB) DDR4-3200", exact: true }).click();
  await page.locator('[data-listing-field="price"]').fill("60");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.locator(".listing-details-summary")).toContainText("DDR4");
  await page.locator("#edit-saved-product-details").click();
  await expect(page.locator(".catalog-product-summary")).toContainText("DDR4");
  await page.getByRole("button", { name: "Muokkaa", exact: true }).click();
  await expect(page.getByLabel("Muistityyppi", { exact: true })).toHaveValue("DDR4");
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
});
