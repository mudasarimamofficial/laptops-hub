/**
 * Theme editor P7 — "Cart & compare" site-wide text (cart page, cart panel, compare page), ISOLATED stack.
 * Owner edits the panel → saves a draft (public pages unchanged) → publishes → cart and compare pages show the new
 * text → rollback brings the V5 text back. Draft and publication are restored afterwards (crash-safe run guard).
 */
import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { beginGuardedRun, endGuardedRun } from "./helpers/run-guard";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const APP = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
const GUARD = "theme-cart-compare";
const RUN = Date.now().toString(36);
const CART_EMPTY = `QA empty cart ${RUN}`;
const CART_TITLE = `QA basket ${RUN}`;
const CMP_TITLE = `QA compare ${RUN}`;
const CMP_EMPTY = `QA nothing yet ${RUN}`;

type Baseline = { draft: unknown[] | null; globals: Record<string, unknown>; publication: string | null };

async function readBaseline(): Promise<Baseline> {
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: draft } = await sb.from("theme_versions").select("sections, theme_settings").eq("template_id", tpl!.id).eq("label", "working-draft").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  const ts = (draft?.theme_settings as Record<string, unknown> | null) ?? {};
  return { draft: (draft?.sections as unknown[]) ?? null, globals: (ts.globals as Record<string, unknown>) ?? {}, publication: pub?.published_version_id ?? null };
}
async function ownerHeaders() {
  const anonSb = createClient(SB_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anonSb.auth.signInWithPassword({ email: fx.staff.owner.email, password: fx.staff.owner.password });
  if (error || !data.session) throw error ?? new Error("owner sign-in failed");
  return { authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json", origin: APP };
}
async function restoreBaseline(b: Baseline) {
  const headers = await ownerHeaders();
  if (b.draft) {
    const r = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: b.draft, globals: b.globals }) });
    if (!r.ok) throw new Error(`draft restore failed: ${r.status} ${await r.text()}`);
  }
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }) });
    if (!r.ok) throw new Error(`publication restore failed: ${r.status} ${await r.text()}`);
  }
}

type Pages = { cart: string; compare: string; drawerish: string };
async function readPages(browser: Browser): Promise<Pages> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // fresh: empty cart and compare list
  const page = await ctx.newPage();
  await page.goto("/cart");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const cart = await page.locator("main").innerText();
  await page.goto("/compare");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const compare = await page.locator("main").innerText();
  await ctx.close();
  return { cart, compare, drawerish: "" };
}
async function expectPages(browser: Browser, check: (p: Pages) => boolean, label: string) {
  let last: Pages | null = null;
  for (let i = 0; i < 20; i++) {
    last = await readPages(browser);
    if (check(last)) return;
    await new Promise((r) => setTimeout(r, 4000));
  }
  expect(check(last!), `public pages: ${label}`).toBe(true);
}

test.describe.serial("Theme: cart & compare text draft → publish → rollback (isolated)", () => {
  test.setTimeout(300_000);
  let baseline: Baseline = { draft: null, globals: {}, publication: null };

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme cart compare");
    baseline = (await beginGuardedRun<Baseline>(GUARD, readBaseline, restoreBaseline)).baseline;
    expect(baseline.publication, "needs a published homepage theme (run p2b first or seed one)").toBeTruthy();
    const before = await readPages(browser);
    expect(before.cart).toContain("Your cart is empty");
    expect(before.cart).toContain("Browse the catalog");
    expect(before.compare).toContain("Compare laptops");
    expect(before.compare).toContain("Nothing to compare yet");
  });
  test.afterAll(async () => {
    await restoreBaseline(baseline);
    endGuardedRun(GUARD);
  });

  test("owner edits Cart & compare; draft private; publish live; rollback reverts", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-panel-cartCompare")).toBeEnabled();
    await page.getByTestId("theme-panel-cartCompare").click();
    await expect(page.getByTestId("theme-global-cartEmptyTitle")).toHaveAttribute("placeholder", "Your cart is empty");
    await expect(page.getByTestId("theme-global-pdpSpecHeading")).toHaveCount(0);
    await page.getByTestId("theme-global-cartTitle").fill(CART_TITLE);
    await page.getByTestId("theme-global-cartEmptyTitle").fill(CART_EMPTY);
    await page.getByTestId("theme-global-compareTitle").fill(CMP_TITLE);
    await page.getByTestId("theme-global-compareEmptyTitle").fill(CMP_EMPTY);
    await page.getByTestId("theme-global-compareEmptyHref").fill("javascript:alert(1)");
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByTestId("theme-error")).toContainText("Cart & compare");
    await page.getByTestId("theme-global-reset-compareEmptyHref").click();
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/Draft saved/i)).toBeVisible();

    const mid = await readPages(browser);
    expect(mid.cart).not.toContain(CART_EMPTY);
    expect(mid.compare).not.toContain(CMP_TITLE);

    await page.getByTestId("theme-publish").click();
    await expect(page.getByText(/Published\. Customers see this homepage/i)).toBeVisible({ timeout: 30_000 });
    await expectPages(
      browser,
      (p) => p.cart.includes(CART_TITLE) && p.cart.includes(CART_EMPTY) && p.compare.includes(CMP_TITLE) && p.compare.includes(CMP_EMPTY) && p.cart.includes("Browse the catalog"),
      "published",
    );

    const headers = await ownerHeaders();
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: baseline.publication }) });
    expect(r.status).toBe(200);
    await expectPages(
      browser,
      (p) => p.cart.includes("Your cart is empty") && !p.cart.includes(CART_EMPTY) && p.compare.includes("Compare laptops") && !p.compare.includes(CMP_TITLE),
      "restored",
    );
  });
});
