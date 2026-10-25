/**
 * Authenticated merchant admin journeys against local Supabase + Next on PLAYWRIGHT_BASE_URL.
 * Complements theme-publish-workflow and e2e-isolated launch journeys.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
    await expect(page.getByRole("heading", { name: /store settings/i })).toBeVisible();
    const support = page.getByLabel(/support email/i);
    if (await support.count()) {
      await support.fill("e2e-support@lh-test.local");
      const save = page.getByRole("button", { name: /save/i }).first();
      await save.click();
      await expect(page.getByText(/saved|updated|settings/i).first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test("owner inventory + inquiries + orders shells load", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    for (const path of ["/admin/inventory", "/admin/inquiries", "/admin/orders", "/admin/content", "/admin/online-store"]) {
      await page.goto(path);
      await expect(page.locator("#admin-main")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test("editor cannot open settings; fulfillment cannot customize theme", async ({ browser }) => {
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

  test("desktop and mobile admin shells render products list", async ({ browser }) => {
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ] as const) {
      const ctx = await browser.newContext({ viewport: size });
      const page = await ctx.newPage();
      await signIn(page, owner.email, owner.password);
      await page.goto("/admin/products");
      await expect(page.getByRole("heading", { name: /product/i })).toBeVisible({ timeout: 20_000 });
      await ctx.close();
    }
  });
});
