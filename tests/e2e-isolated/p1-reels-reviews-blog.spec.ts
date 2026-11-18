/**
 * P1 on the ISOLATED stack: rights-gated reels, moderated reviews, blog posts. Everything created here is removed in
 * afterAll. Nothing fabricated is shown by default: no reels row without a published, rights-cleared reel; no rating
 * without an approved review; no guide without a published post.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const P = fx.products[0];
const OUT = "test-results/p1-evidence";
const RUN = Date.now().toString(36);
const REEL_TITLE = `QA reel ${RUN}`;
const POST_SLUG = `qa-post-${RUN}`;
const REVIEWER = `QA Reviewer ${RUN}`;
const VIDEO = `${SB_URL.replace(/\/+$/, "")}/storage/v1/object/public/reels/qa-${RUN}.mp4`;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function cleanup() {
  await sb.from("reels").delete().like("title", "QA reel %");
  await sb.from("product_reviews").delete().like("author_name", "QA Reviewer %");
  await sb.from("articles").delete().like("slug", "qa-post-%");
}

test.describe.serial("P1: reels, reviews, blog (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("reels/reviews/blog journeys");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
    await sb.from("rate_limit_buckets").delete().like("bucket_key", "review:%");
  });
  test.afterAll(cleanup);

  test("reels: no row by default; reference and unlicensed videos refused; published owned reel shows", async ({ page }) => {
    // The local stack has no storage service: serve the original synthetic clip for the test URL.
    await page.route(/\/reels\/qa-[^/]*\.mp4/, (route) =>
      route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync("tests/fixtures/reel-synthetic.webm") }),
    );
    await page.goto("/");
    await expect(page.getByTestId("reels-section")).toHaveCount(0);

    await signIn(page);
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
    await form.getByLabel("Linked product handle (optional)").fill(P.handle);
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
    await expect(reel.locator("video source")).toHaveAttribute("src", VIDEO);
    await expect(reel.locator("video")).toHaveAttribute("preload", "none");
    await expect(reel.getByRole("link", { name: "View this laptop →" })).toHaveAttribute("href", `/products/${P.handle}`);
    // Local fixture VIDEO is used; homepage must not show this test reel as a blocked-host error.
    await section.screenshot({ path: `${OUT}/home-reels.png` });

    // Unpublishing through the admin API removes the row again.
    const { data: row } = await sb.from("reels").select("id, title, caption, video_url, rights_status, rights_note, sort_order").like("title", "QA reel %").single();
    const res = await page.request.put(`/api/admin/reels/${row!.id}`, {
      data: { title: row!.title, caption: row!.caption, videoUrl: row!.video_url, rightsStatus: row!.rights_status, rightsNote: row!.rights_note, status: "draft", sortOrder: row!.sort_order },
    });
    expect(res.status()).toBe(200);
    await page.goto("/");
    await expect(page.getByTestId("reels-section")).toHaveCount(0);
  });

  test("reviews: honest empty state; submission is pending until approved; then rating + JSON-LD", async ({ page }) => {
    await page.goto(`/products/${P.handle}`);
    const box = page.getByTestId("pdp-reviews");
    await expect(box.getByText(/No reviews yet/)).toBeVisible();
    await expect(box.getByTestId("review-summary")).toHaveCount(0);
    expect(await page.locator('script[type="application/ld+json"]').first().textContent()).not.toContain("aggregateRating");

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
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) || "{}");
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4, reviewCount: 1 });
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
    await page.getByLabel("Title").fill("QA guide: choosing RAM");
    await page.getByLabel("Address").fill(POST_SLUG);
    await page.getByLabel("Status").selectOption("published");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Write the post before publishing it.").first()).toBeVisible();

    await page.getByLabel("Summary (shown on the guides list)").fill("How much memory a student laptop needs.");
    await page
      .getByLabel(/^Body/)
      .fill('<h2>How much RAM?</h2><p>8GB is enough for study and office work.</p><script>window.__pwned=1</script><p><a href="javascript:alert(1)">x</a></p>');
    await page.getByRole("button", { name: "Save post" }).click();
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?saved=1$/);
    await expect(page.getByText("Post saved.")).toBeVisible();

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
    // Listed as a guide card and in the side navigation.
    await expect(page.locator(`a.v5-hov-article[href="/guides/${POST_SLUG}"]`)).toContainText("How much memory a student laptop needs.");
    await expect(page.getByRole("link", { name: "QA guide: choosing RAM", exact: true })).toBeVisible();
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/guides/${POST_SLUG}`);

    // Back to draft ⇒ gone.
    const { data: idRow } = await sb.from("articles").select("id").eq("slug", POST_SLUG).single();
    await page.goto(`/admin/blog/${idRow!.id}`);
    await page.getByLabel("Status").selectOption("draft");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Post saved.")).toBeVisible();
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
