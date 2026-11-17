/**
 * Theme editor: real section ordering, hide/show, the staff-only full homepage preview, publish, rollback and
 * public/draft isolation — on the ISOLATED stack (local Supabase, `next start` with THEME_PUBLISHED_ENABLED=1).
 * The owner's draft and the live publication are restored afterwards.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { normalizeHomepageLayout } from "../../src/lib/content/homepage-layout";
import { beginGuardedRun, endGuardedRun } from "./helpers/run-guard";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "docs/evidence/theme";
const MAP_HEADING = `QA map heading ${Date.now().toString(36)}`;

/** Kicker labels of reorderable sections, used to read the rendered order of the page. */
const KICKERS = ["CHROMEBOOKS", "BRANDS", "FEATURED", "FEATURED CONFIGURATION", "SPECIFICATIONS", "NEWER GENERATIONS", "BUDGET", "COMPARE", "NEED HELP CHOOSING?"];

async function signIn(page: Page, role: "owner" | "manager" | "fulfillment" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

/** The order in which the section kickers appear in the document (only those rendered). */
async function renderedOrder(page: Page) {
  return page.evaluate((labels) => {
    const found: { label: string; el: Element }[] = [];
    for (const label of labels) {
      const el = [...document.querySelectorAll("main span, main p, main div")].find((e) => e.childElementCount <= 1 && e.textContent?.trim() === label);
      if (el) found.push({ label, el });
    }
    return found.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map((f) => f.label);
  }, KICKERS);
}

const GUARD = "theme-ordering-preview";
const APP = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
type Baseline = { draft: unknown[] | null; publication: string | null };

async function readBaseline(): Promise<Baseline> {
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: draft } = await sb.from("theme_versions").select("sections").eq("template_id", tpl!.id).eq("label", "working-draft").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  return { draft: (draft?.sections as unknown[]) ?? null, publication: pub?.published_version_id ?? null };
}

/** Puts the draft and the publication back through the real admin API (owner bearer token; survives a dead browser). */
async function restoreBaseline(b: Baseline) {
  const anonSb = createClient(SB_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anonSb.auth.signInWithPassword({ email: fx.staff.owner.email, password: fx.staff.owner.password });
  if (error || !data.session) throw error ?? new Error("owner sign-in failed");
  const headers = { authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json", origin: APP };
  if (b.draft) {
    const r = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: b.draft }) });
    if (!r.ok) throw new Error(`draft restore failed: ${r.status} ${await r.text()}`);
  }
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }) });
    if (!r.ok) throw new Error(`publication restore failed: ${r.status} ${await r.text()}`);
  }
}

