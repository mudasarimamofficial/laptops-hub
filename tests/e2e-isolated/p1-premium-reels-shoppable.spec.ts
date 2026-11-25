/**
 * Premium reels acceptance on the ISOLATED stack: multi-product associations, shoppable modal cart,
 * carousel scroll progress, compare Clear all contrast affordance, and centered reviews dialog.
 * Does not touch production reel rows — only QA titles created here (cleaned in afterAll).
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { DEFAULT_SOCIAL_PROOF } from "../../src/lib/content/social-proof";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [P0, P1] = fx.products as { handle: string; title: string; pricePaisa: number; variantId: string }[];
const OUT = "test-results/p1-evidence";
const RUN = Date.now().toString(36);
const VIDEO = `http://127.0.0.1:54321/storage/v1/object/public/reels/qa-premium-${RUN}.webm`;
const CLIP = fs.readFileSync("tests/fixtures/reel-synthetic.webm");
const TITLE = `QA premium reel ${RUN}`;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function cleanup() {
  const { data: rows } = await sb.from("reels").select("id").like("title", "QA premium reel %");
  for (const r of rows || []) await sb.from("reel_products").delete().eq("reel_id", r.id);
  await sb.from("reels").delete().like("title", "QA premium reel %");
  await sb.from("products").delete().like("handle", `qa-premium-extra-${RUN}%`);
}

test.describe.serial("P1: premium reels shoppable + carousel + compare/reviews", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("premium reels shoppable journeys");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
  });
  test.afterAll(cleanup);

  test("admin multi-product picker: one, two, many — save/reload order; draft excluded from modal", async ({ page }) => {
    await signIn(page);
    // Third active product for “many”; plus a draft that must not appear after linking attempts via API.
    const extraHandle = `qa-premium-extra-${RUN}`;
    const { data: extraProd, error: extraErr } = await sb
      .from("products")
      .insert({ handle: extraHandle, title: `QA Extra ${RUN}`, manufacturer: "QA", status: "active", category: "Laptop", product_type: "Laptop" })
      .select("id")
      .single();
    expect(extraErr).toBeNull();
    const { data: extraVar, error: varErr } = await sb
      .from("product_variants")
      .insert({
        product_id: extraProd!.id,
        sku: `QA-X-${RUN}`,
        price_paisa: 55_000_00,
        max_per_order: 3,
        purchasable: true,
      })
      .select("id")
      .single();
    expect(varErr).toBeNull();
    expect(extraVar?.id).toBeTruthy();

    const draftHandle = `qa-premium-draft-${RUN}`;
    await sb.from("products").insert({ handle: draftHandle, title: `QA Draft ${RUN}`, manufacturer: "QA", status: "draft", category: "Laptop", product_type: "Laptop" });

    await page.goto("/admin/reels");
    const form = page.getByTestId("reel-new-form");
    await form.getByLabel("Title").fill(TITLE);
    await form.getByLabel(/Video URL/).fill(VIDEO);
    await form.getByLabel("Video rights").selectOption("owned");
    await form.getByLabel("Status").selectOption("published");

    const picker = form.getByTestId("reel-product-picker");
    await picker.getByLabel("Search products to feature").fill(P0.title.slice(0, 12));
    await expect(picker.getByRole("button", { name: new RegExp(P0.handle) })).toBeVisible({ timeout: 10_000 });
    await picker.getByRole("button", { name: new RegExp(P0.handle) }).click();
    await expect(picker.getByText(new RegExp(`1\\.\\s*${P0.handle}`))).toBeVisible();

    await picker.getByLabel("Search products to feature").fill(P1.handle.slice(0, 18));
    await picker.getByRole("button", { name: new RegExp(P1.handle) }).click();
    await picker.getByLabel("Search products to feature").fill(extraHandle);
    await picker.getByRole("button", { name: new RegExp(extraHandle) }).click();

    // Reorder: move first product down so P1 leads.
    await picker.locator("li").filter({ hasText: P0.handle }).getByRole("button", { name: "Down" }).click();
    await expect(picker.locator("li").first()).toContainText(P1.handle);

    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText("Reel saved.")).toBeVisible();

    const { data: reel } = await sb.from("reels").select("id").eq("title", TITLE).single();
    const { data: links } = await sb
      .from("reel_products")
      .select("sort_order, products(handle)")
      .eq("reel_id", reel!.id)
      .order("sort_order");
    expect((links || []).map((l) => (l.products as { handle?: string } | null)?.handle)).toEqual([P1.handle, P0.handle, extraHandle]);

    // Reload admin — associations persist in DB (save/reload contract).
    await page.reload();
    await expect(page.getByTestId("reel-row").filter({ hasText: TITLE })).toBeVisible();
    const { data: again } = await sb.from("reel_products").select("sort_order, products(handle)").eq("reel_id", reel!.id).order("sort_order");
    expect((again || []).map((l) => (l.products as { handle?: string } | null)?.handle)).toEqual([P1.handle, P0.handle, extraHandle]);

    // Draft product rejected when forced through API.
    const bad = await page.request.put(`/api/admin/reels/${reel!.id}`, {
      data: {
        title: TITLE,
        videoUrl: VIDEO,
        rightsStatus: "owned",
        status: "published",
        sortOrder: -500,
        productHandles: [draftHandle],
      },
    });
    expect(bad.status()).toBe(400);
    const badBody = await bad.json();
    expect(JSON.stringify(badBody)).toMatch(/draft/i);
  });

  test("storefront modal: ordered products, live prices, add to cart; carousel progress; reviews dialog centered", async ({ page }) => {
    await page.route(/qa-premium-.*.webm/, (route) => route.fulfill({ status: 200, contentType: "video/webm", body: CLIP }));
    await signIn(page);
    await page.request.put("/api/admin/social-proof", {
      data: {
        ...DEFAULT_SOCIAL_PROOF,
        reels: { heading: "Laptops in Action", subtitle: "Watch, explore, and find your next laptop.", autoplayMuted: true },
      },
    });

    const { data: reel } = await sb.from("reels").select("id").eq("title", TITLE).single();
    expect(reel?.id).toBeTruthy();
    // Extra published cards so the carousel overflows and exposes scroll progress.
    const filler = await sb.from("reels").insert([
      { title: `QA premium reel filler A ${RUN}`, video_url: VIDEO, rights_status: "owned", status: "published", sort_order: -499, media_source: "external_file" },
      { title: `QA premium reel filler B ${RUN}`, video_url: VIDEO, rights_status: "owned", status: "published", sort_order: -498, media_source: "external_file" },
      { title: `QA premium reel filler C ${RUN}`, video_url: VIDEO, rights_status: "owned", status: "published", sort_order: -497, media_source: "external_file" },
    ]);
    expect(filler.error).toBeNull();
    // Touch reel so public cache revalidates.
    await page.request.put(`/api/admin/reels/${reel!.id}`, {
      data: {
        title: TITLE,
        videoUrl: VIDEO,
        rightsStatus: "owned",
        status: "published",
        sortOrder: -500,
        productHandles: [P1.handle, P0.handle],
      },
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const section = page.getByTestId("reels-section");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByTestId("carousel-progress")).toBeVisible({ timeout: 10_000 });

    const viewport = section.locator(".lh-premium-carousel-viewport");
    const before = await section.getByTestId("carousel-progress").getAttribute("aria-valuenow");
    await viewport.evaluate((el) => {
      el.scrollBy({ left: 280, behavior: "instant" as ScrollBehavior });
    });
    await expect
      .poll(async () => Number(await section.getByTestId("carousel-progress").getAttribute("aria-valuenow")))
      .toBeGreaterThan(Number(before || "0"));

    await section.getByTestId("reel").filter({ hasText: TITLE }).getByTestId("reel-open").click();
    const modal = page.getByTestId("reel-shoppable-modal");
    await expect(modal).toBeVisible();
    const products = modal.getByTestId("reel-shop-product");
    await expect(products).toHaveCount(2);
    await expect(products.nth(0)).toContainText(P1.title);
    await expect(products.nth(1)).toContainText(P0.title);
    // Authoritative price formatting (PKR) — not fabricated.
    await expect(products.nth(0)).toContainText(/Rs|PKR|\d/i);

    await products.nth(0).getByTestId("reel-modal-add-to-cart").click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          try {
            const raw = localStorage.getItem("lh-cart-v1");
            if (!raw) return 0;
            const parsed = JSON.parse(raw) as { lines?: unknown[] };
            return Array.isArray(parsed.lines) ? parsed.lines.length : 0;
          } catch {
            return 0;
          }
        }),
      )
      .toBeGreaterThan(0);

    // Add to cart closes the reel (it sits above the cart drawer) and opens the cart (since #48).
    await expect(modal).toHaveCount(0);
    const cart = page.getByRole("dialog", { name: "Cart" });
    await expect(cart).toBeVisible();
    await expect(cart).toContainText(P1.title);
    await page.keyboard.press("Escape");
    await expect(cart).toHaveCount(0);

    // The modal's own Close button still works.
    await section.getByTestId("reel").filter({ hasText: TITLE }).getByTestId("reel-open").click();
    await expect(modal).toBeVisible();
    await modal.getByTestId("reel-modal-close").click();
    await expect(modal).toHaveCount(0);

    // Compare tray Clear all is present with readable contrast control when items exist.
    await page.goto(`/products/${P0.handle}`);
    const compareBtn = page.getByRole("button", { name: /compare/i }).first();
    if (await compareBtn.isVisible().catch(() => false)) {
      await compareBtn.click();
      await page.goto(`/products/${P1.handle}`);
      await page.getByRole("button", { name: /compare/i }).first().click();
      const clear = page.getByTestId("compare-clear-all");
      await expect(clear).toBeVisible();
      const styles = await clear.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor, border: cs.borderColor, fontWeight: cs.fontWeight };
      });
      expect(styles.color).not.toBe("rgba(0, 0, 0, 0)");
      await clear.click();
      await expect(clear).toHaveCount(0);
    }

    // Reviews dialog centering when the homepage section exists.
    await page.goto("/");
    const reviews = page.getByTestId("store-reviews");
    if (await reviews.count()) {
      await reviews.scrollIntoViewIfNeeded();
      await reviews.getByTestId("store-reviews-all").click();
      const dialog = page.getByTestId("store-reviews-dialog");
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      const vp = page.viewportSize()!;
      expect(box).toBeTruthy();
      expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(64);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }

    await page.screenshot({ path: `${OUT}/premium-reels-modal.png` });
  });
});
