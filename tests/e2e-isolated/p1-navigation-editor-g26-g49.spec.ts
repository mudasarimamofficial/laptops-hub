/**
 * G26 / G49 acceptance on the ISOLATED stack: Admin → Navigation edits reach the desktop header, the mobile drawer and
 * the footer on every storefront page (including cached ones), survive a reload, can be restored from the version
 * history, refuse unsafe addresses and stale saves, respect an intentionally empty menu, and stay role-limited.
 * The navigation rows that existed before the run are put back at the end.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "test-results/navigation-g26-g49";
const KEYS = ["navigation", "navigation_history"];

type Role = "owner" | "editor" | "manager" | "fulfillment";

async function signIn(page: Page, role: Role) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function asRole(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ baseURL: ORIGIN });
  const page = await ctx.newPage();
  await signIn(page, role);
  return { ctx, page };
}

async function openEditor(page: Page) {
  await page.goto("/admin/navigation");
  const editor = page.getByTestId("navigation-editor");
  await expect(editor).toBeVisible();
  // Inputs are controlled: wait for hydration before typing.
  await expect(page.getByRole("button", { name: "+ Add header link" })).toBeEnabled();
  return editor;
}

async function liveVersion(): Promise<number> {
  const { data } = await sb.from("store_settings").select("value").eq("key", "navigation").maybeSingle();
  return (data?.value as { version?: number } | null)?.version ?? 1;
}

async function headerLabels(page: Page) {
  return (await page.getByTestId("header-nav-link").allInnerTexts()).map((t) => t.replace(/\s*NEW\s*$/, "").trim());
}

let saved: { key: string; value: unknown; updated_at: string; updated_by: string | null }[] = [];

test.describe.configure({ mode: "serial" });

test.describe("Navigation editor G26/G49 (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("navigation editor");
    saved = ((await sb.from("store_settings").select("key, value, updated_at, updated_by").in("key", KEYS)).data ?? []) as typeof saved;
    // Start from the V5 defaults with no history, like production today (no navigation row).
    await sb.from("store_settings").delete().in("key", KEYS);
    fs.mkdirSync(OUT, { recursive: true });
  });

  test.afterAll(async ({ browser }) => {
    // Publish the V5 defaults through the API so every cached page is refreshed, then put the original rows back.
    const { ctx, page } = await asRole(browser, "owner");
    await page.request.post("/api/admin/navigation", { data: { action: "restore_defaults" }, headers: { origin: ORIGIN } });
    await ctx.close();
    await sb.from("store_settings").delete().in("key", KEYS);
    if (saved.length) await sb.from("store_settings").insert(saved);
  });

  test("owner edits header + footer; desktop header, cached pages, mobile drawer and footer follow; reload keeps it", async ({ page }) => {
    test.setTimeout(150_000);
    // Warm the 60-second page cache with the V5 menu so the test proves the save refreshes cached pages too.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/collections/all");
    expect(await headerLabels(page)).toContain("Dell");

    await signIn(page, "owner");
    await openEditor(page);
    await expect(page.getByTestId("nav-live-version")).toHaveText("1");
    // Existing values are shown in editable fields.
    await expect(page.getByTestId("nav-header-row")).toHaveCount(7);
    await expect(page.getByLabel("Header link 1 name")).toHaveValue("Dell");
    await expect(page.getByLabel("Header link 1 address")).toHaveValue("/collections/dell");
    await expect(page.getByLabel("Footer column 1 heading")).toHaveValue("Shop");
    await expect(page.getByLabel("Footer column 1 link 1 name")).toHaveValue("All products");
    await expect(page.getByRole("button", { name: "Reset to V5 defaults" })).toBeVisible();

    // Rename + re-point an existing header link.
    await page.getByLabel("Header link 1 name").fill("QA Dell renamed");
    await page.getByLabel("Header link 1 address").fill("/collections/dell?qa=nav");
    // Unsafe address: inline message, problem list, and Save refuses.
    await page.getByLabel("Header link 2 address").fill("//evil.example/x");
    await expect(page.getByText("Use a full https:// address for other websites.").first()).toBeVisible();
    await expect(page.getByTestId("nav-problems")).toContainText("Header link 2");
    await page.getByRole("button", { name: "Save & publish navigation" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Fix this first" })).toBeVisible();
    expect(await liveVersion()).toBe(1);
    await page.getByLabel("Header link 2 address").fill("/collections/hp");
    await expect(page.getByTestId("nav-problems")).toHaveCount(0);
    // Re-point the V5 "Support" link: the saved address must be used as-is (it was silently overridden before).
    await expect(page.getByLabel("Header link 7 name")).toHaveValue("Support");
    await page.getByLabel("Header link 7 address").fill("/track-order?qa=help");

    // Add a header link with the NEW badge, then move it up one place (8 → 7).
    await page.getByRole("button", { name: "+ Add header link" }).click();
    const add = page.getByRole("form", { name: "Add header link" });
    await add.getByLabel("Name").fill("QA Workstations");
    await add.getByLabel("Goes to").fill("/collections/all?qa=ws");
    await add.getByLabel("Show a “NEW” badge").check();
    await add.getByRole("button", { name: "Add to header" }).click();
    await expect(page.getByTestId("nav-header-row")).toHaveCount(8);
    await page.getByRole("button", { name: "Move header link 8 up" }).click();
    await expect(page.getByLabel("Header link 7 name")).toHaveValue("QA Workstations");
    // Wider than the V5 header: the editor warns before publishing.
    await expect(page.getByTestId("nav-header-width-warning")).toBeVisible();

    // Footer: rename a heading, rename a link, add a link, remove a link (confirm dialog).
    await page.getByLabel("Footer column 1 heading").fill("QA Shop");
    await page.getByLabel("Footer column 1 link 1 name").fill("QA All products");
    await page.getByRole("button", { name: "+ Add link to “QA Shop”" }).click();
    await page.getByLabel("Footer column 1 link 8 name").fill("QA Footer link");
    await page.getByLabel("Footer column 1 link 8 address").fill("/collections/all?qa=foot");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Remove footer column 1 link 2" }).click(); // "Laptops"
    await expect(page.getByTestId("nav-footer-column").first().getByTestId("nav-footer-link")).toHaveCount(7);
    await page.screenshot({ path: `${OUT}/admin-edited.png`, fullPage: true });

    await page.getByRole("button", { name: "Save & publish navigation" }).click();
    await expect(page.getByText("Navigation published. Version 2 is live.")).toBeVisible();
    await expect(page.getByTestId("nav-live-version")).toHaveText("2");
    expect(await liveVersion()).toBe(2);

    // Reload: saved values come back from the database.
    await page.reload();
    await expect(page.getByLabel("Header link 1 name")).toHaveValue("QA Dell renamed");
    await expect(page.getByLabel("Header link 7 name")).toHaveValue("QA Workstations");
    await expect(page.getByLabel("Header link 7 NEW badge")).toBeChecked();
    await expect(page.getByLabel("Footer column 1 heading")).toHaveValue("QA Shop");
    await expect(page.getByLabel("Footer column 1 link 7 name")).toHaveValue("QA Footer link");
    await expect(page.getByTestId("nav-history-row")).toHaveCount(2); // v2 + the V5 menus from before the first edit

    // Storefront, desktop (≥1180px shows the header links). The cached collection page was refreshed by the save.
    for (const path of ["/", "/collections/all"]) {
      await page.goto(path);
      const labels = await headerLabels(page);
      expect(labels[0], path).toBe("QA Dell renamed");
      expect(labels, path).toContain("QA Workstations");
      expect(labels, path).not.toContain("Dell");
      await expect(page.getByTestId("header-nav-link").filter({ hasText: "QA Workstations" })).toContainText("NEW");
      await expect(page.getByTestId("header-nav-link").first()).toHaveAttribute("href", "/collections/dell?qa=nav");
      await expect(page.getByTestId("header-nav-link").filter({ hasText: "Support" })).toHaveAttribute("href", "/track-order?qa=help");
      const footer = page.getByTestId("site-footer");
      await expect(footer.getByText("QA Shop", { exact: true })).toBeVisible();
      await expect(footer.getByRole("link", { name: "QA Footer link" })).toHaveAttribute("href", "/collections/all?qa=foot");
      await expect(footer.getByRole("link", { name: "QA All products" })).toBeVisible();
      await expect(footer.getByRole("link", { name: "Laptops", exact: true })).toHaveCount(0);
    }
    // The over-wide menu never pushes search, compare or cart off the screen on laptop widths.
    for (const width of [1180, 1280, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const cart = page.getByRole("button", { name: /Open cart/ });
      await expect(cart).toBeVisible();
      const box = (await cart.boundingBox())!;
      expect(box.x + box.width, `cart inside ${width}px`).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `no sideways scroll at ${width}px`).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `${OUT}/storefront-desktop-${width}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Mobile drawer (390px): the same header links under "Quick links", and they navigate.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("header-nav-link").first()).toBeHidden(); // desktop row hidden on phones
    const open = page.getByTestId("mobile-nav-open");
    await expect(open).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
    await open.click();
    const drawer = page.getByRole("navigation", { name: /^Mobile$/i });
    await drawer.getByRole("button", { name: /Quick links/ }).click();
    const quick = drawer.getByTestId("mnav-quick-link");
    await expect(quick.first()).toHaveText("QA Dell renamed");
    await expect(quick.filter({ hasText: "QA Workstations" })).toContainText("NEW");
    await page.screenshot({ path: `${OUT}/storefront-mobile-drawer.png` });
    await quick.filter({ hasText: "QA Workstations" }).click();
    await expect(page).toHaveURL(/\/collections\/all\?qa=ws/);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(390);
  });

  test("a save from an out-of-date screen is refused (409) and changes nothing", async ({ browser }) => {
    const a = await asRole(browser, "owner");
    const b = await asRole(browser, "owner");
    await openEditor(a.page);
    await openEditor(b.page);
    const before = await liveVersion();

    await a.page.getByLabel("Footer column 1 heading").fill("QA Shop A");
    await a.page.getByRole("button", { name: "Save & publish navigation" }).click();
    await expect(a.page.getByText(`Version ${before + 1} is live.`)).toBeVisible();

    await b.page.getByLabel("Footer column 1 heading").fill("QA Shop B");
    await b.page.getByRole("button", { name: "Save & publish navigation" }).click();
    await expect(b.page.getByText("This screen is out of date.")).toBeVisible();
    await expect(b.page.getByRole("button", { name: "Reload navigation" })).toBeVisible();

    expect(await liveVersion()).toBe(before + 1);
    const { data } = await sb.from("store_settings").select("value").eq("key", "navigation").single();
    expect((data!.value as { footerColumns: { title: string }[] }).footerColumns[0].title).toBe("QA Shop A");
    await a.ctx.close();
    await b.ctx.close();
  });

  test("API refuses unsafe addresses, missing versions, wrong roles, anonymous and cross-site writes", async ({ browser, page }) => {
    await signIn(page, "owner");
    const v = await liveVersion();
    const good = (await (await page.request.get("/api/admin/navigation")).json()).navigation;
    const put = (data: object) => page.request.put("/api/admin/navigation", { data, headers: { origin: ORIGIN } });
    for (const href of ["//evil.example", "javascript:alert(1)", "/admin/staff", "/api/checkout", "https://u:p@example.com"]) {
      const r = await put({ headerNav: [{ id: "x", label: "X", href }], footerColumns: [], expectedVersion: v });
      expect(r.status(), href).toBe(400);
    }
    const dupIds = await put({ headerNav: [{ id: "x", label: "X", href: "/a" }, { id: "x", label: "Y", href: "/b" }], footerColumns: [], expectedVersion: v });
    expect(dupIds.status()).toBe(400);
    const tooMany = await put({ headerNav: Array.from({ length: 13 }, (_, i) => ({ id: "h" + i, label: "L" + i, href: "/collections/all" })), footerColumns: [], expectedVersion: v });
    expect(tooMany.status()).toBe(400);
    const noVersion = await put({ headerNav: good.headerNav, footerColumns: good.footerColumns });
    expect(noVersion.status()).toBe(400);
    expect((await noVersion.json()).error).toBe("version_required");
    const stale = await put({ headerNav: good.headerNav, footerColumns: good.footerColumns, expectedVersion: v - 1 });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toBe("stale_version");

    const cross = await page.request.put("/api/admin/navigation", { data: { ...good, expectedVersion: v }, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
    expect((await cross.json()).error).toBe("forbidden_origin");

    const anon = await browser.newContext({ baseURL: ORIGIN });
    expect((await anon.request.put("/api/admin/navigation", { data: { ...good, expectedVersion: v }, headers: { origin: ORIGIN } })).status()).toBe(401);
    await anon.close();

    for (const role of ["fulfillment", "manager"] as const) {
      const s = await asRole(browser, role);
      const r = await s.page.request.put("/api/admin/navigation", { data: { ...good, expectedVersion: v }, headers: { origin: ORIGIN } });
      expect(r.status(), role).toBe(403);
      const rv = await s.page.request.post("/api/admin/navigation", { data: { action: "restore_version", version: 1, expectedVersion: v }, headers: { origin: ORIGIN } });
      expect(rv.status(), role).toBe(403);
      await s.ctx.close();
    }
    expect(await liveVersion()).toBe(v);
  });

  test("editor: no Reset button (with explanation), reset API refused, but can restore a version from the history", async ({ browser }) => {
    const { ctx, page } = await asRole(browser, "editor");
    await openEditor(page);
    await expect(page.getByRole("button", { name: "Reset to V5 defaults" })).toHaveCount(0);
    await expect(page.getByText("Only an owner or admin can reset to the V5 defaults")).toBeVisible();
    const v = await liveVersion();
    const reset = await page.request.post("/api/admin/navigation", { data: { action: "restore_defaults", expectedVersion: v }, headers: { origin: ORIGIN } });
    expect(reset.status()).toBe(403);
    expect(await liveVersion()).toBe(v);

    // Restore the menus customers saw before the first edit (the V5 defaults, version 1).
    const row = page.locator('[data-testid="nav-history-row"][data-version="1"]');
    await expect(row).toContainText("Before the first edit");
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Restore version 1" }).click();
    await expect(page.getByText(`Version 1 restored. Version ${v + 1} is live.`)).toBeVisible();
    await expect(page.getByLabel("Header link 1 name")).toHaveValue("Dell");
    await expect(page.locator(`[data-testid="nav-history-row"][data-version="${v + 1}"]`)).toContainText("Restored from version 1");
    await ctx.close();

    const anon = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1280, height: 900 } });
    const p = await anon.newPage();
    await p.goto("/collections/all");
    const labels = await headerLabels(p);
    expect(labels[0]).toBe("Dell");
    expect(labels).not.toContain("QA Workstations");
    await expect(p.getByTestId("site-footer").getByText("Shop", { exact: true })).toBeVisible();
    await anon.close();
  });

  test("an intentionally empty menu stays empty on the storefront; owner Reset brings the V5 menus back", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, "owner");
    await openEditor(page);
    // Remove every header link and every footer column through the editor.
    page.on("dialog", (d) => void d.accept());
    while ((await page.getByTestId("nav-header-row").count()) > 0) {
      await page.getByRole("button", { name: "Remove header link 1" }).click();
    }
    while ((await page.getByTestId("nav-footer-column").count()) > 0) {
      await page.getByRole("button", { name: "Delete footer column 1" }).click();
    }
    await expect(page.getByTestId("nav-header-empty")).toBeVisible();
    await expect(page.getByTestId("nav-footer-empty")).toBeVisible();
    const v = await liveVersion();
    await page.getByRole("button", { name: "Save & publish navigation" }).click(); // confirm "will be empty" accepted
    await expect(page.getByText(`Navigation published. Version ${v + 1} is live.`)).toBeVisible();

    await page.goto("/collections/all");
    await expect(page.getByTestId("header-nav-link")).toHaveCount(0);
    await expect(page.getByTestId("footer-nav-column")).toHaveCount(0);
    await expect(page.getByTestId("site-footer")).toBeVisible(); // brand, contact and copyright remain
    await expect(page.getByTestId("footer-contact")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-nav-open")).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
    await page.getByTestId("mobile-nav-open").click();
    const drawer = page.getByRole("navigation", { name: /^Mobile$/i });
    await expect(drawer.getByRole("link", { name: /All products/ })).toBeVisible();
    await expect(drawer.getByTestId("mnav-quick-links")).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    await page.getByRole("button", { name: "Reset to V5 defaults" }).click();
    await expect(page.getByText(`Menus reset to the V5 defaults. Version ${v + 2} is live.`)).toBeVisible();
    await page.goto("/collections/all");
    const labels = await headerLabels(page);
    expect(labels.slice(0, 5)).toEqual(["Dell", "HP", "Lenovo", "Chromebooks", "Accessories"]);
    // "Guides" is shown only while a guide is published. The V5 Support link follows the first public help page,
    // so it stays visible even though the FAQ is not published on this test store.
    const support = page.getByTestId("header-nav-link").filter({ hasText: "Support" });
    await expect(support).toHaveCount(1);
    const { data: faq } = await sb.from("content_pages").select("status").eq("slug", "faq").maybeSingle();
    if (faq?.status !== "published") expect(await support.getAttribute("href")).not.toBe("/pages/faq");
    await expect(page.getByTestId("footer-nav-column").first()).toContainText("Shop");
    // The V5 menu is never cut at laptop widths (the overflow guard only acts on wider merchant menus).
    for (const width of [1180, 1280, 1366, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const clipped = await page.locator("nav[aria-label=Primary]").evaluate((n) => n.scrollWidth - n.clientWidth);
      expect(clipped, `V5 header links fit at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});
