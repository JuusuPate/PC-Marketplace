import { expect, test } from "@playwright/test";

test("demotilan suosikki ja ilmoitusraportti säilyvät sivun latauksessa", async ({ page }) => {
  await page.goto("/ilmoitukset/ryzen-7800x3d");
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("button", { name: "Tallennettu" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Tallennettu" })).toBeVisible();
  await page.getByRole("button", { name: /Suosikit: 1/ }).click();
  await expect(page).toHaveURL(/\/kirjaudu\?paluu=%2Foma-tili%2Fsuosikit$/);
  await page.getByRole("button", { name: "Käytä demotunnusta", exact: true }).click();
  await expect(page).toHaveURL(/\/oma-tili\/suosikit$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "AMD Ryzen 7 7800X3D", exact: true }).click();
  await page.getByRole("button", { name: "Ilmoita kohteesta" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Ilmoita ongelmasta" });
  await reportDialog.getByRole("combobox", { name: "Ilmoituksen syy" }).selectOption("other");
  await reportDialog.getByRole("button", { name: "Lähetä ilmoitus" }).click();
  await expect(reportDialog.getByRole("alert")).toContainText("vähintään 10 merkillä");
  await reportDialog.getByRole("textbox", { name: "Lisätiedot" }).fill("Ilmoituksessa on epäselviä tietoja.");
  await reportDialog.getByRole("button", { name: "Lähetä ilmoitus" }).click();
  await expect(page.getByRole("button", { name: /Ilmoitettu ylläpidolle/ })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("button", { name: /Ilmoitettu ylläpidolle/ })).toBeDisabled();
});
