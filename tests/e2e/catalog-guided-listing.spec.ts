import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, category: string) {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta" }).click();
  await page.locator('[data-listing-field="category"]').selectOption(category);
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
}

test("catalog CPU specs are visible and locked, manual mode preserves them and hides the catalog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "cpu");
  await expect(page.getByRole("radio", { name: "Tuotekatalogista" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Kirjoitan itse" })).not.toBeChecked();
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(page.locator('[data-listing-field="title"]')).toHaveCount(0);
  await expect(page.locator('[data-listing-field="description"]')).not.toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(page.locator("#input-mode-error")).toHaveText("Valitse ensin, miten haluat antaa tuotteen tiedot.");
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await expect(page.locator("#input-mode-error")).toHaveCount(0);
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 5 5600");
  await page.getByRole("button", { name: "AMD Ryzen 5 5600", exact: true }).click();
  const summary = page.locator(".catalog-product-summary");
  await expect(summary).toContainText("Ytimien määrä6");
  await expect(summary).toContainText("SarjaRyzen 5");
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Muokkaa manuaalisesti" }).click();
  await expect(page.getByRole("radio", { name: "Kirjoitan itse" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Tuotekatalogista" })).not.toBeChecked();
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveValue("6");
  await expect(page.getByLabel("Valmistaja", { exact: false })).toHaveValue("AMD");
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 7 5800X");
  await page.getByRole("button", { name: "AMD Ryzen 7 5800X", exact: true }).click();
  await expect(summary).toContainText("Ytimien määrä8");
  await page.locator('[data-listing-field="price"]').fill("150");
  await expect(page.getByLabel("Ilmainen postitus", { exact: true })).not.toBeVisible();
  await expect(page.locator('[data-listing-field="description"]')).not.toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(summary).not.toBeVisible();
  await expect(page.locator("#product-details-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: "Takaisin tuotetietoihin", exact: true }).click();
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-listing-field="price"]')).toHaveValue("150");
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await page.locator('[data-listing-field="description"]').fill("Toimiva prosessori, tarkat tiedot yllä katalogista.");
  await page.getByRole("button", { name: "Takaisin tuotetietoihin", exact: true }).click();
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-listing-field="description"]')).not.toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(page.locator('[data-listing-field="description"]')).toHaveValue(
    "Toimiva prosessori, tarkat tiedot yllä katalogista.",
  );
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Tuotekuvat/ })).toBeVisible();
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.locator('[data-listing-field="city"]').fill("Helsinki");
  await page.locator('[data-listing-field="postalCode"]').fill("00100");
  await page.locator('[data-listing-field="streetAddress"]').fill("Testikatu 12");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.getByRole("button", { name: "Julkaise ilmoitus", exact: true }).click();
  await expect(page).toHaveURL(/\/ilmoitukset\/listing-/);
  await page.getByRole("button", { name: "Muokkaa ilmoitusta" }).click();
  await page.getByRole("button", { name: /Tuotetiedot$/ }).click();
  await expect(summary).toContainText("Ytimien määrä8");
  await expect(summary).toContainText("Ryzen 7 5800X");
});

test("RAM and storage expose capacities without SKU, PCIe or interface inputs; PSU has dropdowns", async ({ page }) => {
  await start(page, "memory");
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("KF432C16BBK2/32");
  const option = page.getByRole("button", { name: "Kingston FURY Beast 32 GB (2 x 16 GB) DDR4-3200", exact: true });
  await expect(option).not.toContainText("KF432");
  await option.click();
  await expect(page.locator(".catalog-product-summary")).toContainText("Muistimoduulien määrä2");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(
    "Kingston FURY Beast 32 GB (2×16 GB) DDR4 3200 MHz CL16",
  );
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("storage");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Tuotekatalogista" })).not.toBeChecked();
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("990 PRO 2 TB");
  await page.getByRole("button", { name: "Samsung 990 PRO 2 TB", exact: true }).click();
  await expect(page.locator(".catalog-product-summary")).toContainText("Tallennuslaitteen kokoM.2");
  await page.getByRole("button", { name: "Muokkaa manuaalisesti" }).click();
  await expect(page.getByLabel("Kapasiteetti", { exact: true })).toHaveValue("2 TB");
  await expect(page.getByLabel("Liitäntä", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("PCIe-sukupolvi", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("psu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.getByRole("radio", { name: "Kirjoitan itse" }).check();
  await page.getByRole("combobox", { name: "Hyötysuhdeluokitus", exact: true }).selectOption("80+ Gold");
  await page.getByRole("combobox", { name: "Koko", exact: true }).selectOption("SFX");
});

test("PC has separate component catalogs and no whole-PC catalog", async ({ page }) => {
  await start(page, "pc");
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  const cpu = page.getByRole("group", { name: "Prosessori", exact: true });
  await cpu.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await cpu.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 5 5600");
  await cpu.getByRole("button", { name: "AMD Ryzen 5 5600", exact: true }).click();
  await expect(cpu.locator(".pc-component__selection")).toHaveText("AMD Ryzen 5 5600");
  const ram = page.getByRole("group", { name: "Keskusmuisti (RAM)", exact: true });
  await ram.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await ram.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("KF432C16BBK2/32");
  await ram.getByRole("button", { name: "Kingston FURY Beast 32 GB (2 x 16 GB) DDR4-3200", exact: true }).click();
  await ram.getByRole("radio", { name: "Kirjoitan itse" }).check();
  await expect(ram.getByLabel("RAM yhteensä (GB)", { exact: true })).toHaveValue("32 GB");
  await expect(ram.getByLabel("RAM-muistin tyyppi", { exact: true })).toHaveValue("DDR4");
});

test("changing a catalog product clears its title and specifications", async ({ page }) => {
  await start(page, "cpu");
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 5 5600");
  await page.getByRole("button", { name: "AMD Ryzen 5 5600", exact: true }).click();
  await page.locator('[data-listing-field="title"]').fill("Oma Ryzen-otsikko");
  await page.getByRole("button", { name: "Vaihda tuotetta", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("");
  await expect(page.locator(".catalog-product-summary")).toHaveCount(0);
  await page.getByRole("radio", { name: "Kirjoitan itse" }).check();
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Valmistaja", { exact: false })).toHaveValue("");
  await page.locator('[data-listing-field="title"]').fill("Vanha otsikko");
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("fans");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("");
});

test("expanded RAM kits and legacy GTX VRAM versions populate the listing correctly", async ({ page }) => {
  await start(page, "memory");
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("CMK32GX4M4B3200C16");
  await page
    .getByRole("button", { name: "Corsair VENGEANCE LPX 32 GB (4 x 8 GB) DDR4-3200 CL16 DIMM", exact: true })
    .click();
  await expect(page.locator(".catalog-product-summary")).toContainText("Muistimoduulien määrä4");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(
    "Corsair VENGEANCE LPX 32 GB (4×8 GB) DDR4 3200 MHz CL16",
  );
  await expect(page.locator('[data-listing-field="title"]')).not.toHaveValue(/CMK/);
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("gpu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("GTX1060");
  await expect(page.getByRole("button", { name: "NVIDIA GTX 1060 3 GB", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "NVIDIA GTX 1060 6 GB", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NVIDIA GTX 1060 3 GB", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("GTX 1060 3 GB");
});
