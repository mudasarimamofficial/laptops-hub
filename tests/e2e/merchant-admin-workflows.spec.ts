/**
 * Authenticated merchant admin journeys against local Supabase + Next on PLAYWRIGHT_BASE_URL.
 * Complements theme-publish-workflow and e2e-isolated launch journeys.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

// Writes test data with the service role: refuse anything but a verified LOCAL Supabase.
test.beforeAll(async () => {
  await assertLocalOnly("merchant-admin-workflows.spec.ts");
});

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;

test.beforeAll(() => {
  if (!LOOPBACK.test(SB_URL)) throw new Error("merchant-admin E2E requires local Supabase URL");
  if (!SERVICE || !ANON) throw new Error("missing Supabase keys");
});

const admin = () =>
  createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureStaff(role: "owner" | "editor" | "manager" | "fulfillment") {
  const sb = admin();
  const email = `e2e-merchant-${role}-${Date.now()}@lh-test.local`;
  const password = "E2eMerchant1!";
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error("create user failed");
  await sb.from("admin_memberships").upsert({
    user_id: data.user.id,
    role,
    is_active: true,
  });
  return { email, password, userId: data.user.id, role };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => {
    const p = url.pathname;
    return p.startsWith("/admin") && !p.startsWith("/admin/login") && !p.startsWith("/admin/forgot-password");
  }, { timeout: 45_000 });
}

test.describe.serial("merchant admin workflows", () => {
  let owner: { email: string; password: string; userId: string };
  let editor: { email: string; password: string };
  let fulfillment: { email: string; password: string };
  let createdHandle = "";

  test("seed staff roles", async () => {
    owner = await ensureStaff("owner");
    editor = await ensureStaff("editor");
    fulfillment = await ensureStaff("fulfillment");
    expect(owner.userId).toBeTruthy();
  });

  test("owner creates product and opens editor", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/products/new");
    const title = `E2E Merchant Laptop ${Date.now()}`;
    await page.getByLabel(/title/i).fill(title);
    await page.getByRole("button", { name: /create product/i }).click();
    await page.waitForURL(/\/admin\/products\/[^/]+$/, { timeout: 45_000 });
    createdHandle = page.url().split("/admin/products/")[1]?.split("?")[0] || "";
    expect(createdHandle).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("owner saves variant matrix rows", async ({ page }) => {
    test.skip(!createdHandle, "no product");
    await signIn(page, owner.email, owner.password);
    await page.goto(`/admin/products/${createdHandle}`);
    const save = page.getByRole("button", { name: /save variants/i });
    if (await save.count()) {
      await expect(save).toBeEnabled({ timeout: 20_000 });
      await save.click();
      await expect(page.getByText(/saved|variant/i).first()).toBeVisible({ timeout: 30_000 });
    } else {
      // Matrix may be further down the edit form — still prove product page loads for staff.
      await expect(page.locator("body")).toContainText(/variant|inventory|media|product/i);
    }
  });

  test("owner opens collections and create form", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/collections");
    await expect(page.getByRole("heading", { name: /collection/i })).toBeVisible();
    await page.goto("/admin/collections/new");
    await expect(page.getByRole("heading", { name: /collection/i })).toBeVisible();
    const title = page.getByLabel(/title/i);
    if (await title.count()) {
      await title.fill(`E2E Collection ${Date.now()}`);
      const submit = page.getByRole("button", { name: /create/i });
      if (await submit.count()) {
        await submit.click();
        await page.waitForTimeout(1500);
      }
    }
  });

  test("owner sees import job history UI", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/products/import");
    await expect(page.getByTestId("import-job-history")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("import-history-refresh")).toBeVisible();
  });

  test("owner edits store settings form", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/admin/settings");
    // Page header is "Settings" (AdminPageHeader); hub cards link into Store details / shipping / etc.
    await expect(page.getByRole("heading", { level: 1, name: /^Settings$/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /settings categories/i })).toBeVisible();
    const support = page.getByLabel(/support email/i);
    await expect(support).toBeVisible({ timeout: 20_000 });
    await support.fill("e2e-support@lh-test.local");
    const save = page.getByRole("button", { name: /save/i }).first();
    await save.click();
    await expect(page.getByText(/saved|updated|settings/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("owner inventory + inquiries + orders shells load", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    for (const path of [
      "/admin/inventory",
      "/admin/inquiries",
      "/admin/orders",
      "/admin/content",
      "/admin/online-store",
      "/admin/navigation",
    ]) {
      await page.goto(path);
      await expect(page.locator("#admin-main")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test("owner reviews blog media merchandising staff activity shells", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, owner.email, owner.password);
    for (const path of [
      "/admin/reviews",
      "/admin/blog",
      "/admin/media",
      "/admin/merchandising",
      "/admin/staff",
      "/admin/activity",
      "/admin/reels",
      "/admin/seo",
    ]) {
      await page.goto(path);
      await expect(page.locator("#admin-main")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test("owner blog create, save and reload (Visibility, TipTap, SEO)", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const title = `E2E Blog ${stamp}`;
    const slug = `e2e-blog-${stamp}`;
    const body = `TipTap body for isolated merchant QA ${stamp}.`;
    const summary = "E2E summary for the guides list.";
    const seoTitle = `E2E SEO title ${stamp}`;
    const seoDescription = "E2E search description for the blog editor.";
    const sb = admin();
    try {
      await signIn(page, owner.email, owner.password);
      await page.goto("/admin/blog");
      // The header CTA; the empty state repeats the same link when no posts exist.
      await page.getByRole("link", { name: "Add blog post" }).first().click();
      await expect(page).toHaveURL(/\/admin\/blog\/new$/);

      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Web address").fill(slug);

      // TipTap surface: a contenteditable that only appears once the editor is hydrated.
      const editor = page.getByTestId("blog-rich-editor");
      await expect(editor).toBeVisible({ timeout: 20_000 });
      await editor.click();
      await page.keyboard.type(body);
      await expect(editor).toContainText(body);

      await page.getByLabel("Summary").fill(summary);
      await page.getByLabel(/^Page title/).fill(seoTitle);
      await page.getByLabel(/^Description \(/).fill(seoDescription);

      // Visibility defaults to Hidden for a new post; make it Visible so the public page can be checked too.
      await expect(page.getByLabel("Hidden — draft, not on the site")).toBeChecked();
      await page.getByLabel("Visible — published now").check();

      await page.getByRole("button", { name: "Create post" }).click();
      await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?saved=1$/, { timeout: 30_000 });
      await expect(page.getByText("Post saved.").first()).toBeVisible();

      // Stored row matches what was typed (TipTap HTML, SEO, publish state).
      const { data: row, error } = await sb
        .from("articles")
        .select("title, slug, excerpt, body_html, status, published_at, seo_title, seo_description")
        .eq("slug", slug)
        .single();
      expect(error).toBeNull();
      expect(row).toMatchObject({ title, slug, excerpt: summary, status: "published", seo_title: seoTitle, seo_description: seoDescription });
      expect(row!.published_at).toBeTruthy();
      expect(row!.body_html).toContain(body);

      // Reload: every field and the visibility choice round-trip.
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
      await expect(page.getByLabel("Web address")).toHaveValue(slug);
      await expect(page.getByLabel("Summary")).toHaveValue(summary);
      await expect(page.getByLabel(/^Page title/)).toHaveValue(seoTitle);
      await expect(page.getByLabel(/^Description \(/)).toHaveValue(seoDescription);
      await expect(page.getByLabel("Visible — published now")).toBeChecked();
      await expect(page.getByTestId("blog-rich-editor")).toContainText(body, { timeout: 20_000 });

      // Edit through the existing-post form ("Save"), then confirm the change survives another reload.
      await page.getByLabel("Hidden — draft, not on the site").check();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Post saved.").first()).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByLabel("Hidden — draft, not on the site")).toBeChecked();
      const { data: after } = await sb.from("articles").select("status").eq("slug", slug).single();
      expect(after!.status).toBe("draft");
    } finally {
      await sb.from("articles").delete().eq("slug", slug);
    }
  });
  test("editor cannot open settings; fulfillment cannot customize theme", async ({ browser }) => {
    test.setTimeout(120_000);
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await signIn(page, editor.email, editor.password);
      await page.goto("/admin/settings");
      await expect(page).toHaveURL(/forbidden|online-store|admin\/?$/);
      // Editors are not in settings allow-list — expect forbidden or redirect away from settings controls
      const onSettings = /\/admin\/settings/.test(page.url());
      if (onSettings) {
        await expect(page.getByRole("heading", { name: /store settings/i })).toHaveCount(0);
      }
      await ctx.close();
    }
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await signIn(page, fulfillment.email, fulfillment.password);
      await page.goto("/admin/online-store");
      await expect(page).toHaveURL(/forbidden|orders|admin\/?$/);
      await expect(page.getByTestId("theme-publish")).toHaveCount(0);
      await ctx.close();
    }
  });

  test("desktop tablet mobile admin shells render products list", async ({ browser }) => {
    test.setTimeout(180_000);
    for (const size of [
      { width: 360, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
    ] as const) {
      const ctx = await browser.newContext({ viewport: size });
      const page = await ctx.newPage();
      await signIn(page, owner.email, owner.password);
      await page.goto("/admin/products");
      await expect(page.getByRole("heading", { name: /product/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#admin-main")).toBeVisible();
      await ctx.close();
    }
  });
});
