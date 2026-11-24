import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

/**
 * Reviews carousel must keep sliding over the section heading/padding and pause only on a review card.
 *
 * The section renders only with published testimonials and animates from 4 (MIN_FOR_MOTION), so this test seeds four
 * clearly labelled QA testimonials on the LOCAL isolated database and removes them afterwards (LH-024).
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const AUTHOR = (i: number) => `QA Hover ${RUN} ${i}`;

test.describe("reviews hover pause (card-only)", () => {
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    await assertLocalOnly("reviews hover seed");
    const rows = [1, 2, 3, 4].map((i) => ({
      author_name: AUTHOR(i),
      body: `QA fixture testimonial ${i} for the carousel hover test (local isolated database only).`,
      source: "merchant",
      status: "published",
      consent_confirmed: true,
      show_on_homepage: true,
      published_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("store_testimonials").insert(rows);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await sb.from("store_testimonials").delete().like("author_name", `QA Hover ${RUN} %`);
  });

  test("heading hover does not pause; card hover pauses", async ({ page }) => {
    // Published testimonials are cached for up to 60 s (tag "testimonials"); poll past it.
    const section = page.getByTestId("store-reviews");
    await expect(async () => {
      await page.goto("/");
      // The carousel repeats cards to loop seamlessly; any copy proves the seed is live.
      await expect(section.getByText(AUTHOR(1)).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 120_000, intervals: [5_000] });

    // 4 published entries ≥ MIN_FOR_MOTION: the section itself carries the (CSS-module) "animated" class.
    await expect(section).toHaveClass(/animated/);

    await section.scrollIntoViewIfNeeded();
    const track = section.locator("[data-dir]").first();
    await expect(track).toBeVisible();

    const title = section.getByRole("heading", { name: /What Our Customers Say/i });
    await title.hover();
    await page.waitForTimeout(200);
    const playStateOnHeading = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(playStateOnHeading).toBe("running");

    // Cards move continuously, so Playwright's "stable element" wait never settles: move the mouse to a card whose
    // centre is currently inside the viewport instead.
    const box = await section.getByTestId("store-review").evaluateAll((els) => {
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        if (cx > 40 && cx < window.innerWidth - 40 && r.top >= 0 && r.bottom <= window.innerHeight) return { x: cx, y: r.top + r.height / 2 };
      }
      return null;
    });
    expect(box, "a review card is on screen").not.toBeNull();
    await page.mouse.move(box!.x, box!.y);
    await page.waitForTimeout(200);
    const playStateOnCard = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(playStateOnCard).toBe("paused");

    await title.hover();
    await page.waitForTimeout(200);
    const resumed = await track.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(resumed).toBe("running");
  });
});
