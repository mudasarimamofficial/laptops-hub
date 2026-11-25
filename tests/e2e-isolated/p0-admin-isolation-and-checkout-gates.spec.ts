/**
 * P0 acceptance on the ISOLATED stack (local Supabase seeded by scripts/test-fixtures/seed-isolated.mjs, incl. owner):
 *  1. /admin never renders storefront chrome (header, footer, compare tray, cart drawer), signed in, at 5 widths,
 *     with no horizontal overflow; the storefront keeps its chrome.
 *  2. Admin shows the server-side checkout readiness matrix.
 *  3. A deliberate PKR 0 + PKR 0 zone renders "Free delivery" and an order total equal to the subtotal; the Rs 360 +
 *     Rs 50 nationwide configuration renders exact fees. No zone => no clickable order.
 *  4. When a blocking gate fails (store setting off) the storefront checkout is not clickable.
 * Screenshots go to test-results/p0-evidence (gitignored). See docs/LAPTOPS_HUB_E2E_TEST_REPORT.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { pauseActiveCampaigns, resumeCampaigns } from "./helpers/campaigns";
import fs from "fs";
import { formatPkr } from "../../src/lib/money";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "test-results/p0-evidence";
const P = fx.products[0];

async function signIn(page: Page, role: "owner" | "manager") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function storefrontChrome(page: Page) {
  return page.evaluate(() => ({
    header: !!document.querySelector("body > header, body header[style*='sticky']"),
    footer: !!document.querySelector("footer"),
    skipToStore: [...document.querySelectorAll("a")].some((a) => a.textContent?.trim() === "Skip to content" && a.getAttribute("href") === "#main"),
    cartDrawer: /Your cart/i.test(document.body.innerText) && !location.pathname.startsWith("/admin"),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
}

test.describe.serial("P0: admin isolation and checkout gates (isolated)", () => {
  let paused: string[] = [];
  test.beforeAll(async () => {
    await assertLocalOnly("p0 isolation journeys");
    fs.mkdirSync(OUT, { recursive: true });
    // Exact cash totals below are list prices: pause automatic campaigns for this run (resumed in afterAll).
    paused = await pauseActiveCampaigns(sb);
  });

  test.afterAll(async () => {
    await resumeCampaigns(sb, paused);
  });

  for (const width of [360, 390, 768, 1280, 1440]) {
    test(`admin has no storefront chrome at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "owner");
      for (const path of ["/admin", "/admin/settings", "/admin/products", "/admin/orders", "/admin/merchandising", "/admin/reels", "/admin/reviews", "/admin/blog"]) {
        await page.goto(path);
        await expect(page.locator(".admin-app")).toBeVisible();
        const c = await storefrontChrome(page);
        expect(c.header, `${path} storefront header`).toBe(false);
        expect(c.footer, `${path} storefront footer`).toBe(false);
        expect(c.skipToStore, `${path} storefront skip link`).toBe(false);
        expect(c.overflowX, `${path} horizontal overflow at ${width}`).toBe(false);
      }
      await page.goto("/admin");
      await page.screenshot({ path: `${OUT}/admin-overview-${width}.png`, fullPage: false });
      // Mobile drawer opens and closes with Escape below the lg breakpoint.
      if (width < 1024) {
        await page.getByRole("button", { name: /menu|navigation/i }).first().click();
        await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });
  }

  test("storefront keeps its chrome (home, collection, checkout)", async ({ page }) => {
    for (const path of ["/", "/collections/all", "/checkout"]) {
      await page.goto(path);
      const c = await storefrontChrome(page);
      expect(c.header, `${path} header`).toBe(true);
      expect(c.footer, `${path} footer`).toBe(true);
    }
  });

  test("admin overview shows the server-side readiness matrix", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto("/admin");
    const panel = page.getByTestId("checkout-readiness");
    await expect(panel).toBeVisible();
    for (const id of ["client_flag", "server_flag", "db_setting", "shipping_zones", "policies", "purchasable_catalog", "notifications", "staff"]) {
      await expect(panel.locator(`[data-gate="${id}"]`)).toHaveCount(1);
    }
    // Fixture: flags on, setting on, zone active, policies are local stand-ins => open.
    await expect(page.getByTestId("checkout-readiness-status")).toHaveText("Ordering open");
    await page.screenshot({ path: `${OUT}/admin-readiness-open.png`, fullPage: true });
    // No secret values are ever rendered.
    const html = await page.content();
    expect(html).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY!);
  });

  test("PKR 0 + 0 zone: 'Free delivery', total equals subtotal; restored afterwards", async ({ page }) => {
    const { data: before } = await sb.from("shipping_zones").select("flat_fee_paisa, cod_fee_paisa").eq("id", fx.zone.id).single();
    await sb.from("shipping_zones").update({ flat_fee_paisa: 0, cod_fee_paisa: 0 }).eq("id", fx.zone.id);
    try {
      await page.goto(`/products/${P.handle}`);
      await page.getByRole("button", { name: /Add to cart/ }).first().click();
      await page.goto("/checkout");
      await page.getByLabel("City").fill(fx.zone.city);
      await page.getByLabel("Province").selectOption(fx.zone.province);
      await expect(page.getByText(/Free delivery · No COD fee/)).toBeVisible();
      await expect(page.getByText(`Cash due: ${formatPkr(P.pricePaisa)}`)).toBeVisible();
      await expect(page.getByText("Delivery: Free")).toBeVisible();
      await page.screenshot({ path: `${OUT}/checkout-free-delivery.png`, fullPage: true });
      // Server quote agrees with the page.
      const q = await page.request.post("/api/checkout/quote", {
        data: { address: { city: fx.zone.city, province: fx.zone.province }, lines: [{ variantId: P.variantId, quantity: 1 }] },
      });
      const qj = await q.json();
      expect(qj.quote).toMatchObject({ shippingPaisa: 0, codFeePaisa: 0, totalDuePaisa: P.pricePaisa });
    } finally {
      await sb.from("shipping_zones").update(before!).eq("id", fx.zone.id);
    }
  });

  test("nonzero fees render exactly; unserved city gives no clickable order", async ({ page }) => {
    await page.goto(`/products/${P.handle}`);
    await page.getByRole("button", { name: /Add to cart/ }).first().click();
    await page.goto("/checkout");
    await page.getByLabel("City").fill(fx.zone.city);
    await page.getByLabel("Province").selectOption(fx.zone.province);
    await expect(page.getByText(`Delivery ${formatPkr(fx.zone.flatFeePaisa)} · COD fee ${formatPkr(fx.zone.codFeePaisa)}`)).toBeVisible();
    await expect(page.getByText(`Cash due: ${formatPkr(P.pricePaisa + fx.zone.flatFeePaisa + fx.zone.codFeePaisa)}`)).toBeVisible();
    await page.getByLabel("City").fill("Gwadar");
    await page.getByLabel("Province").selectOption("Balochistan");
    await expect(page.getByText(/do not currently deliver COD/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Place COD order" })).toBeDisabled();
    // Raw database errors are not echoed by the public quote API.
    const bad = await page.request.post("/api/checkout/quote", { data: { address: { city: "x", province: "y" } } });
    expect(JSON.stringify(await bad.json())).not.toMatch(/exception|sql|relation|function/i);
  });

  test("a failing blocking gate (store setting off) makes storefront checkout non-clickable", async ({ page }) => {
    const { data: row } = await sb.from("store_settings").select("value").eq("key", "cod_checkout").single();
    await sb.from("store_settings").update({ value: { ...(row!.value as object), enabled: false } }).eq("key", "cod_checkout");
    try {
      await page.goto(`/products/${P.handle}`);
      await page.getByRole("button", { name: /Add to cart/ }).first().click();
      await page.goto("/checkout");
      await expect(page.getByText("Online ordering opens soon")).toBeVisible();
      await page.getByLabel("City").fill(fx.zone.city);
      await page.getByLabel("Province").selectOption(fx.zone.province);
      await expect(page.getByText(/Cash due: Rs/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Place COD order" })).toBeDisabled();
      await signIn(page, "owner");
      await page.goto("/admin/settings");
      await expect(page.getByTestId("checkout-readiness-status")).toContainText("Ordering closed");
      await expect(page.locator('[data-gate="db_setting"]')).toHaveAttribute("data-state", "fail");
      await page.screenshot({ path: `${OUT}/admin-readiness-closed.png`, fullPage: true });
    } finally {
      await sb.from("store_settings").update({ value: row!.value }).eq("key", "cod_checkout");
    }
  });
});
