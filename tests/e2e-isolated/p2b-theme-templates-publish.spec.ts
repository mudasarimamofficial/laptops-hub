/**
 * Theme editor Phase 2b — page-template copy (product page, collection page, "not found" pages), ISOLATED stack.
 *
 * Owner edits the Product pages / Collection pages / Page not found panels in Online Store → saves a draft → public
 * pages unchanged → publishes → product page headings, related heading with {brand}, collection "no matches" text and
 * both 404 pages change → restoring the previous version brings the V5 text back. Draft and publication are restored
 * afterwards (crash-safe run guard).
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
const OUT = "docs/evidence/theme-templates";
const GUARD = "theme-templates-publish";
const RUN = Date.now().toString(36);
const PDP = `/products/${fx.products[0].handle}`;
const EMPTY = "/collections/all?price=u40";
const SPEC = `QA specs ${RUN}`;
const RELATED = `QA related {brand} ${RUN}`;
const NOMATCH = `QA no matches ${RUN}`;
const NF = `QA missing ${RUN}`;
const NFP = `QA product gone ${RUN}`;
const NFBTN = `QA browse ${RUN}`;
const SEARCHED = "dell";
const SEARCH_TITLE = `QA results ${RUN}`;

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

type Pages = { pdp: string; noMatch: string; nf: string; nfStatus: number; nfp: string; search: string };

async function readPages(browser: Browser, shots?: string): Promise<Pages> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(PDP);
  const pdp = await page.locator("main").innerText();
  if (shots) await page.locator("#pdp-specs").scrollIntoViewIfNeeded().then(() => page.screenshot({ path: `${OUT}/${shots}-pdp.png` }));
  await page.goto(EMPTY);
  const noMatch = await page.locator("main").innerText();
  if (shots) await page.screenshot({ path: `${OUT}/${shots}-collection.png` });
  const r = await page.goto(`/qa-missing-page-${RUN}`);
  const nf = await page.locator("main").innerText();
  if (shots) await page.screenshot({ path: `${OUT}/${shots}-404.png` });
  await page.goto(`/products/qa-missing-product-${RUN}`);
  const nfp = await page.locator("main").innerText();
  await page.goto(`/search?q=${SEARCHED}`);
  const search = await page.locator("h1").first().innerText();
  await ctx.close();
  return { pdp, noMatch, nf, nfStatus: r?.status() ?? 0, nfp, search };
}

async function expectPages(browser: Browser, check: (p: Pages) => boolean, label: string) {
  let last: Pages | null = null;
  for (let i = 0; i < 20; i++) {
    last = await readPages(browser);
    if (check(last)) {
      await readPages(browser, label);
      return;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  expect(check(last!), `public pages: ${label}`).toBe(true);
}

test.describe.serial("Theme templates: product / collection / 404 copy draft → publish → restore (isolated)", () => {
  test.setTimeout(300_000);
  let baseline: Baseline = { draft: null, globals: {}, publication: null };
  let before: Pages;
  let brand = "";

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme templates publish");
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
    before = await readPages(browser, "before");
    // Preconditions: V5 text present, the empty price band really shows "no matches", unmatched URL is a 404.
    expect(before.pdp).toContain("Specifications");
    expect(before.noMatch).toContain("No products match these filters");
    expect(before.nfStatus).toBe(404);
    expect(before.nf).toContain("This page doesn’t exist");
    expect(before.nfp).toContain("This product isn’t in the catalog");
    expect(before.search).toBe(`Results for “${SEARCHED}”`);
    brand = (before.pdp.match(/More from ([^\n]+)/) || [])[1]?.trim() ?? "";
    expect(brand.length).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    await restoreBaseline(baseline);
    endGuardedRun(GUARD);
  });

  test("owner edits template text in three panels; draft private; publish live; restore reverts", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-editor-grid")).toBeVisible();
    await expect(page.getByTestId("theme-panel-product")).toBeEnabled();

    await page.getByTestId("theme-panel-product").click();
    await expect(page.getByTestId("theme-global-pdpSpecHeading")).toHaveAttribute("placeholder", "Specifications");
    await expect(page.getByTestId("theme-global-footerTagline")).toHaveCount(0); // other panels' fields not shown
    await page.getByTestId("theme-global-pdpSpecHeading").fill(SPEC);
    await page.getByTestId("theme-global-pdpRelatedHeading").fill(RELATED);
    await page.screenshot({ path: `${OUT}/editor-product-panel.png` });

    await page.getByTestId("theme-panel-collection").click();
    await page.getByTestId("theme-global-colNoResultsHeading").fill(NOMATCH);
    await expect(page.getByTestId("theme-global-colSearchTitle")).toHaveAttribute("placeholder", "Results for");
    await page.getByTestId("theme-global-colSearchTitle").fill(SEARCH_TITLE);

    await page.getByTestId("theme-panel-notFound").click();
    await page.getByTestId("theme-global-nfTitle").fill(NF);
    await page.getByTestId("theme-global-nfProductTitle").fill(NFP);
    await page.getByTestId("theme-global-nfButton").fill(NFBTN);
    await page.getByTestId("theme-global-nfButtonHref").fill("javascript:alert(1)");
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByTestId("theme-error")).toContainText("Page not found → Button goes to");
    await page.getByTestId("theme-global-reset-nfButtonHref").click();
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/Draft saved/i)).toBeVisible();

    const mid = await readPages(browser);
    expect(mid.pdp).not.toContain(SPEC);
    expect(mid.noMatch).not.toContain(NOMATCH);
    expect(mid.nf).not.toContain(NF);
    expect(mid.search).toBe(`Results for “${SEARCHED}”`); // draft stays private

    await page.getByTestId("theme-publish").click();
    await expect(page.getByText(/Published\. Customers see this homepage/i)).toBeVisible({ timeout: 30_000 });
    await expectPages(
      browser,
      (p) =>
        p.pdp.includes(SPEC) &&
        p.pdp.includes(`QA related ${brand} ${RUN}`) &&
        !p.pdp.includes("{brand}") &&
        p.noMatch.includes(NOMATCH) &&
        p.nf.includes(NF) &&
        p.nf.includes(NFBTN) &&
        p.nfp.includes(NFP) &&
        p.search === `${SEARCH_TITLE} “${SEARCHED}”`,
      "published",
    );
    // Product facts untouched: the about/description and the price block still render.
    const after = await readPages(browser);
    expect(after.pdp).toContain("About this listing");
    expect(after.nfStatus).toBe(404);

    const headers = await ownerHeaders();
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: baseline.publication }) });
    expect(r.status).toBe(200);
    await expectPages(
      browser,
      (p) => p.pdp.includes("Specifications") && !p.pdp.includes(SPEC) && p.noMatch.includes("No products match these filters") && p.nf.includes("This page doesn’t exist") && p.search === `Results for “${SEARCHED}”`,
      "restored",
    );
  });
});
