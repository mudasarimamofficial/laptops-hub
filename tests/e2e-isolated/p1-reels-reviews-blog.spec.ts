/**
 * P1 on the ISOLATED stack: rights-gated reels, moderated reviews, blog posts. Everything created here is removed in
 * afterAll. Nothing fabricated is shown by default: no reels row without a published, rights-cleared reel; no rating
 * without an approved review; no guide without a published post.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { assertIsolatedAppAligned } from "../../scripts/test-fixtures/check-isolated-app.mjs";
import { DEFAULT_SOCIAL_PROOF } from "../../src/lib/content/social-proof";
import { productJsonLd } from "./helpers/json-ld";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const P = fx.products[0];
const P2 = fx.products[1];
const OUT = "test-results/p1-evidence";
const RUN = Date.now().toString(36);
const REEL_TITLE = `QA reel ${RUN}`;
const REEL_MULTI = `QA reel multi ${RUN}`;
const POST_SLUG = `qa-post-${RUN}`;
const REVIEWER = `QA Reviewer ${RUN}`;
const VIDEO = `${SB_URL.replace(/\/+$/, "")}/storage/v1/object/public/reels/qa-${RUN}.mp4`;

function fmtPkr(paisa: number) {
  return "Rs " + Number(paisa / 100).toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function cleanup() {
  const { data: rows } = await sb
    .from("reels")
    .select("id")
    .or("title.like.QA reel %,title.like.QA reel multi %,title.like.QA premium reel %,title.like.QA social reel %");
  for (const r of rows || []) await sb.from("reel_products").delete().eq("reel_id", r.id);
  await sb
    .from("reels")
    .delete()
    .or("title.like.QA reel %,title.like.QA reel multi %,title.like.QA premium reel %,title.like.QA social reel %");
  await sb.from("product_reviews").delete().like("author_name", "QA Reviewer %");
  await sb.from("articles").delete().like("slug", "qa-post-%");
}

async function stubReelVideo(page: Page) {
  await page.route(/\/reels\/qa-[^/]*\.mp4/, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync("tests/fixtures/reel-synthetic.webm") }),
  );
}

test.describe.serial("P1: reels, reviews, blog (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("reels/reviews/blog journeys");
    await assertIsolatedAppAligned("reels/reviews/blog journeys");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
    await sb.from("rate_limit_buckets").delete().like("bucket_key", "review:%");
  });
  test.afterAll(cleanup);

  test("reels: no row by default; reference and unlicensed videos refused; published owned reel shows", async ({ page }) => {
    // The local stack has no storage service: serve the original synthetic clip for the test URL.
    await stubReelVideo(page);
    await signIn(page);
    await cleanup();
    // Revalidate homepage reel cache after wiping sibling-suite QA rows.
    await page.request.put("/api/admin/social-proof", { data: DEFAULT_SOCIAL_PROOF });
    await page.goto("/");
    await expect(page.getByTestId("reels-section")).toHaveCount(0);
    await expect(page.getByTestId("reels-placeholder")).toBeVisible();

    await page.goto("/admin/reels");
    const form = page.getByTestId("reel-new-form");
    await form.getByLabel("Title").fill(REEL_TITLE);
    // External host with a non-media path is refused on extension — not hostname.
    await form.getByLabel(/Video URL/).fill("https://www.ronin.pk/reels/clip");
    await form.getByLabel("Video rights").selectOption("owned");
    await form.getByLabel("Status").selectOption("published");
    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText(/direct media file URL|\.mp4/i)).toBeVisible();

    await form.getByLabel(/Video URL/).fill(VIDEO);
    await form.getByLabel("Video rights").selectOption("pending");
    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText(/Confirm the video is owned or licensed before publishing/)).toBeVisible();
    // The database refuses it too, whatever the client sends.
    const direct = await sb.from("reels").insert({ title: REEL_TITLE, video_url: VIDEO, status: "published" });
    expect(direct.error?.message).toMatch(/reels_publish_requires_rights/);

    await form.getByLabel("Video rights").selectOption("owned");
    const picker = form.getByTestId("reel-product-picker");
    await picker.getByLabel("Search products to feature").fill(P.handle.slice(0, 16));
    await expect(picker.getByRole("button", { name: new RegExp(P.handle) })).toBeVisible({ timeout: 10_000 });
    await picker.getByRole("button", { name: new RegExp(P.handle) }).click();
    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText("Reel saved.")).toBeVisible();
    await expect(page.getByTestId("reel-row").filter({ hasText: REEL_TITLE })).toBeVisible();

    const { data: audit } = await sb.from("audit_logs").select("id").eq("action", "reel.create").order("created_at", { ascending: false }).limit(1);
    expect(audit?.length).toBe(1);

    await page.goto("/");
    const section = page.getByTestId("reels-section");
    await expect(section).toBeVisible();
    const reel = section.getByTestId("reel").filter({ hasText: REEL_TITLE });
    await expect(reel).toBeVisible();
    await expect(reel.locator("video")).toHaveAttribute("preload", "none");
    await expect(reel.getByTestId("reel-open")).toHaveAttribute("aria-label", new RegExp(REEL_TITLE));
    await reel.getByTestId("reel-open").click();
    const modal = page.getByTestId("reel-shoppable-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId("reel-shop-product")).toContainText(P.title);
    await modal.getByTestId("reel-modal-close").click();
    // Local fixture VIDEO is used; homepage must not show this test reel as a blocked-host error.
    await section.screenshot({ path: `${OUT}/home-reels.png` });

    // Unpublishing through the admin API removes the row again.
    const { data: row } = await sb.from("reels").select("id, title, caption, video_url, rights_status, rights_note, sort_order").like("title", "QA reel %").single();
    const res = await page.request.put(`/api/admin/reels/${row!.id}`, {
      data: {
        title: row!.title,
        caption: row!.caption,
        videoUrl: row!.video_url,
        rightsStatus: row!.rights_status,
        rightsNote: row!.rights_note,
        status: "draft",
        sortOrder: row!.sort_order,
        productHandles: [],
      },
    });
    expect(res.status()).toBe(200);
    await page.goto("/");
    await expect(page.getByTestId("reels-section")).toHaveCount(0);
  });

  test("reels: multi-product link, reorder, reload, modal prices, add to cart, mobile", async ({ page }) => {
    test.setTimeout(120_000);
    await stubReelVideo(page);
    await signIn(page);
    await page.goto("/admin/reels");

    const form = page.getByTestId("reel-new-form");
    await form.getByLabel("Title").fill(REEL_MULTI);
    await form.getByLabel(/Video URL/).fill(VIDEO.replace(`qa-${RUN}`, `qa-multi-${RUN}`));
    await form.getByLabel("Video rights").selectOption("owned");
    await form.getByLabel("Status").selectOption("published");

    const picker = form.getByTestId("reel-product-picker");
    // Link product 1, then product 2 (order = picker order).
    await picker.getByLabel("Search products to feature").fill(P.handle.slice(0, 16));
    await expect(picker.getByRole("button", { name: new RegExp(P.handle) })).toBeVisible({ timeout: 10_000 });
    await picker.getByRole("button", { name: new RegExp(P.handle) }).click();
    await picker.getByLabel("Search products to feature").fill(P2.handle.slice(0, 16));
    await expect(picker.getByRole("button", { name: new RegExp(P2.handle) })).toBeVisible({ timeout: 10_000 });
    await picker.getByRole("button", { name: new RegExp(P2.handle) }).click();
    await expect(picker.locator("ol li")).toHaveCount(2);

    // Reorder: move second product Up so P2 is first.
    await picker.locator("ol li").filter({ hasText: P2.handle }).getByRole("button", { name: "Up" }).click();
    await expect(picker.locator("ol li").first()).toContainText(P2.handle);
    await expect(picker.locator("ol li").nth(1)).toContainText(P.handle);

    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText("Reel saved.")).toBeVisible();
    const row = page.getByTestId("reel-row").filter({ hasText: REEL_MULTI });
    await expect(row).toBeVisible();

    // Persist after reload — open the row details and confirm picker order.
    await page.reload({ waitUntil: "domcontentloaded" });
    const edit = page.getByTestId("reel-row").filter({ hasText: REEL_MULTI });
    await expect(edit).toBeVisible();
    await edit.locator("summary").click();
    const editPicker = edit.getByTestId("reel-product-picker");
    await expect(editPicker.locator("ol li").first()).toContainText(P2.handle);
    await expect(editPicker.locator("ol li").nth(1)).toContainText(P.handle);

    const reelId = (await sb.from("reels").select("id").eq("title", REEL_MULTI).single()).data!.id;
    const { data: dbLinks } = await sb
      .from("reel_products")
      .select("sort_order, products!reel_products_product_id_fkey(handle)")
      .eq("reel_id", reelId)
      .order("sort_order", { ascending: true });
    expect((dbLinks || []).map((l) => (l.products as { handle?: string } | null)?.handle)).toEqual([P2.handle, P.handle]);

    // Public modal: order, prices, availability, add to cart.
    await page.goto("/");
    const section = page.getByTestId("reels-section");
    await expect(section).toBeVisible();
    const reel = section.getByTestId("reel").filter({ hasText: REEL_MULTI });
    await expect(reel).toBeVisible();
    await reel.getByTestId("reel-open").click();
    const modal = page.getByTestId("reel-shoppable-modal");
    await expect(modal).toBeVisible();
    const cards = modal.getByTestId("reel-shop-product");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator(`a[href="/products/${P2.handle}"]`).first()).toBeVisible();
    await expect(cards.nth(0)).toContainText(fmtPkr(P2.pricePaisa));
    await expect(cards.nth(0)).toContainText(/In stock|Unavailable/);
    await expect(cards.nth(1).locator(`a[href="/products/${P.handle}"]`).first()).toBeVisible();
    await expect(cards.nth(1)).toContainText(fmtPkr(P.pricePaisa));

    await cards.nth(0).getByTestId("reel-modal-add-to-cart").click();
    const cart = page.getByRole("dialog", { name: /cart/i });
    await expect(cart).toBeVisible();
    await expect(cart.locator(`a[href="/products/${P2.handle}"], a[href*="${P2.handle}"]`).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/reel-shoppable-desktop.png` });

    // Mobile layout of the same modal surface.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const mobileReel = page.getByTestId("reels-section").getByTestId("reel").filter({ hasText: REEL_MULTI });
    await mobileReel.getByTestId("reel-open").click();
    const mobileModal = page.getByTestId("reel-shoppable-modal");
    await expect(mobileModal).toBeVisible();
    await expect(mobileModal.getByTestId("reel-shop-product")).toHaveCount(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `${OUT}/reel-shoppable-mobile.png` });

    // Cleanup this reel so subsequent tests start clean.
    const { data: multi } = await sb.from("reels").select("id").eq("title", REEL_MULTI).single();
    if (multi?.id) {
      await sb.from("reel_products").delete().eq("reel_id", multi.id);
      await sb.from("reels").delete().eq("id", multi.id);
    }
  });

  test("reviews: honest empty state; submission is pending until approved; then rating + JSON-LD", async ({ page }) => {
    await page.goto(`/products/${P.handle}`);
    const box = page.getByTestId("pdp-reviews");
    await expect(box.getByText(/No reviews yet/)).toBeVisible();
    await expect(box.getByTestId("review-summary")).toHaveCount(0);
    const ldBefore = await productJsonLd(page);
    expect(ldBefore, "product JSON-LD present").not.toBeNull();
    expect(ldBefore).not.toHaveProperty("aggregateRating");

    // Cross-site posts are refused; validation errors never echo DB text.
    const cross = await page.request.post("/api/reviews", { headers: { Origin: "https://evil.example" }, data: { handle: P.handle } });
    expect(cross.status()).toBe(403);

    await box.getByRole("button", { name: "Write a review" }).click();
    await box.getByRole("button", { name: "Submit review" }).click();
    await expect(box.getByText("Choose a rating from 1 to 5.")).toBeVisible();
    await box.getByLabel("4 out of 5").check({ force: true });
    await box.getByLabel("Your name").fill(REVIEWER);
    await box.getByLabel("Your review", { exact: true }).fill("Battery holds about four hours, keyboard is clean and the screen has no marks.");
    await box.getByLabel(/^Email/).fill("qa-reviewer@example.test");
    await box.getByRole("button", { name: "Submit review" }).click();
    await expect(box.getByTestId("review-sent")).toBeVisible();

    const { data: stored } = await sb.from("product_reviews").select("id, status, ip_hash, reviewer_email, rating").eq("author_name", REVIEWER).single();
    expect(stored!.status).toBe("pending");
    expect(stored!.rating).toBe(4);
    expect(stored!.ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(stored!.ip_hash).not.toContain("127.0.0.1");

    await page.reload();
    await expect(page.getByTestId("pdp-reviews").getByText(REVIEWER)).toHaveCount(0);

    await signIn(page);
    await page.goto("/admin/reviews");
    const item = page.getByTestId("review-row").filter({ hasText: REVIEWER });
    await expect(item).toBeVisible();
    await expect(item.getByText("Email (private): qa-reviewer@example.test")).toBeVisible();
    await item.getByRole("button", { name: "Approve" }).click();
    // Approved reviews leave the pending queue (the list refreshes) and are listed under "Approved".
    await expect(item).toHaveCount(0);
    await expect.poll(async () => (await sb.from("product_reviews").select("status").eq("author_name", REVIEWER).single()).data?.status).toBe("approved");
    await page.goto("/admin/reviews?status=approved");
    await expect(page.getByTestId("review-row").filter({ hasText: REVIEWER }).getByRole("button", { name: "Approve" })).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/products/${P.handle}`);
    const after = page.getByTestId("pdp-reviews");
    await expect(after.getByTestId("review").filter({ hasText: REVIEWER })).toBeVisible();
    await expect(after.getByTestId("review-summary")).toContainText("4.0 out of 5 · 1 review");
    await expect(after).not.toContainText("qa-reviewer@example.test");
    const ld = await productJsonLd(page);
    expect(ld?.aggregateRating).toMatchObject({ ratingValue: 4, reviewCount: 1 });
    await after.screenshot({ path: `${OUT}/pdp-reviews.png` });

    // Rejecting hides it again.
    await page.goto("/admin/reviews?status=approved");
    await page.getByTestId("review-row").filter({ hasText: REVIEWER }).getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("review-row").filter({ hasText: REVIEWER })).toHaveCount(0);
    await expect.poll(async () => (await sb.from("product_reviews").select("status").eq("author_name", REVIEWER).single()).data?.status).toBe("rejected");
    await page.goto(`/products/${P.handle}`);
    await expect(page.getByTestId("pdp-reviews").getByText(REVIEWER)).toHaveCount(0);
  });

  test("blog: empty publish refused; published post is public and sanitised; draft is 404", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/blog/new");
    await page.getByLabel("Title", { exact: true }).fill("QA guide: choosing RAM");
    await page.getByLabel("Web address").fill(POST_SLUG);
    await page.getByLabel("Visible — published now").check();
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText("Write the post before publishing it.").first()).toBeVisible();

    await page.getByLabel("Summary").fill("How much memory a student laptop needs.");
    // Advanced HTML source bypasses the rich-text surface for deterministic sanitiser coverage.
    await page.getByText("Advanced: HTML source").click();
    await page.locator("details textarea").fill(
      '<h2>How much RAM?</h2><p>8GB is enough for study and office work.</p><script>window.__pwned=1</script><p><a href="javascript:alert(1)">x</a></p>',
    );
    await page.getByRole("button", { name: "Create post" }).click();
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?saved=1$/);
    await expect(page.getByText("Post saved.").first()).toBeVisible();

    const { data: row } = await sb.from("articles").select("body_html, status, published_at").eq("slug", POST_SLUG).single();
    expect(row!.status).toBe("published");
    expect(row!.published_at).toBeTruthy();
    expect(row!.body_html).not.toMatch(/<script|javascript:/i);

    await page.goto(`/guides/${POST_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: "QA guide: choosing RAM" })).toBeVisible();
    await expect(page.getByText("8GB is enough for study and office work.")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await page.screenshot({ path: `${OUT}/guide-post.png`, fullPage: false });

    await page.goto("/guides");
    // Listed as a guide card and in the side navigation (scope by slug — titles may collide with leftover fixtures).
    await expect(page.locator(`a.v5-hov-article[href="/guides/${POST_SLUG}"]`)).toContainText("How much memory a student laptop needs.");
    await expect(page.locator(`a[href="/guides/${POST_SLUG}"]`).filter({ hasText: "QA guide: choosing RAM" }).first()).toBeVisible();
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/guides/${POST_SLUG}`);

    // Back to draft ⇒ gone.
    const { data: idRow } = await sb.from("articles").select("id").eq("slug", POST_SLUG).single();
    await page.goto(`/admin/blog/${idRow!.id}`);
    await page.getByLabel("Hidden — draft, not on the site").check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Post saved.").first()).toBeVisible();
    const res = await page.request.get(`/guides/${POST_SLUG}`);
    expect(res.status()).toBe(404);
  });

  test("fulfillment staff cannot write posts or reels or moderate reviews", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.fulfillment.email);
    await page.getByLabel("Password").fill(fx.staff.fulfillment.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    for (const path of ["/api/admin/posts", "/api/admin/reels"]) {
      const r = await page.request.post(path, { data: {} });
      expect(r.status(), path).toBe(403);
    }
    const r = await page.request.patch("/api/admin/reviews/00000000-0000-4000-8000-000000000000", { data: { status: "approved" } });
    expect(r.status()).toBe(403);
  });
});
