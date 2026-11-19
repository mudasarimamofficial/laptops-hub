/**
 * Compact grouped desktop mega menu + uppercase LAPTOPS HUB wordmark.
 * Requires local storefront (assertLocalOnly); does not mutate data.
 */
import { expect, test } from "@playwright/test";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.describe("compact mega menu + uppercase wordmark", () => {
  test.beforeEach(async () => {
    await assertLocalOnly("mega-menu-wordmark");
  });

  test("desktop mega stays compact and switches groups", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 680 });
    await page.goto("/");
    const home = page.getByRole("link", { name: /laptops hub home/i }).first();
    await expect(home).toBeVisible();
    await expect(home).toContainText(/LAPTOPS/);
    await expect(home).toContainText(/HUB/);

    const trigger = page.getByTestId("desktop-mega-trigger");
    await trigger.hover();
    const panel = page.getByTestId("desktop-mega-menu");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeLessThanOrEqual(440);

    const groups = page.locator("[data-testid^=mega-group-]");
    expect(await groups.count()).toBeGreaterThan(1);
    await groups.nth(1).click();
    await expect(groups.nth(1)).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("desktop-mega-close").click();
    await expect(panel).toHaveCount(0);
  });

  test("Escape closes mega menu", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByTestId("desktop-mega-trigger").click();
    await expect(page.getByTestId("desktop-mega-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("desktop-mega-menu")).toHaveCount(0);
  });
});
