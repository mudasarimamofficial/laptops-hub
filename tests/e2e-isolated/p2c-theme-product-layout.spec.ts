/**
 * Theme editor Phase 2c — product page layout (section order/visibility, key specs, policy links, related count),
 * ISOLATED stack.
 *
 * Owner changes the Product page layout panel in Online Store → saves a draft → the public product page is unchanged
 * while the staff-only product preview shows the draft → anonymous visitors get 404 on the preview → publish → the
 * public product page follows the new layout (buy box still there) → restoring the previous version brings the V5
 * layout back. Draft and publication are restored afterwards (crash-safe run guard).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { beginGuardedRun, endGuardedRun } from "./helpers/run-guard";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const APP = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
const OUT = "docs/evidence/theme-product-layout";
const GUARD = "theme-product-layout";
const HANDLE = fx.products[0].handle as string;
const PDP = `/products/${HANDLE}`;

type Baseline = {
  draft: unknown[] | null;
  globals: Record<string, unknown>;
  layout: Record<string, unknown>;
  publication: string | null;
};

async function readBaseline(): Promise<Baseline> {
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: draft } = await sb.from("theme_versions").select("sections, theme_settings").eq("template_id", tpl!.id).eq("label", "working-draft").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  const ts = (draft?.theme_settings as Record<string, unknown> | null) ?? {};
  return {
    draft: (draft?.sections as unknown[]) ?? null,
    globals: (ts.globals as Record<string, unknown>) ?? {},
    layout: (ts.layout as Record<string, unknown>) ?? {},
    publication: pub?.published_version_id ?? null,
  };
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
    const r = await fetch(`${APP}/api/admin/theme/homepage`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ sections: b.draft, globals: b.globals, layout: b.layout, overwrite: true }),
    });
    if (!r.ok) throw new Error(`draft restore failed: ${r.status} ${await r.text()}`);
  }
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }),
    });
    if (!r.ok) throw new Error(`publication restore failed: ${r.status} ${await r.text()}`);
  }
}

type Shape = { order: string[]; keySpecs: boolean; policies: boolean; related: number; buy: boolean; status: number };

async function shapeOf(page: Page, url: string): Promise<Shape> {
  const r = await page.goto(url);
  const shape = await page.evaluate(() => ({
    order: Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="pdp-section-"]')).map((e) => e.dataset.testid!.slice(12)),
    keySpecs: !!document.querySelector('[data-testid="pdp-key-specs"]'),
    policies: !!document.querySelector('[data-testid="pdp-policies"]'),
    related: document.querySelectorAll('[data-testid="pdp-section-related"] .v5-card-grid > *').length,
    // Buy box: the order button (or the sold-out notice) is always there, whatever the layout.
    buy: !!document.querySelector('[data-testid="pdp-primary-cta"], [data-testid="pdp-sold-out"]'),
  }));
  return { ...shape, status: r?.status() ?? 0 };
}

async function publicShape(browser: Browser, shot?: string): Promise<Shape> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const s = await shapeOf(page, PDP);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  await ctx.close();
  return s;
}

async function expectPublic(browser: Browser, check: (s: Shape) => boolean, label: string) {
  let last: Shape | null = null;
  for (let i = 0; i < 20; i++) {
    last = await publicShape(browser);
    if (check(last)) {
      await publicShape(browser, label);
      return last;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`public product page never reached "${label}": ${JSON.stringify(last)}`);
}

test.describe.serial("Theme: product page layout draft → preview → publish → restore (isolated)", () => {
  test.setTimeout(300_000);
  let baseline: Baseline = { draft: null, globals: {}, layout: {}, publication: null };
  let before: Shape;

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme product layout");
    fs.mkdirSync(OUT, { recursive: true });
    baseline = (await beginGuardedRun<Baseline>(GUARD, readBaseline, restoreBaseline)).baseline;
    if (!baseline.publication) {
      const headers = await ownerHeaders();
      const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
      expect((await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections }) })).status).toBe(200);
      const pub = await fetch(`${APP}/api/admin/theme/homepage/publish`, { method: "POST", headers, body: JSON.stringify({ confirmPublish: true }) });
      expect(pub.status, await pub.clone().text()).toBe(200);
      baseline = await readBaseline();
      endGuardedRun(GUARD);
      baseline = (await beginGuardedRun<Baseline>(GUARD, async () => baseline, restoreBaseline)).baseline;
    }
    before = await publicShape(browser, "before-public");
    // Preconditions: V5 order (reviews section always renders its block; related only with similar listings).
    expect(before.status).toBe(200);
    expect(before.buy).toBe(true);
    expect(before.keySpecs).toBe(true);
    expect(before.order.slice(0, 2)).toEqual(["details", "reviews"]);
  });

  test.afterAll(async () => {
    await restoreBaseline(baseline);
    endGuardedRun(GUARD);
  });

  test("API rejects a tampered layout", async () => {
    const headers = await ownerHeaders();
    const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
    const r = await fetch(`${APP}/api/admin/theme/homepage`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ sections: cur.sections, layout: { product: { relatedCount: 999, sections: [{ id: "checkout" }] } }, baseFingerprint: cur.draftFingerprint }),
    });
    expect(r.status).toBe(400);
    const anon = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers: { "content-type": "application/json", origin: APP }, body: "{}" });
    expect([401, 403]).toContain(anon.status);
  });

  test("owner reorders/hides product sections; draft private; preview shows it; publish live; restore reverts", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-editor-grid")).toBeVisible();
    await expect(page.getByTestId("theme-panel-layout-product")).toBeEnabled();

    await page.getByTestId("theme-panel-layout-product").click();
    await expect(page.getByTestId("theme-layout-product-sections")).toBeVisible();
    // Related → top, reviews hidden, key specs + policy links off, 8 related.
    await page.getByTestId("theme-layout-up-related").click();
    await page.getByTestId("theme-layout-up-related").click();
    await page.getByTestId("theme-layout-visible-reviews").uncheck();
    await page.getByTestId("theme-layout-keyspecs").uncheck();
    await page.getByTestId("theme-layout-policies").uncheck();
    await page.getByTestId("theme-layout-related-count").selectOption("8");
    await expect(page.getByTestId("theme-save-draft")).toHaveText(/Save draft \*/);
    // The editor preview follows the selected template: a real product page.
    await page.screenshot({ path: `${OUT}/editor-product-layout-panel.png` });

    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByTestId("theme-save-draft")).toHaveText("Save draft");
    await expect(page.getByTestId("theme-preview-frame")).toHaveAttribute("src", /\/preview\/product\?v=draft/);

    // Draft is private: the public page keeps the V5 layout.
    const afterDraft = await publicShape(browser);
    expect(afterDraft.order).toEqual(before.order);
    expect(afterDraft.keySpecs).toBe(true);

    // Staff preview shows the draft on a representative product.
    const preview = await shapeOf(page, "/preview/product?v=draft");
    expect(preview.status).toBe(200);
    expect(page.url()).toMatch(/\/preview\/product\/[^/?]+\?v=draft/);
    await expect(page.getByTestId("product-preview-shown")).toHaveText("the saved draft");
    expect(preview.order).not.toContain("reviews");
    if (preview.order.includes("related")) expect(preview.order).toEqual(["related", "details"]);
    else expect(preview.order).toEqual(["details"]);
    expect(preview.keySpecs).toBe(false);
    expect(preview.policies).toBe(false);
    expect(preview.buy).toBe(true);
    await page.screenshot({ path: `${OUT}/preview-draft.png`, fullPage: true });
    // Published/default modes of the same preview still show the V5 layout.
    const prevPublished = await shapeOf(page, `/preview/product/${HANDLE}?v=published`);
    expect(prevPublished.order).toEqual(before.order);

    // Anonymous visitors never see previews.
    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    expect((await anon.goto("/preview/product?v=draft"))?.status()).toBe(404);
    expect((await anon.goto(`/preview/product/${HANDLE}?v=draft`))?.status()).toBe(404);
    await anonCtx.close();

    // Publish from the editor.
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-publish")).toBeEnabled();
    await page.getByTestId("theme-publish").click();
    await expect(page.getByText(/Published|published/).first()).toBeVisible({ timeout: 30_000 });

    const live = await expectPublic(browser, (s) => !s.order.includes("reviews") && !s.keySpecs, "after-publish-public");
    expect(live.buy, "buy box always renders").toBe(true);
    expect(live.policies).toBe(false);
    if (live.order.includes("related")) {
      expect(live.order[0]).toBe("related");
      expect(live.related).toBeGreaterThanOrEqual(before.related);
      expect(live.related).toBeLessThanOrEqual(8);
    }

    // Restore the previous publication → V5 layout back.
    await restoreBaseline(baseline);
    const back = await expectPublic(browser, (s) => s.keySpecs && s.order.includes("reviews"), "after-restore-public");
    expect(back.order).toEqual(before.order);
    expect(back.policies).toBe(before.policies);
  });
});
