import { expect, test, type Page, type Locator } from "@playwright/test";

async function start(page: Page, category: string) {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta" }).click();
  await page.locator('[data-listing-field="category"]').selectOption(category);
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
}

async function chooseMode(scope: Page | Locator, name: "Tuotekatalogista" | "Kirjoitan itse") {
  const change = scope.getByRole("button", { name: "Vaihda syöttötapaa", exact: true });
  if (await change.isVisible()) {
    await change.click();
    await expect(scope.getByRole("button", { name: "Tuotekatalogista", exact: true })).toBeFocused();
  }
  await scope.getByRole("button", { name, exact: true }).click();
  await expect(change).toBeFocused();
  await expect(scope.getByRole("button", { name: "Tuotekatalogista", exact: true })).toHaveCount(0);
  await expect(scope.getByRole("button", { name: "Kirjoitan itse", exact: true })).toHaveCount(0);
}

test("catalog CPU specs are visible and locked, manual mode preserves them and hides the catalog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "cpu");
  await expect(page.getByRole("button", { name: "Tuotekatalogista", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirjoitan itse", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(page.locator('[data-listing-field="title"]')).toHaveCount(0);
  await expect(page.locator('[data-listing-field="description"]')).not.toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(page.locator("#input-mode-error")).toHaveText("Valitse ensin, miten haluat antaa tuotteen tiedot.");
  await chooseMode(page, "Tuotekatalogista");
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
  await expect(page.locator(".catalog-input-mode-selected")).toContainText("Kirjoitan itse");
  await expect(page.getByRole("button", { name: "Tuotekatalogista", exact: true })).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveValue("6");
  await expect(page.getByLabel("Valmistaja", { exact: false })).toHaveValue("AMD");
  await chooseMode(page, "Tuotekatalogista");
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

test("missing catalog models switch to manual entry and preserve the entered listing details", async ({ page }) => {
  await start(page, "cpu");
  await chooseMode(page, "Tuotekatalogista");
  await expect(
    page.getByText("Jos tuotettasi ei löydy katalogista, voit kirjoittaa sen tiedot myös manuaalisesti.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator('[data-listing-field="title"]').fill("Oma prosessori ilman katalogimallia");
  await page.locator('[data-listing-field="price"]').fill("95");
  await page.getByRole("combobox", { name: "Kunto (Pakollinen tieto)", exact: true }).selectOption("excellent");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("RigiTestimalliJotaEiOle987654");
  const manual = page.getByRole("button", { name: "Malleja ei löytynyt. Täytä tiedot käsin", exact: true });
  await expect(manual).toBeVisible();
  await manual.press("Enter");
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(page.locator(".listing-profile-catalog")).toHaveCount(0);
  await expect(page.locator(".catalog-input-mode-selected")).toContainText("Kirjoitan itse");
  await expect(page.getByRole("button", { name: "Vaihda syöttötapaa", exact: true })).toBeFocused();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("Oma prosessori ilman katalogimallia");
  await expect(page.locator('[data-listing-field="price"]')).toHaveValue("95");
  await expect(page.getByRole("combobox", { name: "Kunto (Pakollinen tieto)", exact: true })).toHaveValue("excellent");
  await page.getByLabel("Valmistaja", { exact: false }).fill("AMD");
  await page.getByLabel("Ytimien määrä", { exact: true }).fill("8");
  await expect(page.getByLabel("Ytimien määrä", { exact: true })).toHaveValue("8");
});

test("RAM and storage expose capacities without SKU, PCIe or interface inputs; PSU has dropdowns", async ({ page }) => {
  await start(page, "memory");
  await chooseMode(page, "Tuotekatalogista");
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
  await expect(page.getByRole("button", { name: "Tuotekatalogista", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await chooseMode(page, "Tuotekatalogista");
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
  await chooseMode(page, "Kirjoitan itse");
  await page.getByRole("combobox", { name: "Hyötysuhdeluokitus", exact: true }).selectOption("80+ Gold");
  await page.getByRole("combobox", { name: "Koko", exact: true }).selectOption("SFX");
});

test("PC has separate component catalogs and no whole-PC catalog", async ({ page }) => {
  await start(page, "pc");
  await expect(page.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  const cpu = page.getByRole("group", { name: "Prosessori", exact: true });
  await chooseMode(cpu, "Tuotekatalogista");
  await cpu.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 5 5600");
  await cpu.getByRole("button", { name: "AMD Ryzen 5 5600", exact: true }).click();
  await expect(cpu.locator(".pc-component__selection")).toHaveText("AMD Ryzen 5 5600");
  await cpu.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("RigiTestimalliJotaEiOle987654");
  await cpu.getByRole("button", { name: "Malleja ei löytynyt. Täytä tiedot käsin", exact: true }).click();
  await expect(cpu.getByRole("searchbox", { name: "Hae tuotemallia" })).toHaveCount(0);
  await expect(cpu.getByRole("textbox", { name: "Prosessori", exact: true })).toHaveValue("AMD Ryzen 5 5600");
  const ram = page.getByRole("group", { name: "Keskusmuisti (RAM)", exact: true });
  await chooseMode(ram, "Tuotekatalogista");
  await ram.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("KF432C16BBK2/32");
  await ram.getByRole("button", { name: "Kingston FURY Beast 32 GB (2 x 16 GB) DDR4-3200", exact: true }).click();
  await chooseMode(ram, "Kirjoitan itse");
  await expect(ram.getByLabel("RAM yhteensä (GB)", { exact: true })).toHaveValue("32 GB");
  await expect(ram.getByLabel("RAM-muistin tyyppi", { exact: true })).toHaveValue("DDR4");
});

test("changing a catalog product clears its title and specifications", async ({ page }) => {
  await start(page, "cpu");
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Ryzen 5 5600");
  await page.getByRole("button", { name: "AMD Ryzen 5 5600", exact: true }).click();
  await page.locator('[data-listing-field="title"]').fill("Oma Ryzen-otsikko");
  await page.getByRole("button", { name: "Vaihda tuotetta", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("");
  await expect(page.locator(".catalog-product-summary")).toHaveCount(0);
  await chooseMode(page, "Kirjoitan itse");
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
  await chooseMode(page, "Tuotekatalogista");
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
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("GTX1060");
  await expect(page.getByRole("button", { name: "NVIDIA GTX 1060 3 GB", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "NVIDIA GTX 1060 6 GB", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NVIDIA GTX 1060 3 GB", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("GTX 1060 3 GB");
});

test("new laptop RAM, HDD and Wi-Fi motherboard populate locked specifications", async ({ page }) => {
  await start(page, "memory");
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("PVS416G320C8S");
  await page
    .getByRole("button", { name: "Patriot Viper Steel 16 GB (1 x 16 GB) DDR4-3200 CL18 SO-DIMM", exact: true })
    .click();
  const summary = page.locator(".catalog-product-summary");
  await expect(summary).toContainText("Muistimoduulin kokoSO-DIMM");
  await expect(summary).toContainText("Muistimoduulien määrä1");
  await expect(page.getByLabel("Muistimoduulin koko", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-listing-field="title"]')).not.toHaveValue(/PVS416/);
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("storage");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("ST2000DM");
  await expect(page.getByRole("button", { name: "Seagate BarraCuda 2 TB 5400 rpm", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Seagate BarraCuda 2 TB 7200 rpm", exact: true }).click();
  await expect(summary).toContainText("Tallennuslaitteen tyyppiSATA HDD");
  await expect(summary).toContainText('Tallennuslaitteen koko3.5"');
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("motherboard");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("B860 Pro RS WiFi");
  await page.getByRole("button", { name: "ASRock B860 Pro RS WiFi", exact: true }).click();
  await expect(summary).toContainText("LGA 1851");
  await expect(summary).toContainText("Wi-FiKyllä");
  await expect(summary).toContainText("BluetoothKyllä");
});

test("ADATA DDR5 kits and fractional GTX memory keep the correct title and specifications", async ({ page }) => {
  await start(page, "memory");
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("AX5U6000C3016G-DTLABBK");
  await page
    .getByRole("button", { name: "ADATA XPG LANCER BLADE 32 GB (2 x 16 GB) DDR5-6000 CL30 DIMM", exact: true })
    .click();
  await expect(page.locator(".catalog-product-summary")).toContainText("Muistimoduulien määrä2");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(
    "ADATA XPG LANCER BLADE 32 GB (2×16 GB) DDR5 6000 MHz CL30",
  );
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("gpu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("GTX460");
  await expect(page.getByRole("button", { name: "NVIDIA GTX 460 1 GB", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NVIDIA GTX 460 0.75 GB", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("GTX 460 0.75 GB");
  await expect(page.getByLabel("Näyttömuisti", { exact: true })).toHaveValue("0.75 GB");
  await page.getByRole("button", { name: "Vaihda tuotetta", exact: true }).click();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("GTX560Ti");
  await expect(page.getByRole("button", { name: "NVIDIA GTX 560 Ti 1 GB", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NVIDIA GTX 560 Ti 2 GB", exact: true }).click();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("GTX 560 Ti 2 GB");
});

test("new cases and PSUs fill locked compatibility, size and correct efficiency in the title", async ({ page }) => {
  await start(page, "case");
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Terra");
  await page.getByRole("button", { name: "Fractal Design Terra", exact: true }).click();
  const summary = page.locator(".catalog-product-summary");
  await expect(summary).toContainText("Mini-ITX");
  await expect(summary).toContainText("Pieni kotelo");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("Fractal Design Terra Mini-ITX kotelo");
  await expect(page.getByLabel("Koko", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("psu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("SFX L Power");
  await page.getByRole("button", { name: "be quiet! SFX L Power 600 W", exact: true }).click();
  await expect(summary).toContainText("SFX-L");
  await expect(summary).toContainText("80+ Gold");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("be quiet! SFX L Power 600 W 80+ Gold SFX-L");
  await expect(page.getByRole("combobox", { name: "Hyötysuhdeluokitus", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Vaihda tuotetta", exact: true }).click();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("RM650e");
  await page.getByRole("button", { name: "Corsair RM650e 2025", exact: true }).click();
  await expect(summary).toContainText("Cybenetics Gold");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(
    "Corsair RM650e 2025 650 W Cybenetics Gold ATX",
  );
});

test("new manufacturers expose case width constraints and small PSU efficiency in the listing", async ({ page }) => {
  await start(page, "case");
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("Antec C8");
  await page.getByRole("button", { name: "Antec C8 ARGB", exact: true }).click();
  const summary = page.locator(".catalog-product-summary");
  await expect(summary).toContainText("E-ATX (enintään 280 mm)");
  await expect(summary).toContainText("Full Tower");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(/Antec C8 ARGB/);
  await page.getByRole("button", { name: "Takaisin", exact: true }).click();
  await page.locator('[data-listing-field="category"]').selectOption("psu");
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  await chooseMode(page, "Tuotekatalogista");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("ROG Loki");
  await page.getByRole("button", { name: "ASUS ROG Loki 1200 W ATX 3.1", exact: true }).click();
  await expect(summary).toContainText("80+ Titanium");
  await expect(summary).toContainText("SFX-L");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(
    /ASUS ROG Loki 1200 W ATX 3.1 80\+ Titanium SFX-L/,
  );
  await expect(page.getByRole("combobox", { name: "Hyötysuhdeluokitus", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Vaihda tuotetta", exact: true }).click();
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("PK550D");
  await page.getByRole("button", { name: "DeepCool PK550D", exact: true }).click();
  await expect(summary).toContainText("80+ Bronze");
  await expect(summary).toContainText("550");
  await expect(page.locator('[data-listing-field="title"]')).not.toHaveValue(/Loki|Titanium|SFX/);
});
