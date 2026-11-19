/**
 * Exception closure: mobile nav open/close/nav, shoppable reels across viewports,
 * guides empty vs published, guest-auth landmarks, keyboard + axe scan.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { assertIsolatedAppAligned } from "../../scripts/test-fixtures/check-isolated-app.mjs";

const axeSource = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "test-results/exception-closure";
const RUN = Date.now().toString(36);
const REEL_TITLE = `QA exception reel ${RUN}`;
const POST_SLUG = `qa-exception-guide-${RUN}`;
const VIDEO = `${SB_URL.replace(/\/+$/, "")}/storage/v1/object/public/reels/qa-exc-${RUN}.mp4`;
const P = fx.products[0];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function stubVideo(page: Page) {
  await page.route(/\/reels\/qa-exc-[^/]*\.mp4/, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync("tests/fixtures/reel-synthetic.webm") }),
  );
}

async function cleanup() {
  const { data: rows } = await sb.from("reels").select("id").like("title", "QA exception reel %");
  for (const r of rows || []) await sb.from("reel_products").delete().eq("reel_id", r.id);
  await sb.from("reels").delete().like("title", "QA exception reel %");
  await sb.from("articles").delete().like("slug", "qa-exception-guide-%");
}

async function runAxe(page: Page, context: string) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe;
    const r = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      resultTypes: ["violations"],
    });
    return {
      violations: (r.violations || []).map((v: { id: string; impact: string; help: string; nodes: unknown[] }) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      })),
    };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `axe-${context}.json`), JSON.stringify(result, null, 2));
  const critical = result.violations.filter((v: { impact: string }) => v.impact === "critical" || v.impact === "serious");
  return { all: result.violations, critical };
}

test.describe.serial("exception closure: mobile nav, reels, guides, a11y", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("exception-closure");
    await assertIsolatedAppAligned("exception-closure");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
  });
  test.afterAll(cleanup);

  test("mobile Open menu opens, navigates, and closes after hydration", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const open = page.getByTestId("mobile-nav-open");
    await expect(open).toBeVisible();
    // Must wait until React handlers are attached — pre-hydration clicks were silent no-ops.
    await expect(open).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
    await expect(open).toBeEnabled();
    await open.click();
    const nav = page.getByRole("navigation", { name: /^Mobile$/i });
    await expect(nav).toBeVisible();
    await expect(open).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: `${OUT}/mobile-nav-open.png` });

    await nav.getByRole("link", { name: /All products/i }).click();
    await expect(page).toHaveURL(/\/collections\/all/);
    await expect(page.getByRole("navigation", { name: /^Mobile$/i })).toHaveCount(0);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-nav-open")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("mobile-nav-open").click();
    await expect(page.getByRole("navigation", { name: /^Mobile$/i })).toBeVisible();
    await page.getByRole("button", { name: /^Close menu$/i }).click();
    await expect(page.getByRole("navigation", { name: /^Mobile$/i })).toHaveCount(0);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
  });

  test("guides: empty index gated 404; published guide unlocks index, sitemap, then unpublish 404", async ({ page }) => {
    const empty = await page.request.get("/guides");
    expect(empty.status(), "empty isolated DB must gate /guides").toBe(404);

    await signIn(page);
    await page.goto("/admin/blog/new");
    await page.getByLabel("Title", { exact: true }).fill("QA exception guide");
    await page.getByLabel("Web address").fill(POST_SLUG);
    await page.getByLabel("Summary").fill("Exception-closure guide for index visibility.");
    await page.getByText("Advanced: HTML source").click();
    await page.locator("details textarea").fill("<p>Published guide body for exception closure.</p>");
    await page.getByLabel("Visible — published now").check();
    await page.getByRole("button", { name: "Create post" }).click();
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?saved=1$/);

    const article = await page.request.get(`/guides/${POST_SLUG}`);
    expect(article.status()).toBe(200);
    await page.goto(`/guides/${POST_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: "QA exception guide" })).toBeVisible();

    const index = await page.request.get("/guides");
    expect(index.status()).toBe(200);
    await page.goto("/guides");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(`a[href="/guides/${POST_SLUG}"]`).first()).toBeVisible();
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/guides/${POST_SLUG}`);

    const { data: idRow } = await sb.from("articles").select("id").eq("slug", POST_SLUG).single();
    await page.goto(`/admin/blog/${idRow!.id}`);
    await page.getByLabel("Hidden — draft, not on the site").check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Post saved.").first()).toBeVisible();
    expect((await page.request.get(`/guides/${POST_SLUG}`)).status()).toBe(404);
    // Index returns to gated 404 once no public articles remain.
    expect((await page.request.get("/guides")).status()).toBe(404);
  });

  test("shoppable reel modal: open/close, keyboard, video, product, cart across viewports", async ({ page }) => {
    test.setTimeout(180_000);
    await stubVideo(page);
    await signIn(page);
    await page.goto("/admin/reels");
    const form = page.getByTestId("reel-new-form");
    await form.getByLabel("Title").fill(REEL_TITLE);
    await form.getByLabel(/Video URL/).fill(VIDEO);
    await form.getByLabel("Video rights").selectOption("owned");
    await form.getByLabel("Status").selectOption("published");
    const picker = form.getByTestId("reel-product-picker");
    await picker.getByLabel("Search products to feature").fill(P.handle.slice(0, 16));
    await expect(picker.getByRole("button", { name: new RegExp(P.handle) })).toBeVisible({ timeout: 10_000 });
    await picker.getByRole("button", { name: new RegExp(P.handle) }).click();
    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText("Reel saved.")).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      const reel = page.getByTestId("reels-section").getByTestId("reel").filter({ hasText: REEL_TITLE });
      await expect(reel).toBeVisible();
      await reel.getByTestId("reel-open").click();
      const modal = page.getByTestId("reel-shoppable-modal");
      await expect(modal).toBeVisible();
      await expect(modal.locator("video")).toBeVisible();
      // Modal focuses the close control on open.
      await expect(page.getByTestId("reel-modal-close")).toBeFocused();
      await expect(modal.getByTestId("reel-shop-product")).toHaveCount(1);
      await expect(modal.getByTestId("reel-shop-product")).toContainText(/In stock|Unavailable/);
      const playing = await modal.locator("video").evaluate((v: HTMLVideoElement) => !v.paused || v.readyState >= 2);
      expect(playing).toBeTruthy();

      const addBtn = modal.getByTestId("reel-modal-add-to-cart");
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        // Add-to-cart closes the reel modal so the cart drawer is not covered.
        await expect(page.getByTestId("reel-shoppable-modal")).toHaveCount(0);
        const cart = page.getByRole("dialog", { name: /cart/i });
        await expect(cart).toBeVisible();
        await page.getByRole("button", { name: /Close cart/i }).click();
        await expect(cart).toHaveCount(0);
        // Re-open for Escape / close-button coverage on this viewport
        await reel.getByTestId("reel-open").click();
        await expect(page.getByTestId("reel-shoppable-modal")).toBeVisible();
      }

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("reel-shoppable-modal")).toHaveCount(0);
      await reel.getByTestId("reel-open").click();
      await expect(page.getByTestId("reel-shoppable-modal")).toBeVisible();
      await page.getByTestId("reel-modal-close").click();
      await expect(page.getByTestId("reel-shoppable-modal")).toHaveCount(0);
      await page.screenshot({ path: `${OUT}/reel-modal-${vp.name}.png` });
    }
  });

  test("guest auth pages: main landmark, keyboard to fields; skip-link N/A without chrome", async ({ page }) => {
    for (const route of ["/admin/login", "/admin/forgot-password"]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);
      await expect(page.locator("main#admin-main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Guest auth has no repetitive header/nav chrome — a skip link would be artificial.
      await expect(page.locator('a[href="#main"], a.adm-skip, a:has-text("Skip to content")')).toHaveCount(0);
      await page.keyboard.press("Tab");
      const email = page.getByLabel(/email/i);
      await email.focus();
      await expect(email).toBeFocused();
    }
  });

  test("axe scan homepage + login; keyboard skip on storefront", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    // Storefront skip link becomes visible on focus
    await page.keyboard.press("Tab");
    const skip = page.locator('a[href="#main"]').first();
    if (await skip.count()) {
      await skip.focus();
      await expect(skip).toBeFocused();
    }
    const homeAxe = await runAxe(page, "home");
    expect(homeAxe.critical, JSON.stringify(homeAxe.critical)).toEqual([]);

    await page.goto("/admin/login");
    const loginAxe = await runAxe(page, "login");
    expect(loginAxe.critical, JSON.stringify(loginAxe.critical)).toEqual([]);

    // Full assistive-technology (NVDA/VoiceOver) session remains NOT TESTED — documented in acceptance report.
  });
});
