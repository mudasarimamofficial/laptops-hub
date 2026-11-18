import { test, expect } from "@playwright/test";

/**
 * Buy-now storage is isolated from the main cart. This suite verifies client storage
 * contracts without placing a live production COD order.
 */
test.describe("buy-now checkout storage", () => {
  test("buy-now lines do not clear the main cart key", async ({ page }) => {
    await page.goto("/collections/all");
    await page.evaluate(() => {
      localStorage.setItem(
        "lh-cart-v1",
        JSON.stringify({
          lines: [
            {
              variantId: "00000000-0000-4000-8000-000000000001",
              handle: "existing-cart-item",
              title: "Existing cart item",
              unitPricePaisa: 100000,
              quantity: 1,
            },
          ],
        }),
      );
      sessionStorage.setItem(
        "lh-buynow-v1",
        JSON.stringify({
          lines: [
            {
              variantId: "00000000-0000-4000-8000-000000000002",
              handle: "buy-now-item",
              title: "Buy now item",
              unitPricePaisa: 200000,
              quantity: 1,
            },
          ],
          at: Date.now(),
        }),
      );
    });

    await page.goto("/checkout?mode=buy_now");
    await expect(page.getByRole("heading", { name: /Place COD order/i })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Buy now/i).first()).toBeVisible();

    const cartRaw = await page.evaluate(() => localStorage.getItem("lh-cart-v1"));
    expect(cartRaw).toBeTruthy();
    expect(cartRaw!).toContain("existing-cart-item");
  });

  test("empty buy-now mode shows empty state without wiping cart", async ({ page }) => {
    await page.goto("/collections/all");
    await page.evaluate(() => {
      sessionStorage.removeItem("lh-buynow-v1");
      localStorage.setItem(
        "lh-cart-v1",
        JSON.stringify({
          lines: [
            {
              variantId: "00000000-0000-4000-8000-000000000003",
              handle: "keep-me",
              title: "Keep me",
              unitPricePaisa: 150000,
              quantity: 1,
            },
          ],
        }),
      );
    });
    await page.goto("/checkout?mode=buy_now");
    await expect(page.getByText(/Nothing to check out|Browse products/i).first()).toBeVisible({ timeout: 60_000 });
    const cartRaw = await page.evaluate(() => localStorage.getItem("lh-cart-v1"));
    expect(cartRaw!).toContain("keep-me");
  });
});
