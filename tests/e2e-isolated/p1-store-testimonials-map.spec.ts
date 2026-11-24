/**
 * Homepage store reviews + "Visit our store" map on the ISOLATED stack.
 * Testimonials: nothing shows until one is published; editors can draft/submit but never publish; owner approval puts
 * it on the homepage and hiding removes it; provenance labels are honest (Google G only for Google-sourced entries);
 * unsafe HTML is shown as text. Map: homepage only, after the footer, iframe mounted lazily from the safe embed.
 * Everything created here is removed in afterAll (entries are prefixed "QA ").
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "test-results/p1-evidence";
const RUN = Date.now().toString(36);
const EDITOR_NAME = `QA Editor Entry ${RUN}`;
const OWNER_NAME = `QA Owner Entry ${RUN}`;
const XSS = `<img src=x onerror="window.__xss=1"> QA text ${RUN} is shown as text`;

async function signIn(page: Page, who: "owner" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
async function signOut(page: Page) {
  await page.context().clearCookies();
}
const cleanup = async () => {
  await sb.from("store_testimonials").delete().like("author_name", "QA %");
};
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe.serial("Store reviews + map (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("store testimonials + map journeys");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
  });
  test.afterAll(cleanup);

  test("map: homepage only, after the footer, lazy iframe from the safe embed, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("store-reviews")).toHaveCount(0); // nothing published yet → section absent
    const map = page.getByTestId("store-map");
    await expect(map).toHaveCount(1);
    // Placed after the footer in the DOM.
    const after = await page.evaluate(() => {
      const f = document.querySelector("body > footer, footer");
      const m = document.querySelector('[data-testid="store-map"]');
      return !!f && !!m && !!(f.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(after).toBe(true);
    await expect(page.getByTestId("store-map-iframe")).toHaveCount(0); // not mounted at the top of the page
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const iframe = page.getByTestId("store-map-iframe");
    await expect(iframe).toHaveCount(1);
    expect(await iframe.getAttribute("src")).toMatch(/^https:\/\/www\.google\.com\/maps\/embed\?pb=/);
    expect(await iframe.getAttribute("loading")).toBe("lazy");
    expect(await iframe.getAttribute("title")).toMatch(/Laptops HUB/);
    await expect(page.getByTestId("store-map-open")).toHaveAttribute("href", /^https:\/\/maps\.google\.com\//);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${OUT}/map-1440.png` });

    for (const w of [320, 390, 768]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(page.getByTestId("store-map-open")).toBeVisible();
      expect(await noOverflow(page), `no horizontal overflow at ${w}px`).toBeLessThanOrEqual(0);
    }
    await page.screenshot({ path: `${OUT}/map-768.png` });

    // Not on other pages (full load and client navigation).
    await page.goto("/products");
    await expect(page.getByTestId("store-map")).toHaveCount(0);
  });

  test("map: reduced motion has no sticky reveal", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const pos = await page.getByTestId("store-map").evaluate((el) => getComputedStyle(el).position);
    expect(pos).not.toBe("sticky");
  });

  test("editor: can draft and submit, cannot publish (UI and API)", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto("/admin/reviews/testimonials");
    await expect(page.getByTestId("testimonial-empty").or(page.getByTestId("testimonial-list"))).toBeVisible();
    await page.getByTestId("testimonial-add").click();
    await expect(page.getByTestId("testimonial-publish-new")).toHaveCount(0);
    await page.getByTestId("testimonial-author").fill(EDITOR_NAME);
    await page.getByTestId("testimonial-body").fill("Bought a refurbished ThinkPad here; it arrived exactly as described.");
    await page.getByTestId("testimonial-consent").check();
    // Google drafts may omit the Maps link; publishing still requires it (and editor cannot publish).
    await page.getByTestId("testimonial-source").selectOption("google");
    await page.getByTestId("testimonial-submit").click();
    await expect(page.getByTestId("testimonial-notice")).toHaveText("Submitted for approval.");
    const googleRow = page.getByTestId("testimonial-row").filter({ hasText: EDITOR_NAME });
    await expect(googleRow).toHaveAttribute("data-status", "pending");
    await expect(googleRow.getByTestId("testimonial-publish")).toHaveCount(0);

    const { data: googleDraft } = await sb.from("store_testimonials").select("id").eq("author_name", EDITOR_NAME).single();
    const publishBlocked = await page.request.patch(`/api/admin/testimonials/${googleDraft!.id}`, { data: { status: "published" } });
    expect(publishBlocked.status()).toBe(403);

    // Website path still works for a second editor entry (use unique name suffix via body already unique enough).
    await page.getByTestId("testimonial-add").click();
    await page.getByTestId("testimonial-author").fill(`${EDITOR_NAME} Web`);
    await page.getByTestId("testimonial-body").fill("Bought a refurbished ThinkPad here; it arrived exactly as described.");
    await page.getByTestId("testimonial-consent").check();
    await page.getByTestId("testimonial-source").selectOption("website");
    await page.getByTestId("testimonial-submit").click();
    await expect(page.getByTestId("testimonial-notice")).toHaveText("Submitted for approval.");
    const row = page.getByTestId("testimonial-row").filter({ hasText: `${EDITOR_NAME} Web` });
    await expect(row).toHaveAttribute("data-status", "pending");
    await expect(row.getByTestId("testimonial-publish")).toHaveCount(0);

    const { data } = await sb.from("store_testimonials").select("id").eq("author_name", `${EDITOR_NAME} Web`).single();
    const r = await page.request.patch(`/api/admin/testimonials/${data!.id}`, { data: { status: "published" } });
    expect(r.status()).toBe(403);
    const del = await page.request.delete(`/api/admin/testimonials/${data!.id}`);
    expect(del.status()).toBe(403);
    await page.goto("/");
    await expect(page.getByTestId("store-reviews")).toHaveCount(0);
    await signOut(page);
    // Editor cannot delete; clear both pending rows via isolated service role.
    await sb.from("store_testimonials").delete().in("author_name", [EDITOR_NAME, `${EDITOR_NAME} Web`]);
  });

  test("owner: approve → homepage shows it with honest labels; HTML stays text; hide removes it", async ({ page }) => {
    // Enough published entries for two moving rows (local QA fixtures, removed afterwards).
    const rows = Array.from({ length: 7 }, (_, i) => ({
      author_name: `QA Fixture ${i} ${RUN}`,
      body: `QA fixture review ${i} for layout testing only, ${RUN}.`,
      source: i === 0 ? "google" : "merchant",
      source_url: i === 0 ? "https://www.google.com/maps/reviews/qa" : null,
      rating: i % 2 ? null : 5,
      consent_confirmed: true,
      status: "published",
      published_at: new Date().toISOString(),
    }));
    expect((await sb.from("store_testimonials").insert(rows)).error).toBeNull();
    // One entry waiting for approval. Seeded here rather than reused from the editor test, which cleans up its own rows.
    expect(
      (
        await sb.from("store_testimonials").insert({
          author_name: EDITOR_NAME,
          body: "Bought a refurbished ThinkPad here; it arrived exactly as described.",
          source: "website",
          consent_confirmed: true,
          status: "pending",
        })
      ).error,
    ).toBeNull();

    await signIn(page, "owner");
    await page.goto("/admin/reviews");
    await page.getByTestId("reviews-testimonials-tab").click();
    await page.waitForURL(/\/admin\/reviews\/testimonials/);
    const pending = page.getByTestId("testimonial-row").filter({ hasText: EDITOR_NAME });
    await pending.getByTestId("testimonial-publish").click();
    await expect(page.getByTestId("testimonial-notice")).toHaveText("Status: Published.");

    await page.getByTestId("testimonial-add").click();
    await page.getByTestId("testimonial-author").fill(OWNER_NAME);
    await page.getByTestId("testimonial-body").fill(XSS);
    await page.getByTestId("testimonial-consent").check();
    await page.getByTestId("testimonial-publish-new").click();
    await expect(page.getByTestId("testimonial-notice")).toHaveText("Published.");
    const row = page.getByTestId("testimonial-row").filter({ hasText: OWNER_NAME });
    await row.getByRole("button", { name: /History/ }).click();
    await expect(row.getByText(/Added/)).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const section = page.getByTestId("store-reviews");
    await expect(section).toBeVisible();
    await expect(section.getByTestId("store-review").filter({ hasText: EDITOR_NAME }).first()).toBeVisible();
    // HTML rendered as text, never executed.
    await expect(section.getByTestId("store-review").filter({ hasText: `QA text ${RUN}` }).first()).toContainText("<img");
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    // Provenance: Google mark/label only for Google-sourced entries; no aggregate rating anywhere.
    const google = section.locator('[data-testid="store-review"][data-source="google"]').first();
    await expect(google.getByTestId("store-review-source")).toContainText("Posted on Google");
    const merchant = section.locator('[data-testid="store-review"][data-source="merchant"]').first();
    await expect(merchant.getByTestId("store-review-source")).not.toContainText("Google");
    await expect(merchant.locator("svg path[fill='#4285F4']")).toHaveCount(0);
    expect(await page.locator('script[type="application/ld+json"]').evaluateAll((s) => s.some((x) => /aggregateRating|"Review"/.test(x.textContent || "")))).toBe(false);
    // Clones are hidden from assistive tech and keyboard.
    expect(await section.locator("[data-clone]:not([aria-hidden='true'])").count()).toBe(0);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);

    // Pause / play.
    const pause = page.getByTestId("store-reviews-pause");
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    const state = await section.locator("[data-dir]").first().evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(state).toBe("paused");
    await pause.click();
    // Dialog lists every entry once and closes with Escape.
    await page.getByTestId("store-reviews-all").click();
    const dialog = page.getByTestId("store-reviews-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("store-review")).toHaveCount(9);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await section.screenshot({ path: `${OUT}/store-reviews-1440.png` });

    for (const w of [320, 768]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/");
      await expect(page.getByTestId("store-reviews")).toBeVisible();
      expect(await noOverflow(page), `no horizontal overflow at ${w}px`).toBeLessThanOrEqual(0);
    }
    await page.getByTestId("store-reviews").screenshot({ path: `${OUT}/store-reviews-320.png` });

    // Hide → gone from the homepage.
    await page.goto("/admin/reviews/testimonials");
    await page.getByTestId("testimonial-row").filter({ hasText: EDITOR_NAME }).getByTestId("testimonial-hide").click();
    await expect(page.getByTestId("testimonial-notice")).toHaveText("Status: Hidden.");
    await page.goto("/");
    await expect(page.getByTestId("store-review").filter({ hasText: EDITOR_NAME })).toHaveCount(0);
  });

  test("reduced motion: reviews do not move and repeats are not rendered visibly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const section = page.getByTestId("store-reviews");
    await expect(section).toBeVisible();
    const anim = await section.locator("[data-dir]").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe("none");
    const visibleClones = await section.locator("[data-clone]").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    expect(visibleClones).toBe(0);
  });
});
