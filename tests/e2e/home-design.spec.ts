import { expect, test } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`merged home design keeps navigation and content usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const highlights = page.getByRole("region", { name: "Markkinapaikan esittely" });
    await expect(highlights.getByRole("heading")).toHaveCount(3);
    await expect(highlights.getByRole("heading", { name: "Harrastajilta toisille" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Suomi", exact: true }).click();
    await expect(page.getByRole("menu", { name: "Select language" })).toBeVisible();
    await page.getByRole("menuitemradio", { name: "English", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Marketplace highlights" })
        .getByRole("heading", { name: "Ready-made solutions" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Select language" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "English", exact: true })).toBeFocused();
    await page.locator(".site-footer").getByRole("link", { name: "Safety", exact: true }).click();
    await expect(page).toHaveURL(/\/turvallisuus$/);
    await expect(page.locator(".safety-hero")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Dashboard tarvitsee palveluyhteyden" })).toBeVisible();
  });
}
