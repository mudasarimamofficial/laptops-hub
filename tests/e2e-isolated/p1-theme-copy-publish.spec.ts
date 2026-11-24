/**
 * Merchant no-code copy editing, end to end, on the ISOLATED stack (local Supabase + `next start`, with NO theme env
 * flag set: publishing in the admin is the merchant's own switch).
 *
 * Owner signs in → Online Store → edits the hero heading, main button text and link and the brands heading → saves a
 * draft → the public homepage is unchanged → the staff draft preview shows the edits → publishes → the public homepage
 * shows them → restores the previous version → the public homepage is back. Also proves that a stale editor cannot
 * silently overwrite a newer draft (409 draft_conflict) and that unsafe links are refused on save.
 * The owner's draft and the live publication are restored afterwards (crash-safe run guard).
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
const OUT = "docs/evidence/theme-copy";
const GUARD = "theme-copy-publish";
const RUN = Date.now().toString(36);
const HERO_LINE = `QA hero ${RUN}`;
const CTA_LABEL = `QA shop ${RUN}`;
const BRANDS = `QA brands ${RUN}`;

type Baseline = { draft: unknown[] | null; publication: string | null };

async function readBaseline(): Promise<Baseline> {
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: draft } = await sb.from("theme_versions").select("sections").eq("template_id", tpl!.id).eq("label", "working-draft").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  return { draft: (draft?.sections as unknown[]) ?? null, publication: pub?.published_version_id ?? null };
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
    const r = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: b.draft }) });
    if (!r.ok) throw new Error(`draft restore failed: ${r.status} ${await r.text()}`);
  }
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }) });
    if (!r.ok) throw new Error(`publication restore failed: ${r.status} ${await r.text()}`);
  }
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

/** Public homepage as a logged-out visitor, polling past the 60 s theme cache only when a change is expected. */
async function publicHome(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/");
  const h1 = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
  const body = await page.locator("main").innerText();
  const primary = await page.locator("h1").first().locator("xpath=following::a[1]").getAttribute("href");
  return { ctx, page, h1, body, primary };
}

async function expectPublic(browser: Browser, check: (p: { h1: string; body: string; primary: string | null }) => boolean, label: string) {
  for (let i = 0; i < 20; i++) {
    const p = await publicHome(browser);
    const ok = check(p);
    if (ok || i === 19) {
      if (ok) await p.page.screenshot({ path: `${OUT}/public-${label}.png`, fullPage: false });
      await p.ctx.close();
      expect(ok, `public homepage: ${label}`).toBe(true);
      return;
    }
    await p.ctx.close();
    await new Promise((r) => setTimeout(r, 4000));
  }
}

