import { expect, test, type Page } from "@playwright/test";

async function makePng(page: Page, width: number, height: number, name: string) {
  const dataUrl = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#b6ff4e");
      gradient.addColorStop(1, "#402370");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png");
    },
    { width, height },
  );

  return { name, mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") };
}

async function next(page: Page) {
  await page.getByRole("button", { name: "Jatka" }).click();
}

test("demoilmoitus julkaistaan, kuvat selataan ja säilyvät muokkauksessa", async ({ page }) => {
  await page.goto("/myy/uusi");
  await page.getByRole("button", { name: "Käytä demotunnusta" }).click();
  await expect(page.getByRole("heading", { name: "Luo uusi ilmoitus" })).toBeVisible();

  await page.locator('[data-listing-field="title"]').fill("Testinäytönohjain RTX 4070");
  await page.locator('[data-listing-field="price"]').fill("499");
  await next(page);

  await next(page);
  await expect(page.locator("#description-error")).toContainText("vähintään 20 merkkiä");
  await page
    .locator('[data-listing-field="description"]')
    .fill("Hyväkuntoinen näytönohjain alkuperäisessä pakkauksessa.");
  await next(page);

  const picker = page.locator(".image-picker__input");
  await picker.setInputFiles([await makePng(page, 400, 800, "pysty.png"), await makePng(page, 800, 400, "vaaka.png")]);
  await expect(page.locator(".image-picker__previews li")).toHaveCount(2);
  await next(page);

  await next(page);
  await expect(page.locator("#postal-code-error")).toContainText("viidellä numerolla");
  await page.locator('[data-listing-field="city"]').fill("Helsinki");
  await page.locator('[data-listing-field="postalCode"]').fill("00100");
  await page.locator('[data-listing-field="streetAddress"]').fill("Testikatu 12");
  await next(page);
  await page.getByRole("button", { name: "Julkaise ilmoitus" }).click();

  await expect(page).toHaveURL(/\/ilmoitukset\/listing-/);
  await expect(page.getByRole("heading", { name: "Testinäytönohjain RTX 4070" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seuraava kuva" })).toBeVisible();
  await page.getByRole("button", { name: "Seuraava kuva" }).click();
  await expect(page.locator(".listing-visual__image")).toHaveAttribute("alt", /Testinäytönohjain/);
  await expect(page.locator(".listing-visual__image")).toHaveCSS("object-fit", "contain");

  await page.reload();
  await page.getByRole("button", { name: "Muokkaa ilmoitusta" }).click();
  await expect(page.getByRole("heading", { name: "Muokkaa ilmoitusta" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: "3 Kuvat" })
    .click();
  await expect(page.locator(".image-picker__stored .image-picker__previews li")).toHaveCount(2);

  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Tuote$/ })
    .click();
  await page.locator('[data-listing-field="title"]').fill("Testinäytönohjain RTX 4070 päivitetty");
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Tarkistus$/ })
    .click();
  await page.getByRole("button", { name: "Tallenna muutokset" }).click();
  await expect(page.getByRole("heading", { name: "Testinäytönohjain RTX 4070 päivitetty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seuraava kuva" })).toBeVisible();

  await page.getByRole("button", { name: "Muokkaa ilmoitusta" }).click();
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Kuvat$/ })
    .click();
  await picker.setInputFiles(await makePng(page, 600, 400, "korvaava.png"));
  await expect(page.locator(".image-picker__previews li")).toHaveCount(1);
  await expect(page.locator(".image-picker__stored")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Ilmoituksen muokkauksen vaiheet" })
    .getByRole("button", { name: /Tarkistus$/ })
    .click();
  await page.getByRole("button", { name: "Tallenna muutokset" }).click();
  await expect(page.getByRole("heading", { name: "Testinäytönohjain RTX 4070 päivitetty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seuraava kuva" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".listing-visual__image")).toHaveCSS("object-fit", "contain");

  const listingPath = new URL(page.url()).pathname;
  await page.evaluate(() => {
    const key = "pc-marketplace.demo-session";
    const session = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...session, id: "demo-another-user" }));
  });
  await page.goto(`${listingPath}/muokkaa`);
  await expect(page.getByRole("heading", { name: "Voit muokata vain omia ilmoituksiasi" })).toBeVisible();
});
