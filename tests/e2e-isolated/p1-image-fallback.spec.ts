/**
 * Storefront resilience (isolated): catalog photos are remote CDN files that can disappear. A product card whose
 * photo fails — or that has no approved photo yet — must show the gallery's "No image" state, never a broken/empty <img>.
 */
import { expect, test } from "@playwright/test";

test("product cards fall back to 'No image' when the CDN photo is gone", async ({ page }) => {
  let blocked = 0;
  await page.route(/cdn\.shopify\.com\/.*\.(jpg|jpeg|png|webp)/, (route) => {
    blocked += 1;
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("/collections/all");
  const cards = page.locator("article.v5-card");
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < (await cards.count()); i++) await cards.nth(i).scrollIntoViewIfNeeded();
  expect(blocked, "the catalog requested CDN photos").toBeGreaterThan(0);
  // Every card ends in the "No image" state (photos 404 here, or none was ever approved).
  await expect.poll(async () => (await cards.count()) - (await cards.filter({ hasText: "No image" }).count()), { timeout: 15_000 }).toBe(0);
  // No card keeps a broken image element.
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll("article.v5-card img")].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length))
    .toBe(0);
});
