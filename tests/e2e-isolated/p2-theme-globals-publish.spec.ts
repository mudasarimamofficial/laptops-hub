/**
 * Theme editor Phase 2 — site-wide header/footer copy, on the ISOLATED stack (local Supabase + `next start`).
 *
 * Owner edits "Header & footer" text in Online Store → saves a draft → public pages unchanged → publishes → every
 * public page (not only the homepage) shows the new header/footer text → restoring the previous version brings the
 * old text back. Also: unsafe links refused; a save from an older client (no `globals`) keeps the stored text (the
 * draft RPC replaces theme_settings wholesale); the Settings "SEO title suffix" drives page titles.
 * Draft, publication and seo_defaults are restored afterwards (crash-safe run guard).
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
const OUT = "docs/evidence/theme-globals";
const GUARD = "theme-globals-publish";
const RUN = Date.now().toString(36);
const TAGLINE = `QA tagline ${RUN}`;
const WA = `QA WhatsApp ${RUN}`;
const SEARCH = `QA search ${RUN}`;
const SECOND = `QA second ${RUN}`;
const PAGE = "/collections/all";

type Baseline = { draft: unknown[] | null; globals: Record<string, unknown>; publication: string | null; seo: unknown };

async function readBaseline(): Promise<Baseline> {
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: draft } = await sb.from("theme_versions").select("sections, theme_settings").eq("template_id", tpl!.id).eq("label", "working-draft").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  const { data: seo } = await sb.from("store_settings").select("value").eq("key", "seo_defaults").maybeSingle();
  const ts = (draft?.theme_settings as Record<string, unknown> | null) ?? {};
  return {
    draft: (draft?.sections as unknown[]) ?? null,
    globals: (ts.globals as Record<string, unknown>) ?? {},
    publication: pub?.published_version_id ?? null,
    seo: seo?.value ?? null,
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
    const r = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: b.draft, globals: b.globals }) });
    if (!r.ok) throw new Error(`draft restore failed: ${r.status} ${await r.text()}`);
  }
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }) });
    if (!r.ok) throw new Error(`publication restore failed: ${r.status} ${await r.text()}`);
  }
  const suffix = (b.seo as { title_suffix?: string } | null)?.title_suffix ?? "";
  const r = await fetch(`${APP}/api/admin/store-settings`, { method: "PUT", headers, body: JSON.stringify({ seoTitleSuffix: suffix }) });
  if (!r.ok) throw new Error(`seo restore failed: ${r.status}`);
}

type Chrome = { tagline: string; contactHeading: string; wa: string | null; search: string | null; title: string };

/** Public chrome as a logged-out visitor on a non-home page. */
async function publicChrome(browser: Browser, shot?: string): Promise<Chrome> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(PAGE);
  const footer = page.getByTestId("site-footer");
  const out: Chrome = {
    tagline: (await footer.locator("p").first().innerText()).trim(),
    contactHeading: (await page.getByTestId("footer-contact").locator("span").first().innerText()).trim(),
    wa: (await page.getByTestId("footer-whatsapp").count()) ? (await page.getByTestId("footer-whatsapp").innerText()).trim() : null,
    search: await page.locator("header button.v5-hov-search").first().getAttribute("aria-label"),
    title: await page.title(),
  };
  if (shot) {
    await footer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${shot}.png` });
  }
  await ctx.close();
  return out;
}

async function expectChrome(browser: Browser, check: (c: Chrome) => boolean, label: string) {
  let last: Chrome | null = null;
  for (let i = 0; i < 20; i++) {
    last = await publicChrome(browser);
    if (check(last)) {
      await publicChrome(browser, `public-${label}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  expect(check(last!), `public chrome: ${label} — got ${JSON.stringify(last)}`).toBe(true);
}

