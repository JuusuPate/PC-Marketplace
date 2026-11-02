import { expect, test } from "@playwright/test";
test.use({ storageState: { cookies: [], origins: [] } });
const key = "pc-marketplace.cookie-consent";

test("first visit offers essential-only equally and remembers the decision across routes and reload", async ({
  page,
}) => {
  await page.goto("/rekisteroidy");
  const banner = page.getByRole("region", { name: "Evästeet ja selaintallennus" });
  await expect(banner).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  await banner.getByRole("button", { name: "Vain välttämättömät", exact: true }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).preferences, key)).toBe(false);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Luo tunnus", exact: true })).toBeVisible();
  await page.goto("/kategoriat/kaikki");
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Evästeasetukset", exact: true })).toBeVisible();
});

test("optional language storage stays off until accepted, can be customised and withdrawn", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Muokkaa asetuksia", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Kielivalinnan muistaminen", exact: true });
  await expect(toggle).not.toBeChecked();
  await page.getByRole("button", { name: "Tallenna valinnat", exact: true }).click();
  await page.getByRole("button", { name: "Suomi", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("pc-marketplace.language"))).toBeNull();
  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Remember language", exact: true }).check();
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "English", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("pc-marketplace.language"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "Suomi", exact: true })).toBeVisible();
});

test("accept-all enables the implemented preference; opening and closing settings does not accept anything else", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hyväksy kaikki", exact: true }).click();
  await page.getByRole("button", { name: "Evästeasetukset", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Kielivalinnan muistaminen", exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "Kielivalinnan muistaminen", exact: true }).uncheck();
  await page.keyboard.press("Escape");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).preferences, key)).toBe(true);
  await expect(page.getByRole("button", { name: "Evästeasetukset", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Evästeasetukset", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Kielivalinnan muistaminen", exact: true })).toBeChecked();
});

test("small screens fit the settings and blocked browser storage gives a usable in-memory choice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kirjaudu");
  await page.getByRole("button", { name: "Muokkaa asetuksia", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.getByRole("button", { name: "Vain välttämättömät", exact: true }).click();
  await expect(page.getByRole("region", { name: "Evästeet ja selaintallennus" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Selain esti");
  await expect(page.getByLabel("Sähköposti", { exact: true })).toBeEnabled();
});

test("expired consent asks again and removes the optional preference", async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, necessary: true, preferences: true, savedAt: 1 }));
      localStorage.setItem("pc-marketplace.language", "en");
    },
    { key },
  );
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Evästeet ja selaintallennus" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pc-marketplace.language"))).toBeNull();
});

test("withdrawing a preference also updates another open tab", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hyväksy kaikki", exact: true }).click();
  const second = await context.newPage();
  await second.goto("/rekisteroidy");
  await expect(second.getByRole("region", { name: "Evästeet ja selaintallennus" })).toHaveCount(0);
  await page.getByRole("button", { name: "Evästeasetukset", exact: true }).click();
  await page.getByRole("button", { name: "Vain välttämättömät", exact: true }).click();
  await second.getByRole("button", { name: "Evästeasetukset", exact: true }).click();
  await expect(second.getByRole("checkbox", { name: "Kielivalinnan muistaminen", exact: true })).not.toBeChecked();
  await second.close();
});
