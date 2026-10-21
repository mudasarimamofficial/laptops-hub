import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "docs", "visual-evidence");

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

const viewports = [
  { name: "desktop-1897x860", width: 1897, height: 860 },
  { name: "laptop-1440x900", width: 1440, height: 900 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

for (const vp of viewports) {
  test(`homepage visual ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /HUB|Laptops/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /smarter laptop/i })).toBeVisible();
    const skip = page.getByRole("button", { name: /skip intro/i });
    if (await skip.count()) await skip.click().catch(() => {});
    await page.waitForTimeout(400);
    // No developer placeholder copy on customer surface
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toContain("port next");
    expect(body.toLowerCase()).not.toContain("component in progress");
    await page.screenshot({ path: path.join(outDir, `home-${vp.name}.png`), fullPage: false });
  });
}

test("product story price panel visible at 1897x860", async ({ page }) => {
  await page.setViewportSize({ width: 1897, height: 860 });
  await page.goto(base + "/#story", { waitUntil: "networkidle" });
  const story = page.locator("#story");
  if (await story.count()) {
    await story.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Cash on delivery/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "story-1897x860.png"), fullPage: false });
  }
});

test("product story price panel visible at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/#story", { waitUntil: "networkidle" });
  const story = page.locator("#story");
  if (await story.count()) {
    await story.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Cash on delivery/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "story-390x844.png"), fullPage: false });
  }
});

test("search and collections reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + "/search?q=dell&sort=price_asc", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, "search-dell.png"), fullPage: false });
  await page.goto(base + "/collections/laptops", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, "collection-laptops.png"), fullPage: false });
});

test("reduced motion does not crash story", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toBeVisible();
});