test.describe.serial("Theme copy: edit → draft → preview → publish → rollback (isolated, no env flag)", () => {
  let baseline: Baseline = { draft: null, publication: null };
  let publicBefore = { h1: "", body: "" };
  let publishedId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme copy publish");
    fs.mkdirSync(OUT, { recursive: true });
    baseline = (await beginGuardedRun<Baseline>(GUARD, readBaseline, restoreBaseline)).baseline;
    if (!baseline.publication) {
      // Fresh stack: publish the current (unedited) layout once, so "restore the previous version" has a target.
      const headers = await ownerHeaders();
      const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
      const saved = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections }) });
      expect(saved.status).toBe(200);
      const pub = await fetch(`${APP}/api/admin/theme/homepage/publish`, { method: "POST", headers, body: JSON.stringify({ confirmPublish: true }) });
      expect(pub.status, await pub.clone().text()).toBe(200);
      baseline = await readBaseline();
      endGuardedRun(GUARD);
      baseline = (await beginGuardedRun<Baseline>(GUARD, async () => baseline, restoreBaseline)).baseline;
    }
    const p = await publicHome(browser);
    publicBefore = { h1: p.h1, body: p.body };
    await p.ctx.close();
    expect(publicBefore.h1).not.toContain("QA hero");
  });

  test.afterAll(async () => {
    await restoreBaseline(baseline);
    endGuardedRun(GUARD);
  });

  test("unsafe button links are refused on save", async () => {
    const headers = await ownerHeaders();
    const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
    const sections = (cur.sections as { type: string; settings: Record<string, unknown> }[]).map((s) =>
      s.type === "v5_cinematic_hero" ? { ...s, settings: { ...s.settings, primaryHref: "javascript:alert(1)" } } : s,
    );
    const r = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections }) });
    expect(r.status).toBe(400);
    expect((await r.json()).message).toMatch(/Main button link/);
  });

  test("owner edits copy, saves a draft; public is unchanged; preview shows the draft", async ({ page, browser }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-editor-grid")).toBeVisible();
    await page.getByTestId("theme-section-v5_cinematic_hero").click();
    const line1 = page.getByTestId("theme-field-headingLine1");
    await expect(line1).toHaveAttribute("placeholder", "The future of");
    await line1.fill(HERO_LINE);
    await page.getByTestId("theme-field-primaryLabel").fill(CTA_LABEL);
    await page.getByTestId("theme-field-primaryHref").fill("/collections/gen-10-plus");
    await page.getByTestId("theme-section-v5_brand_grid").click();
    await page.getByTestId("theme-field-heading").fill(BRANDS);
    await page.screenshot({ path: `${OUT}/editor-edited.png` });
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/Draft saved/i)).toBeVisible();

    // Public homepage unchanged by a draft.
    const p = await publicHome(browser);
    expect(p.h1).toBe(publicBefore.h1);
    expect(p.body).not.toContain(BRANDS);
    await p.ctx.close();

    // Staff draft preview renders the edits with the real storefront components.
    const prev = await page.request.get("/preview/homepage?v=draft");
    expect(prev.status()).toBe(200);
    const html = await prev.text();
    expect(html).toContain(HERO_LINE);
    expect(html).toContain(CTA_LABEL);
    expect(html).toContain(BRANDS);
  });

  test("a stale editor cannot silently overwrite a newer draft", async () => {
    const headers = await ownerHeaders();
    const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
    expect(typeof cur.draftFingerprint).toBe("string");
    const stale = cur.draftFingerprint as string;
    // Someone else saves (same content plus a change) → fingerprint moves on.
    const other = (cur.sections as { type: string; settings: Record<string, unknown> }[]).map((s) =>
      s.type === "v5_spec_filters" ? { ...s, settings: { ...s.settings, heading: `QA other ${RUN}` } } : s,
    );
    const r1 = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: other, baseFingerprint: stale }) });
    expect(r1.status).toBe(200);
    // The first editor, still holding the old fingerprint, is refused…
    const r2 = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections, baseFingerprint: stale }) });
    expect(r2.status).toBe(409);
    expect((await r2.json()).error).toBe("draft_conflict");
    // …unless it explicitly chooses to overwrite (which also undoes the "other" change for the next test).
    const r3 = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections, baseFingerprint: stale, overwrite: true }) });
    expect(r3.status).toBe(200);
  });

  test("publish makes the edits live; restoring the previous version brings the old homepage back", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page);
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-editor-grid")).toBeVisible();
    await page.getByTestId("theme-publish").click();
    await expect(page.getByText(/Published\. Customers see this homepage/i)).toBeVisible({ timeout: 30_000 });
    const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").single();
    publishedId = pub!.published_version_id;
    expect(publishedId).not.toBe(baseline.publication);

    await expectPublic(
      browser,
      (p) => p.h1.includes(HERO_LINE) && p.body.includes(CTA_LABEL) && p.body.includes(BRANDS) && p.primary === "/collections/gen-10-plus",
      "published",
    );

    if (baseline.publication) {
      const headers = await ownerHeaders();
      const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: baseline.publication }) });
      expect(r.status).toBe(200);
      await expectPublic(browser, (p) => p.h1 === publicBefore.h1 && !p.body.includes(BRANDS), "rolled-back");
    } else {
      test.info().annotations.push({ type: "note", description: "No earlier publication on this stack: rollback is exercised by p1-theme-ordering-preview." });
    }
  });
});