async function anon(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe.serial("Theme ordering + full preview (isolated)", () => {
  let savedDraft: unknown[] | null = null;
  let baselinePublication: string | null = null;
  let publicBefore: string[] = [];

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme ordering + preview");
    fs.mkdirSync(OUT, { recursive: true });
    const g = await beginGuardedRun<Baseline>(GUARD, readBaseline, restoreBaseline);
    savedDraft = g.baseline.draft;
    baselinePublication = g.baseline.publication;
    // Explicit baseline: no synthetic map heading from an earlier run is in the draft or on the public page.
    expect(JSON.stringify(savedDraft ?? [])).not.toContain("QA map heading");
    const a = await anon(browser);
    await a.page.goto("/");
    publicBefore = await renderedOrder(a.page);
    await a.ctx.close();
    expect(publicBefore).toContain("BRANDS");
    expect(publicBefore.indexOf("FEATURED")).toBeLessThan(publicBefore.indexOf("FEATURED CONFIGURATION"));
  });

  test.afterAll(async () => {
    await restoreBaseline({ draft: savedDraft, publication: baselinePublication });
    endGuardedRun(GUARD);
  });

  test("preview is private: 404, noindex and no-store for visitors and non-theme staff", async ({ browser }) => {
    const a = await anon(browser);
    for (const v of ["draft", "published", "default"]) {
      const res = await a.page.request.get(`/preview/homepage?v=${v}`, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
      expect(res.headers()["cache-control"]).toMatch(/no-store/);
      expect(res.headers()["x-robots-tag"]).toMatch(/noindex/);
      expect(await res.text()).not.toMatch(/Draft preview only/i);
    }
    await a.ctx.close();
    for (const role of ["fulfillment", "manager"] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await signIn(page, role);
      const res = await page.request.get("/preview/homepage?v=draft");
      expect(res.status(), role).toBe(404);
      await ctx.close();
    }
  });

  test("invalid placements are refused by the API", async ({ page }) => {
    await signIn(page, "owner");
    const cur = await (await page.request.get("/api/admin/theme/homepage")).json();
    const sections = cur.sections as { type: string }[];
    const mapFirst = [sections[sections.length - 1], ...sections.slice(0, -1)];
    const r1 = await page.request.put("/api/admin/theme/homepage", { data: { sections: mapFirst } });
    expect(r1.status()).toBe(400);
    expect((await r1.json()).message).toMatch(/last/i);
    const heroLater = [sections[1], sections[0], ...sections.slice(2)];
    const r2 = await page.request.put("/api/admin/theme/homepage", { data: { sections: heroLater } });
    expect(r2.status()).toBe(400);
    expect((await r2.json()).message).toMatch(/first/i);
    const dup = [...sections.slice(0, -1), { ...sections[2], id: "dup" }, sections[sections.length - 1]];
    const r3 = await page.request.put("/api/admin/theme/homepage", { data: { sections: dup } });
    expect(r3.status()).toBe(400);
  });

  test("reorder + hide + edit → save → reload → preview → publish → public → rollback", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "owner");
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-live-state")).toContainText(/Published themes are on/i);
    const list = page.getByTestId("theme-section-list");
    await expect(list.locator("li")).toHaveCount(13);
    await expect(list.locator("li").first()).toHaveAttribute("data-testid", "theme-section-v5_cinematic_hero");
    await expect(list.locator("li").last()).toHaveAttribute("data-testid", "theme-section-v5_store_map");
    // Fixed sections have no move controls; nothing can move above the hero.
    await expect(page.getByTestId("theme-move-up-v5_cinematic_hero")).toHaveCount(0);
    await expect(page.getByTestId("theme-move-down-v5_store_map")).toHaveCount(0);
    await expect(page.getByTestId("theme-move-up-v5_product_story")).toBeDisabled();
    await expect(page.getByTestId("theme-move-down-v5_home_inquiry")).toBeDisabled();

    // Keyboard: move Promo ("FEATURED CONFIGURATION") above Featured; focus stays on the control.
    const up = page.getByTestId("theme-move-up-v5_promo");
    await up.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("theme-move-up-v5_promo")).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: /moved to position/i })).toHaveText(/Promo moved to position 5 of 13/);
    const order = await list.locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(order.indexOf("theme-section-v5_promo")).toBeLessThan(order.indexOf("theme-section-v5_featured_products"));

    // Hide Brands; change the map heading.
    await page.getByTestId("theme-section-v5_brand_grid").getByRole("button").first().click();
    await page.getByTestId("theme-section-enabled").uncheck();
    await expect(page.getByTestId("theme-section-v5_brand_grid")).toHaveAttribute("data-enabled", "false");
    await page.getByTestId("theme-section-v5_store_map").getByRole("button").first().click();
    await page.getByTestId("theme-field-heading").fill(MAP_HEADING);
    await expect(page.getByTestId("theme-frame-note")).toContainText(/unsaved/i);
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/draft saved/i)).toBeVisible();

    // Reload: order, visibility and settings persisted.
    await page.reload();
    await expect(list.locator("li")).toHaveCount(13);
    const order2 = await list.locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(order2).toEqual(order);
    await expect(page.getByTestId("theme-section-v5_brand_grid")).toHaveAttribute("data-enabled", "false");

    // Embedded preview frame renders the saved draft with the real storefront.
    const frame = page.frameLocator('[data-testid="theme-preview-frame"]');
    await expect(frame.getByTestId("store-map")).toContainText(MAP_HEADING, { timeout: 30_000 });
    await expect(frame.getByTestId("homepage-preview-bar")).toHaveCount(0);
    await page.screenshot({ path: `${OUT}/editor-desktop.png` });

    // Full preview in a new tab: real header + footer, draft order, hidden section absent, map after the footer.
    const popupP = page.waitForEvent("popup");
    await page.getByTestId("theme-open-preview").click();
    const preview = await popupP;
    await preview.waitForLoadState("domcontentloaded");
    await expect(preview.getByText(/draft preview only/i)).toBeVisible();
    await expect(preview.locator("header").first()).toBeVisible();
    await preview.screenshot({ path: `${OUT}/preview-draft-desktop.png` });
    await expect(preview.locator("footer").first()).toBeVisible();
    const draftOrder = await renderedOrder(preview);
    expect(draftOrder).not.toContain("BRANDS");
    expect(draftOrder.indexOf("FEATURED CONFIGURATION")).toBeLessThan(draftOrder.indexOf("FEATURED"));
    await expect(preview.getByTestId("store-map")).toContainText(MAP_HEADING);
    expect(await preview.getByTestId("store-map").evaluate((m) => !!document.querySelector("footer") && (document.querySelector("footer")!.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) > 0)).toBe(true);
    // Compare with the published version and the default, then browser Back returns to the draft.
    await preview.getByTestId("homepage-preview-mode-default").click();
    await expect(preview).toHaveURL(/v=default/);
    await expect(preview.getByTestId("homepage-preview-shown")).toContainText(/V5 default/i);
    expect(await renderedOrder(preview)).toContain("BRANDS");
    await preview.getByTestId("homepage-preview-mode-published").click();
    await expect(preview).toHaveURL(/v=published/);
    await expect(preview.getByTestId("store-map")).not.toContainText(MAP_HEADING);
    await preview.goBack();
    await preview.goBack();
    await expect(preview).toHaveURL(/v=draft/);
    await expect(preview.getByTestId("store-map")).toContainText(MAP_HEADING);
    // Phone width: no horizontal overflow.
    await preview.setViewportSize({ width: 390, height: 844 });
    expect(await preview.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await preview.screenshot({ path: `${OUT}/preview-draft-phone.png` });
    await preview.getByTestId("homepage-preview-back").click();
    await expect(preview).toHaveURL(/\/admin\/online-store$/);
    await preview.close();

    // The public homepage is unchanged by the draft.
    const a1 = await anon(browser);
    await a1.page.goto("/");
    expect(await renderedOrder(a1.page)).toEqual(publicBefore);
    await expect(a1.page.getByTestId("store-map")).not.toContainText(MAP_HEADING);
    await a1.ctx.close();

    // Publish → the public homepage follows the new order/visibility/settings right away (cache invalidated).
    await page.getByTestId("theme-publish").click();
    await expect(page.getByTestId("theme-notice")).toContainText(/Published immutable snapshot/i);
    const a2 = await anon(browser);
    await a2.page.goto("/");
    const live = await renderedOrder(a2.page);
    expect(live).not.toContain("BRANDS");
    expect(live.indexOf("FEATURED CONFIGURATION")).toBeLessThan(live.indexOf("FEATURED"));
    await expect(a2.page.getByTestId("store-map")).toContainText(MAP_HEADING);
    await a2.ctx.close();
    const { data: audit } = await sb.from("audit_logs").select("action").eq("action", "theme.homepage.publish").order("created_at", { ascending: false }).limit(1);
    expect(audit?.length).toBe(1);

    // Rollback to the baseline publication restores the previous order.
    if (baselinePublication) {
      await page.goto("/admin/online-store");
      await page.getByTestId(`theme-rollback-${baselinePublication}`).click();
      await expect(page.getByTestId("theme-notice")).toContainText(/[Rr]oll/i);
      const a3 = await anon(browser);
      await a3.page.goto("/");
      expect(await renderedOrder(a3.page)).toEqual(publicBefore);
      await expect(a3.page.getByTestId("store-map")).not.toContainText(MAP_HEADING);
      await a3.ctx.close();
    }
  });

  test("reduced motion: previewed map is a plain section", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await signIn(page, "owner");
    await page.goto("/preview/homepage?v=draft");
    await expect(page.getByText(/draft preview only/i)).toBeVisible();
    expect(await page.getByTestId("store-map").evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
    await ctx.close();
  });

  // The current V5 default layout, saved and published as a theme, renders exactly like the built-in default.
  test("publishing the default layout changes nothing visible", async ({ page, browser }) => {
    await signIn(page, "owner");
    const fresh = await (await page.request.get("/api/admin/theme/homepage")).json();
    expect(fresh.publishedThemesEnabled).toBe(true);
    const r = await page.request.put("/api/admin/theme/homepage", { data: { sections: normalizeHomepageLayout(null) } });
    expect(r.status(), await r.text()).toBe(200);
    const p = await page.request.post("/api/admin/theme/homepage/publish", { data: { confirmPublish: true } });
    expect(p.status(), await p.text()).toBe(200);
    // Main content + after-footer map, with React's generated ids blanked (they depend on tree position only).
    const body = (html: string) =>
      (html.match(/<main id="main"[\s\S]*<\/main>[\s\S]*?(?=<script)/)?.[0] ?? "").replace(/_R_[A-Za-z0-9]+_/g, "_R_");
    const a = await anon(browser);
    const live = body(await (await a.page.request.get("/")).text());
    await a.ctx.close();
    const ref = body(await (await page.request.get("/preview/homepage?v=default&embed=1")).text());
    expect(live.length).toBeGreaterThan(10_000);
    expect(live).toBe(ref);
  });
});
