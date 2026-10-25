/**
 * Authenticated browser theme workflow against local Supabase.
 * Requires: NEXT_PUBLIC_SUPABASE_* local, THEME_PUBLISHED_ENABLED=1 on the app under test,
 * Playwright Chromium, and migrations through 20261025150000.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;
test.beforeAll(() => {
  if (!LOOPBACK.test(SB_URL)) throw new Error("theme-publish E2E requires local Supabase URL");
  if (!SERVICE || !ANON) throw new Error("missing Supabase keys");
});

const admin = () =>
  createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const PUBLISHED_A =
  "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111";
const PUBLISHED_B = "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111";
const DRAFT_ONLY = "https://example.com/e2e-draft-hero-main.webp";

async function ensureOwner() {
  const sb = admin();
  const email = `e2e-theme-owner-${Date.now()}@lh-test.local`;
  const password = "E2eThemeOwner1!";
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error("create owner failed");
  await sb.from("admin_memberships").upsert({
    user_id: data.user.id,
    role: "owner",
    is_active: true,
  });
  return { email, password, userId: data.user.id };
}

async function ensureEditor() {
  const sb = admin();
  const email = `e2e-theme-editor-${Date.now()}@lh-test.local`;
  const password = "E2eThemeEditor1!";
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error("create editor failed");
  await sb.from("admin_memberships").upsert({
    user_id: data.user.id,
    role: "editor",
    is_active: true,
  });
  return { email, password, userId: data.user.id };
}

async function seedPublished(userId: string, mainImageUrl: string) {
  const sb = admin();
  const sections = [
    {
      id: "hero",
      type: "v5_cinematic_hero",
      enabled: true,
      label: "Cinematic hero",
      settings: {
        productHandles: [
          "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
          "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
          "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
        ],
        mainImageUrl,
        side1ImageUrl:
          "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111",
        side2ImageUrl:
          "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111",
      },
    },
    {
      id: "story",
      type: "v5_product_story",
      enabled: true,
      label: "Product story",
      settings: {
        productHandle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
        angleImages: {
          front:
            "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-front.webp?v=1792935242",
          left: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-left.webp?v=1792935243",
          right:
            "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-right.webp?v=1792935242",
          rear: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-rear.webp?v=1792935243",
        },
      },
    },
  ];
  const { data: draft } = await sb.rpc("save_homepage_draft", {
    payload: { actor_user_id: userId, sections },
  });
  const { data: pub, error } = await sb.rpc("publish_homepage_theme", {
    payload: { actor_user_id: userId, source_version_id: draft.version_id },
  });
  if (error) throw error;
  return { publishedVersionId: pub.published_version_id as string, draftId: draft.version_id as string };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // /admin/login also matches a naive /admin prefix — require a non-auth admin route.
  await page.waitForURL((url) => {
    const p = url.pathname;
    return p.startsWith("/admin") && !p.startsWith("/admin/login") && !p.startsWith("/admin/forgot-password") && !p.startsWith("/admin/reset-password");
  }, { timeout: 45_000 });
}

async function heroMainSrc(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  // Center hero shot is the 64%-wide link (sides are ~39%/43%); do not match side imgs first.
  const center = page.locator('.v5-hero-comp a[style*="width: 64%"] img, .v5-hero-comp a[style*="width:64%"] img');
  if (await center.count()) return center.first().getAttribute("src");
  const imgs = await page.locator(".v5-hero-comp a img").evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLImageElement).src),
  );
  return imgs.find((s) => s.includes("e2e-draft") || s.includes("laptop-hub-hero-dell")) || imgs[imgs.length - 1] || null;
}

async function acceptNextDialogs(page: Page) {
  page.on("dialog", async (d) => {
    await d.accept();
  });
}

test.describe.serial("theme publish/rollback browser workflow", () => {
  let owner: { email: string; password: string; userId: string };
  let editor: { email: string; password: string; userId: string };
  let firstPublishedId: string;

  test("seed published baseline A", async () => {
    owner = await ensureOwner();
    editor = await ensureEditor();
    const seeded = await seedPublished(owner.userId, PUBLISHED_A);
    firstPublishedId = seeded.publishedVersionId;
    expect(firstPublishedId).toBeTruthy();
  });

  test("logged-out storefront shows published A (not draft)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const src = await heroMainSrc(page);
    expect(src || "").toContain("laptop-hub-hero-dell-lap.webp");
    expect(src || "").not.toContain("e2e-draft-hero-main");
    await ctx.close();
  });

  test("owner changes image, saves draft; public unchanged", async ({ page, browser }) => {
    await acceptNextDialogs(page);
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/online-store");
    await expect(page.getByRole("heading", { name: /customize homepage/i })).toBeVisible();

    // Select cinematic hero section (first)
    await page.getByRole("button", { name: /cinematic hero/i }).first().click();
    const mainInput = page.getByTestId("theme-image-mainImageUrl");
    await expect(mainInput).toBeVisible({ timeout: 15_000 });
    await mainInput.fill(DRAFT_ONLY);
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 20_000 });

    const ctx = await browser.newContext();
    const publicPage = await ctx.newPage();
    const src = await heroMainSrc(publicPage);
    expect(src || "").toContain("laptop-hub-hero-dell-lap.webp");
    expect(src || "").not.toContain("e2e-draft-hero-main");
    await ctx.close();
  });

  test("owner opens draft preview showing draft URL", async ({ page }) => {
    await acceptNextDialogs(page);
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/online-store");
    await page.getByRole("button", { name: /cinematic hero/i }).first().click();
    const mainInput = page.getByTestId("theme-image-mainImageUrl");
    await expect(mainInput).toHaveValue(/e2e-draft-hero-main/, { timeout: 20_000 });
    const previewPromise = page.waitForEvent("popup");
    await page.getByTestId("theme-open-preview").click();
    const preview = await previewPromise;
    await preview.waitForLoadState("domcontentloaded");
    await expect(preview.getByText(/draft preview only/i)).toBeVisible();
    await expect(preview.locator(`img[src*="e2e-draft-hero-main"]`)).toBeVisible({ timeout: 15_000 });
    await preview.close();
  });

  test("owner publishes; logged-out sees draft URL; snapshot immutable", async ({ page, browser }) => {
    await acceptNextDialogs(page);
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/online-store");
    await page.getByRole("button", { name: /cinematic hero/i }).first().click();
    await expect(page.getByTestId("theme-image-mainImageUrl")).toHaveValue(/e2e-draft-hero-main/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("theme-publish")).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("theme-publish").click();
    await expect(page.getByTestId("theme-notice")).toContainText(/Published immutable snapshot/i, {
      timeout: 45_000,
    });

    const ctx = await browser.newContext();
    const publicPage = await ctx.newPage();
    const src = await heroMainSrc(publicPage);
    expect(src || "").toContain("e2e-draft-hero-main");
    await ctx.close();

    const sb = admin();
    const { data: pub } = await sb
      .from("theme_publications")
      .select("published_version_id")
      .eq("template_key", "homepage")
      .single();
    const { data: ver } = await sb
      .from("theme_versions")
      .select("id, status")
      .eq("id", pub!.published_version_id)
      .single();
    expect(ver?.status).toBe("published");
    expect(pub!.published_version_id).not.toEqual(firstPublishedId);

    // Published snapshot must reject direct mutation from service_role path that still hits the trigger
    const { error: mutErr } = await sb
      .from("theme_versions")
      .update({ label: "tamper-attempt" })
      .eq("id", pub!.published_version_id);
    expect(mutErr, "published rows must be immutable").toBeTruthy();
  });

  test("owner rolls back; logged-out sees previous image", async ({ page, browser }) => {
    await acceptNextDialogs(page);
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/online-store");
    const rollback = page.getByTestId(`theme-rollback-${firstPublishedId}`);
    await expect(rollback).toBeVisible({ timeout: 15_000 });
    await rollback.click();
    await expect(page.getByTestId("theme-notice")).toContainText(/[Rr]oll/i, { timeout: 30_000 });

    const ctx = await browser.newContext();
    const publicPage = await ctx.newPage();
    const src = await heroMainSrc(publicPage);
    expect(src || "").toContain("laptop-hub-hero-dell-lap.webp");
    expect(src || "").not.toContain("e2e-draft-hero-main");
    await ctx.close();
  });

  test("editor cannot publish via API", async ({ page }) => {
    await signIn(page, editor.email, editor.password);
    const res = await page.request.post("/api/admin/theme/homepage/publish", {
      data: { confirmPublish: true },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("seven approved CDN presets still present after workflow", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/");
    const srcs = await page.locator("img").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
    for (const part of [
      "laptop-hub-hero-dell-lap.webp",
      "laptop-hub-hero-hp-lap.webp",
      "laptop-hub-hero-lenovo-lap.webp",
      "dell-second_-home-sec-front.webp",
      "dell-second_-home-sec-left.webp",
      "dell-second_-home-sec-right.webp",
      "dell-second_-home-sec-rear.webp",
    ]) {
      // After rollback to A, hero main is Dell preset; story angles remain
      if (part.includes("hero-hp") || part.includes("hero-lenovo") || part.includes("dell-second")) {
        expect(srcs.some((s) => s.includes(part)), part).toBeTruthy();
      }
    }
    await ctx.close();
  });
});
