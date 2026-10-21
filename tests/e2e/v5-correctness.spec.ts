import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Correctness checks for fix/v5-correctness-parity. Needs a running app connected to the
 * real Supabase catalog (`npm run dev` or a Preview URL in PLAYWRIGHT_BASE_URL).
 */
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "docs", "visual-evidence", "correctness");
const PDP_HANDLES = [
  "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
  "hp-chromebook-14-g5-4-32",
  "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
];
const DRAFT_HANDLE = "dell-precision-7530-crm-identity-review";

test.beforeAll(() => fs.mkdirSync(outDir, { recursive: true }));

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

for (const handle of PDP_HANDLES) {
  test(`PDP curated specs + related images: ${handle}`, async ({ page }) => {
    const res = await page.goto(`${base}/products/${handle}`, { waitUntil: "networkidle" });
    test.skip(res?.status() === 404, "handle not public in this database");
    const specs = page.locator("section[aria-labelledby='pdp-specs'] dl");
    await expect(specs).toBeVisible();
    const labels = await specs.locator("dt").allInnerTexts();
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l).not.toMatch(/crm|source reference/i);
    const main = await page.locator("main").innerText();
    expect(main).not.toMatch(/Memory \(CRM config\)|Storage \(CRM config\)/);
    expect(main).not.toMatch(/\bcpu: /);

    const related = page.locator("section:has(h2:text-is('Related')) article");
    const n = await related.count();
    for (let i = 0; i < n; i++) {
      const img = related.nth(i).locator("img").first();
      if (await img.count()) {
        await expect(img).toHaveAttribute("src", /^https?:\/\//);
        expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
      } else {
        await expect(related.nth(i).getByText("No image")).toBeVisible();
      }
    }
  });
}

test("draft product is not public", async ({ page }) => {
  const res = await page.goto(`${base}/products/${DRAFT_HANDLE}`);
  expect(res?.status()).toBe(404);
  const api = await page.request.get(`${base}/api/catalog/compare-summary?handles=${DRAFT_HANDLE}`);
  expect((await api.json()).items).toEqual([]);
});

test("public cards never show Add to cart without a purchasable variant", async ({ page }) => {
  await page.goto(`${base}/collections/laptops`, { waitUntil: "networkidle" });
  const cards = page.locator("article");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 12); i++) {
    const c = cards.nth(i);
    const atc = await c.getByRole("button", { name: /^(Add to cart|Added)$/ }).count();
    const ask = await c.getByRole("button", { name: "Ask about this product" }).count();
    expect(atc + ask).toBe(1);
  }
});

for (const vp of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  test(`compare tray add/remove/persist/stale ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${base}/collections/laptops`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("lh-compare-v1"));
    await page.reload({ waitUntil: "networkidle" });

    const toggles = page.getByRole("button", { name: /^Compare$/ });
    await toggles.nth(0).click();
    await toggles.nth(0).click(); // first card's button is now "Comparing", so nth(0) is the next card
    const tray = page.getByRole("complementary", { name: "Comparison" });
    await expect(tray).toBeVisible();
    await expect(tray.getByText("2/4")).toBeVisible();
    await expect(tray.locator("img")).toHaveCount(2);
    for (const alt of await tray.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt") || ""))) {
      expect(alt).not.toMatch(/^[a-z0-9-]+$/); // not a raw handle
    }
    const box = await tray.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= vp.width).toBeTruthy();
    await shot(page, `tray-${vp.name}`);

    await page.reload({ waitUntil: "networkidle" });
    await expect(tray.getByText("2/4")).toBeVisible();

    await tray.getByRole("button", { name: /^Remove .+ from comparison$/ }).first().click();
    await expect(tray.getByText("1/4")).toBeVisible();

    // Stale/private handle is pruned, never rendered
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("lh-compare-v1") || "{}").handles as string[]);
    await page.evaluate(
      ([draft, keep]) => localStorage.setItem("lh-compare-v1", JSON.stringify({ handles: [draft, ...keep] })),
      [DRAFT_HANDLE, kept] as const,
    );
    await page.reload({ waitUntil: "networkidle" });
    await expect(tray.getByText("1/4")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lh-compare-v1") || "{}").handles))
      .toEqual(kept);

    await tray.getByRole("button", { name: "Clear all" }).click();
    await expect(tray).toHaveCount(0);
  });
}

test("compare page still renders curated rows", async ({ page }) => {
  await page.goto(`${base}/collections/laptops`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Compare$/ }).first().click();
  await page.goto(`${base}/compare`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Side by side" })).toBeVisible();
  const rowLabels = await page.locator("tbody th").allInnerTexts();
  expect(rowLabels.length).toBeGreaterThan(0);
  for (const l of rowLabels) expect(l).not.toMatch(/crm|source reference/i);
  await shot(page, "compare-page-1440");
});

test("cart honours max_per_order on PDP, drawer and cart page", async ({ page }) => {
  const handle = PDP_HANDLES[0];
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("lh-cart-v1"));
  const res = await page.goto(`${base}/products/${handle}`, { waitUntil: "networkidle" });
  test.skip(res?.status() === 404, "handle not public");
  const qty = page.getByLabel("Qty");
  const max = Number(await qty.getAttribute("max"));
  expect(max).toBeGreaterThanOrEqual(1);
  expect(max).toBeLessThanOrEqual(20);
  await qty.fill("99");
  await expect(qty).toHaveValue(String(max));
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).first().click(); // second add must not exceed the limit
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lh-cart-v1") || "{}").lines);
  expect(stored[0].quantity).toBe(max);
  expect(stored[0].maxPerOrder).toBe(max);
  await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
  const input = page.getByRole("spinbutton").first();
  await expect(input).toHaveAttribute("max", String(max));
  await input.fill("50");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lh-cart-v1") || "{}").lines[0].quantity))
    .toBe(max);
  await page.evaluate(() => localStorage.removeItem("lh-cart-v1"));
});

test("compare tray is keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/collections/laptops`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("lh-compare-v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Compare$/ }).first().focus();
  await page.keyboard.press("Enter");
  const tray = page.getByRole("complementary", { name: "Comparison" });
  await expect(tray.getByText("1/4")).toBeVisible();
  const removeBtn = tray.getByRole("button", { name: /^Remove .+ from comparison$/ });
  await removeBtn.focus();
  await expect(removeBtn).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tray).toHaveCount(0);
});

test("COD checkout stays disabled", async ({ request }) => {
  const res = await request.post(`${base}/api/checkout/cod`, { data: {} });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toBe("checkout_disabled");
});

// Inquiry submission is not exercised end to end: every public product is purchasable today
// (see docs/proposals/AVAILABILITY_INQUIRY_ONLY.md), and posting to /api/contact would write a real
// contact_inquiries row. Run it only against a non-production database.
test.skip("inquiry dialog submits to /api/contact (needs an inquiry-only product and a non-production DB)", () => {});
