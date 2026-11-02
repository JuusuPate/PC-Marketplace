import { expect, test } from "@playwright/test";

test("header opens a standalone sign-in page and mode changes follow browser history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu", exact: true }).click();
  await expect(page).toHaveURL(/\/kirjaudu$/);
  await expect(page.getByRole("heading", { name: "Kirjaudu sisään", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#home-latest")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jatka Googlella" })).toBeVisible();
  await page.getByRole("link", { name: "Luo tunnus", exact: true }).click();
  await expect(page).toHaveURL(/\/rekisteroidy$/);
  await expect(page.getByLabel("Näyttönimi", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jatka Googlella" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Kirjaudu sisään", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sähköposti", { exact: true })).toBeVisible();
});

test("email registration checks confirmation and returns to the requested listing flow", async ({ page }) => {
  await page.goto("/rekisteroidy?paluu=%2Fmyy%2Fuusi");
  await page.getByLabel("Näyttönimi", { exact: true }).fill("Uusi käyttäjä");
  await page.getByLabel("Sähköposti", { exact: true }).fill("test@example.test");
  await page.getByLabel("Salasana", { exact: true }).fill("pitka-salasana");
  await page.getByLabel("Vahvista salasana", { exact: true }).fill("eri-salasana");
  await page.locator("form").getByRole("button", { name: "Luo tunnus", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Salasanat eivät täsmää");
  await page.getByLabel("Vahvista salasana", { exact: true }).fill("pitka-salasana");
  await page.locator("form").getByRole("button", { name: "Luo tunnus", exact: true }).click();
  await expect(page).toHaveURL(/\/myy\/uusi$/);
  await expect(page.getByRole("heading", { name: "Luo uusi ilmoitus" })).toBeVisible();
});

test("a disabled Google provider shows an inline alternative without leaving the site", async ({ page }) => {
  await page.goto("/rekisteroidy");
  await page.getByRole("button", { name: "Jatka Googlella" }).click();
  await expect(page.getByRole("alert")).toContainText("Voit jatkaa sähköpostilla");
  await expect(page).toHaveURL(/\/rekisteroidy$/);
  await expect(page.getByLabel("Sähköposti", { exact: true })).toBeEnabled();
});

test("sign-in destinations cannot send the user off-site", async ({ page }) => {
  await page.goto("/kirjaudu?paluu=https%3A%2F%2Foutside.test");
  await page.getByRole("button", { name: "Käytä demotunnusta", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4183\/$/);
});

test("the authentication form fits a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kirjaudu");
  await expect(page.getByRole("heading", { name: "Kirjaudu sisään", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jatka Googlella" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
