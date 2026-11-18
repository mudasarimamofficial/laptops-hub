import { test, expect } from "@playwright/test";

/**
 * Reviews carousel must keep sliding over the section heading/padding and pause only on a review card.
 */
test.describe("reviews hover pause (card-only)", () => {
  test("heading hover does not pause; card hover pauses", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section").filter({ hasText: "What Our Customers Say" }).first();
    await expect(section).toBeVisible({ timeout: 60_000 });

    const animated = section.locator(".animated, [class*='animated']").first();
    const hasAnimated = (await animated.count()) > 0;
    test.skip(!hasAnimated, "Fewer than MIN_FOR_MOTION reviews — static row, no autoplay to pause");

    const track = animated.locator("[class*='track']").first();
    await expect(track).toBeVisible();

    const title = section.getByRole("heading", { name: /What Our Customers Say/i });
    await title.hover();
    await page.waitForTimeout(200);
    const playStateOnHeading = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(playStateOnHeading).toBe("running");

    const card = section.getByTestId("store-review").first();
    await card.hover();
    await page.waitForTimeout(200);
    const playStateOnCard = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(playStateOnCard).toBe("paused");

    await title.hover();
    await page.waitForTimeout(200);
    const resumed = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(resumed).toBe("running");
  });
});
