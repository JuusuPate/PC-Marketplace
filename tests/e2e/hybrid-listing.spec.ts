import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, category: string) {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta" }).click();
  await page.locator('[data-listing-field="category"]').selectOption(category);
  await page.getByRole("button", { name: "Jatka", exact: true }).click();
  if (!["pc", "fans"].includes(category)) await page.getByRole("radio", { name: "Tuotekatalogista" }).check();
  await page.locator('[data-listing-field="price"]').fill("300");
}
const next = (page: Page) => page.getByRole("button", { name: "Jatka", exact: true }).click();
async function publish(page: Page) {
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await page
    .locator('[data-listing-field="description"]')
    .fill("Kaikki kauppaan sisältyvät osat on eritelty ilmoituksen tiedoissa.");
  await next(page);
  await next(page);
  await page.locator('[data-listing-field="city"]').fill("Helsinki");
  await page.locator('[data-listing-field="postalCode"]').fill("00100");
  await page.locator('[data-listing-field="streetAddress"]').fill("Testikatu 12");
  await next(page);
  await page.getByRole("button", { name: "Julkaise ilmoitus", exact: true }).click();
  await expect(page).toHaveURL(/\/ilmoitukset\/listing-/);
}

test("hybrid GPU core survives maker/variant edits and custom titles stay under user control", async ({ page }) => {
  const modelId = "00000000-0000-4000-8000-000000009999";
  await page.route("**/src/lib/product-model-service.ts", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\nloadProductModels=async(category,query)=>({total:1,unlinked_listings:0,items:[{id:'${modelId}',category:'gpu',brand:'NVIDIA',name:'GeForce RTX 3080',variant:'10 GB',aliases:'',is_active:true,updated_at:'2026-09-29T10:00:00Z'}]});`,
    });
  });
  await start(page, "gpu");
  await page.getByRole("searchbox", { name: "Hae tuotemallia" }).fill("3080");
  await page.getByRole("button", { name: "NVIDIA RTX 3080 10 GB", exact: true }).click();
  await page.getByLabel("Merkki", { exact: false }).fill("MSI");
  await page.getByLabel(/^Malli/).fill("Gaming X Trio");
  await expect(page.getByText("Katalogimalli valittu")).toBeVisible();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("MSI Gaming X Trio RTX 3080 10 GB");
  await page.locator('[data-listing-field="title"]').fill("Oma näytönohjaimen otsikko");
  await page.getByLabel(/^Malli/).fill("Ventus");
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("Oma näytönohjaimen otsikko");
  await expect(page.getByLabel("Piirimalli", { exact: true })).toHaveValue("RTX 3080");
  await publish(page);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pc-marketplace.demo-listings")!).find(
      (l: any) => l.title === "Oma näytönohjaimen otsikko",
    ),
  );
  expect(saved).toMatchObject({
    catalogModelId: modelId,
    brand: "MSI",
    specs: { brand: "MSI", model: "Ventus", coreModel: "RTX 3080", vram: "10 GB" },
  });
});

test("RAM uses capacity and module fields without an exact model number", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "memory");
  await page.getByRole("radio", { name: "Kirjoitan itse" }).check();
  await page.getByLabel("Merkki", { exact: false }).fill("Kingston");
  await page.getByLabel(/^Malli/).fill("Fury Beast");
  await page.getByLabel("Kapasiteetti", { exact: true }).fill("32 GB");
  await page.getByLabel("Muistityyppi", { exact: true }).fill("DDR4");
  await page.getByLabel("Muistimoduulien määrä", { exact: true }).fill("2");
  await page.getByLabel("Moduulin kapasiteetti (GB)", { exact: true }).fill("16");
  await page.getByLabel("Nopeus", { exact: true }).fill("3200");
  await page.getByLabel("CAS-viive (CL)", { exact: true }).fill("16");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const expected = "Kingston Fury Beast 32 GB (2×16 GB) DDR4 3200 MHz CL16";
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue(expected);
  await publish(page);
  await expect(page.getByRole("heading", { name: expected, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Muokkaa ilmoitusta" }).click();
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Tuotetiedot$/ })
    .click();
  await expect(page.getByLabel("Moduulin kapasiteetti (GB)", { exact: true })).toHaveValue("16");
  await expect(page.getByLabel("Muistityyppi", { exact: true })).toHaveValue("DDR4");
});

test("incomplete PC parts and RGB persist, edit correctly and filter in marketplace", async ({ page }) => {
  await start(page, "pc");
  await page.getByLabel("RGB-valaistus", { exact: false }).check();
  const parts = page.locator(".pc-component");
  for (const part of await parts.all()) await part.getByRole("checkbox", { name: "En tiedä", exact: true }).check();
  const processor = page.getByRole("group", { name: "Prosessori", exact: true });
  await processor.getByRole("checkbox", { name: "En tiedä", exact: true }).uncheck();
  await processor.getByLabel("Prosessori", { exact: true }).fill("Ryzen 5 5600");
  const gpu = page.getByRole("group", { name: "Näytönohjain", exact: true });
  await gpu.getByRole("checkbox", { name: "Puuttuu / ei mukana", exact: true }).check();
  await expect(page.locator('[data-listing-field="title"]')).toHaveValue("Keskeneräinen kokoonpano Ryzen 5 5600 RGB");
  await publish(page);
  await expect(page.getByText("Puuttuu / ei mukana", { exact: true })).toBeVisible();
  await expect(page.locator(".listing-rgb-tag")).toHaveText("RGB");
  await page.reload();
  await page.getByRole("button", { name: "Muokkaa ilmoitusta" }).click();
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Tuotetiedot$/ })
    .click();
  await expect(gpu.getByRole("checkbox", { name: "Puuttuu / ei mukana", exact: true })).toBeChecked();
  await expect(page.getByLabel("RGB-valaistus", { exact: false })).toBeChecked();
  await page.goto("/kategoriat/pelitietokoneet");
  const panel = page.getByRole("complementary", { name: "Suodattimet" });
  await panel.getByRole("checkbox", { name: "RGB-valaistus (myös ARGB)", exact: true }).check();
  const card = page.locator(".listing-card").filter({ hasText: "Keskeneräinen kokoonpano Ryzen 5 5600 RGB" });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".listing-rgb-tag")).toHaveText("RGB");
});
