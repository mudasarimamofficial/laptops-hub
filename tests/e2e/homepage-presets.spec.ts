import { test, expect } from "@playwright/test";

const HERO = [
  "laptop-hub-hero-hp-lap.webp",
  "laptop-hub-hero-dell-lap.webp",
  "laptop-hub-hero-lenovo-lap.webp",
];
const STORY = [
  "dell-second_-home-sec-front.webp",
  "dell-second_-home-sec-left.webp",
  "dell-second_-home-sec-right.webp",
  "dell-second_-home-sec-rear.webp",
];

test.describe("Homepage approved image presets", () => {
  test("hero and product story use the seven CDN defaults", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const srcs = await page.locator("img").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
    for (const part of [...HERO, ...STORY]) {
      expect(srcs.some((s) => s.includes(part)), `missing ${part}`).toBeTruthy();
    }
    // Old cutout / replaced JPG heroes must not win for default products
    expect(srcs.some((s) => s.includes("dell7420-0.png"))).toBeFalsy();
    expect(srcs.some((s) => s.includes("hp640g2-0.png"))).toBeFalsy();
    expect(srcs.some((s) => s.includes("t580-0.png"))).toBeFalsy();
  });
});