test.describe.serial("Theme globals: header/footer copy draft → publish → restore (isolated)", () => {
  test.setTimeout(300_000);
  let baseline: Baseline = { draft: null, globals: {}, publication: null, seo: null };
  let before: Chrome;

  test.beforeAll(async ({ browser }) => {
    await assertLocalOnly("theme globals publish");
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
    before = await publicChrome(browser, "public-before");
    expect(before.tagline).not.toContain("QA tagline");
  });

  test.afterAll(async () => {
    await restoreBaseline(baseline);
    endGuardedRun(GUARD);
  });

  test("unsafe links are refused; a save without globals keeps the stored header/footer text", async () => {
    const headers = await ownerHeaders();
    const cur = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
    const bad = await fetch(`${APP}/api/admin/theme/homepage`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ sections: cur.sections, globals: { announcementHref: "javascript:alert(1)" } }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toMatch(/Header & footer → Promotion bar link/);

    const withG = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections, globals: { footerContactHeading: `QA keep ${RUN}`, junk: "x" } }) });
    expect(withG.status).toBe(200);
    // Older client: sections only.
    const noG = await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections }) });
    expect(noG.status).toBe(200);
    const after = await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json();
    expect(after.globals).toEqual({ footerContactHeading: `QA keep ${RUN}` });
    // Clear again (empty globals removes the key).
    expect((await fetch(`${APP}/api/admin/theme/homepage`, { method: "PUT", headers, body: JSON.stringify({ sections: cur.sections, globals: {} }) })).status).toBe(200);
    expect((await (await fetch(`${APP}/api/admin/theme/homepage`, { headers })).json()).globals).toEqual({});
  });

  test("owner edits header & footer text; draft does not change public pages; publish does; restore reverts", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/online-store");
    await expect(page.getByTestId("theme-editor-grid")).toBeVisible();
    await page.getByTestId("theme-globals").click();
    await expect(page.getByTestId("theme-global-footerTagline")).toHaveAttribute("placeholder", /^Used Dell, HP and Lenovo laptops/);
    await page.getByTestId("theme-global-footerTagline").fill(TAGLINE);
    await page.getByTestId("theme-global-footerWhatsappLabel").fill(WA);
    await page.getByTestId("theme-global-searchLabel").fill(SEARCH);
    await page.getByTestId("theme-global-menuSecondLabel").fill(SECOND);
    await page.getByTestId("theme-global-menuSecondHref").fill("not a link");
    await expect(page.getByTestId("theme-global-menuSecondHref")).toHaveAttribute("aria-invalid", "true");
    await page.getByTestId("theme-global-reset-menuSecondHref").click();
    await expect(page.getByTestId("theme-global-menuSecondHref")).toHaveValue("");
    await page.screenshot({ path: `${OUT}/editor-globals.png` });
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/Draft saved/i)).toBeVisible();

    // Reload: the draft text survives.
    await page.reload();
    await page.getByTestId("theme-globals").click();
    await expect(page.getByTestId("theme-global-footerTagline")).toHaveValue(TAGLINE);

    // Draft only → public unchanged.
    const mid = await publicChrome(browser);
    expect(mid.tagline).toBe(before.tagline);
    expect(mid.search).toBe(before.search);

    await page.getByTestId("theme-publish").click();
    await expect(page.getByText(/Published\. Customers see this homepage/i)).toBeVisible({ timeout: 30_000 });
    await expectChrome(browser, (c) => c.tagline === TAGLINE && c.wa === WA && c.search === SEARCH, "published");

    // Mega menu second link (desktop) uses the new label and the default href.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pg = await ctx.newPage();
    await pg.goto(PAGE);
    await pg.locator('button[aria-controls="lh-mega-menu"]').click();
    await expect(pg.locator("#lh-mega-menu").getByRole("link", { name: `${SECOND} →` })).toHaveAttribute("href", "/collections/chromebooks");
    await ctx.close();

    const headers = await ownerHeaders();
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, { method: "POST", headers, body: JSON.stringify({ confirmRollback: true, targetVersionId: baseline.publication }) });
    expect(r.status).toBe(200);
    await expectChrome(browser, (c) => c.tagline === before.tagline && c.search === before.search, "restored");
  });

  test("Settings → SEO title suffix drives page titles; empty keeps the V5 template", async ({ browser }) => {
    const headers = await ownerHeaders();
    const r = await fetch(`${APP}/api/admin/store-settings`, { method: "PUT", headers, body: JSON.stringify({ seoTitleSuffix: `| QA Store ${RUN}` }) });
    expect(r.status).toBe(200);
    await expectChrome(browser, (c) => c.title.endsWith(` | QA Store ${RUN}`), "seo-suffix");
    const r2 = await fetch(`${APP}/api/admin/store-settings`, { method: "PUT", headers, body: JSON.stringify({ seoTitleSuffix: "" }) });
    expect(r2.status).toBe(200);
    await expectChrome(browser, (c) => c.title.endsWith(" · Laptops HUB") || c.title === "Laptops HUB", "seo-default");
  });
});
