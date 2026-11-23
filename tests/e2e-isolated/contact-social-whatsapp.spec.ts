import { expect, test } from "@playwright/test";

/** Read-only layout/commerce suite — local base only. */
function assertLocalBase() {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(base.replace(/\/$/, ""))) {
    throw new Error(`contact-social-whatsapp refuses non-local baseURL: ${base}`);
  }
}

test.describe("contact social whatsapp storefront", () => {
  test.beforeEach(() => {
    assertLocalBase();
  });

  test("footer shows exact default contacts and social URLs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("footer-address")).toContainText("Al Raheem Center Plaza");
    await expect(page.getByTestId("footer-email")).toHaveAttribute("href", "mailto:infolaptopshub@gmail.com");
    await expect(page.getByTestId("footer-phone-p1")).toHaveAttribute("href", "tel:03093372974");
    await expect(page.getByTestId("footer-phone-p2")).toHaveAttribute("href", "tel:03136565663");
    await expect(page.getByTestId("footer-phone-p3")).toHaveAttribute("href", "tel:03399100199");
    await expect(page.getByTestId("footer-social-facebook")).toHaveAttribute("href", "https://www.facebook.com/LaptopshubII.pk");
    await expect(page.getByTestId("footer-social-instagram")).toHaveAttribute("href", "https://www.instagram.com/laptopshub.pk");
    await expect(page.getByTestId("footer-social-tiktok")).toHaveAttribute("href", "https://www.tiktok.com/@laptopshub.pk");
    await expect(page.getByTestId("footer-social-youtube")).toHaveAttribute("href", "https://www.youtube.com/@Laptopshub");
    await expect(page.getByTestId("footer-whatsapp")).toHaveAttribute("href", "https://api.whatsapp.com/message/NT5WBBX234POA1");
  });

  test("floating WhatsApp uses business short link and hides when cart opens", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const float = page.getByTestId("whatsapp-float");
    await expect(float).toBeVisible();
    await expect(float).toHaveAttribute("href", "https://api.whatsapp.com/message/NT5WBBX234POA1");
    await page.getByRole("button", { name: /Open cart/i }).click();
    await expect(float).toHaveCount(0);
  });

  test("PDP WhatsApp CTA is below primary and opens copy fallback without recipient", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/products/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage", { waitUntil: "domcontentloaded" });
    const primary = page.getByTestId("pdp-primary-cta");
    const wa = page.getByTestId("pdp-whatsapp-cta");
    await expect(primary).toBeVisible();
    await expect(wa).toBeVisible();
    const primaryBox = await primary.boundingBox();
    const waBox = await wa.boundingBox();
    expect(primaryBox && waBox && waBox.y > primaryBox.y).toBeTruthy();
    await expect(wa).toHaveAttribute("data-wa-prefilled", "0");
    await wa.click();
    await expect(page.getByTestId("whatsapp-message-fallback")).toBeVisible();
    const text = await page.getByTestId("whatsapp-message-text").inputValue();
    expect(text).toMatch(/Dell/i);
    expect(text).toMatch(/Quantity:/i);
    expect(text).toMatch(/\/products\/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage/i);
    expect(text).toMatch(/Rs 49,000/);
    await expect(page.getByTestId("whatsapp-open-general")).toHaveAttribute("href", "https://api.whatsapp.com/message/NT5WBBX234POA1");
  });

  test("no horizontal overflow on mobile home", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBe(false);
  });
});
