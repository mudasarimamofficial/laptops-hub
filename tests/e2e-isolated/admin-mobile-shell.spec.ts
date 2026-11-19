/**
 * Merchant admin mobile shell: open/close nav, no page overflow, key routes operable at 390px.
 * Isolated stack only (.isolated/fixture.json).
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));

async function signInOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(overflow.scrollWidth, `horizontal overflow ${overflow.scrollWidth}>${overflow.clientWidth}`).toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

test.describe("admin mobile shell", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("admin-mobile-shell");
  });

  test("390px: open nav, visit settings/products/orders, no page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInOwner(page);

    const open = page.getByTestId("admin-nav-open");
    await expect(open).toBeVisible();
    const box = await open.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await open.click();
    const nav = page.getByRole("complementary", { name: "Admin navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText(/LAPTOPS/i)).toBeVisible();
    await expect(nav.getByText(/HUB/i)).toBeVisible();

    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await assertNoPageOverflow(page);
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();

    await page.getByTestId("admin-nav-open").click();
    await page.getByRole("complementary", { name: "Admin navigation" }).getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/admin\/products/);
    await assertNoPageOverflow(page);

    await page.getByTestId("admin-nav-open").click();
    await page.getByRole("complementary", { name: "Admin navigation" }).getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/admin\/orders/);
    await assertNoPageOverflow(page);
  });

  test("320px: login form usable; Escape closes admin drawer", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/admin/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await assertNoPageOverflow(page);

    await signInOwner(page);
    await page.getByTestId("admin-nav-open").click();
    const nav = page.locator('[aria-label="Admin navigation"]');
    await expect(nav).toHaveAttribute("data-admin-nav-open", "true");
    await page.keyboard.press("Escape");
    await expect(nav).toHaveAttribute("data-admin-nav-open", "false");
    await expect(nav).toHaveAttribute("aria-hidden", "true");
  });
});
