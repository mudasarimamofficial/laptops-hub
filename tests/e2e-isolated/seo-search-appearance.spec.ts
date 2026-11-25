/**
 * Search appearance on the ISOLATED stack (local Supabase only):
 *  1. Homepage: brand + city title, canonical, Open Graph/Twitter, business + WebSite JSON-LD from Contact & Social
 *     (no SearchAction, ratings or hours), heading text with word boundaries.
 *  2. /compare is noindex and not in the sitemap; the sitemap lists canonical public URLs.
 *  3. Admin → SEO: the owner edits the homepage search title/description → the public homepage uses them → reset
 *     restores the default. Merchant text is escaped. An editor cannot change it (UI and API).
 *  4. A guide's Admin → Blog search fields reach its metadata and Article JSON-LD.
 *  5. Collections have their own description and og:url.
 * QA rows are removed and seo_defaults is restored afterwards.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { DEFAULT_HOME_DESCRIPTION, DEFAULT_HOME_TITLE } from "../../src/lib/content/seo-defaults";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ORIGIN = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001").origin;
const RUN = Date.now().toString(36);
const GUIDE = `qa-seo-guide-${RUN}`;

async function signIn(page: Page, role: "owner" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

/** Server HTML as a crawler receives it (no JavaScript). */
async function html(request: APIRequestContext, path: string) {
  const r = await request.get(path, { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } });
  expect(r.status(), path).toBe(200);
  return r.text();
}
const meta = (s: string, attr: "name" | "property", key: string) =>
  s.match(new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)"`))?.[1] ?? null;
const titleOf = (s: string) => s.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
const canonicalOf = (s: string) => s.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
function jsonLd(s: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const d = JSON.parse(m[1]);
    for (const n of Array.isArray(d) ? d : d["@graph"] ? d["@graph"] : [d]) out.push(n);
  }
  return out;
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

test.describe.serial("SEO search appearance (isolated)", () => {
  test.setTimeout(120_000);
  let seoRow: { value: unknown } | null = null;

  test.beforeAll(async () => {
    await assertLocalOnly("seo search appearance");
    const { data } = await sb.from("store_settings").select("value").eq("key", "seo_defaults").maybeSingle();
    seoRow = data ?? null;
  });

  test.afterAll(async () => {
    await sb.from("articles").delete().eq("slug", GUIDE);
    if (seoRow) await sb.from("store_settings").update({ value: seoRow.value }).eq("key", "seo_defaults");
    else await sb.from("store_settings").delete().eq("key", "seo_defaults");
  });

  test("homepage: title, canonical, social tags, business JSON-LD, readable heading", async ({ request }) => {
    const s = await html(request, "/");
    expect(decode(titleOf(s) || "")).toBe(DEFAULT_HOME_TITLE);
    expect([ORIGIN, `${ORIGIN}/`]).toContain(canonicalOf(s)); // the root URL, with or without the slash
    expect(meta(s, "name", "robots")).toBe("index, follow");
    expect(meta(s, "property", "og:site_name")).toBe("Laptops HUB");
    expect([ORIGIN, `${ORIGIN}/`]).toContain(meta(s, "property", "og:url"));
    expect(meta(s, "property", "og:image")).toContain("/brand/laptops-hub-share-1200x630.png");
    expect(meta(s, "name", "twitter:card")).toBe("summary_large_image");

    const nodes = jsonLd(s);
    const biz = nodes.find((n) => Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("ComputerStore"))!;
    expect(biz).toBeTruthy();
    expect(biz.name).toBe("Laptops HUB");
    expect((biz.logo as { url: string }).url).toBe(`${ORIGIN}/brand/laptops-hub-logo-512.png`);
    expect(biz.address).toMatchObject({ addressLocality: "Bahawalpur", addressCountry: "PK" });
    expect(String(biz.telephone)).toMatch(/^\+92\d{10}$/);
    for (const k of ["aggregateRating", "openingHoursSpecification", "geo", "priceRange"]) expect(biz).not.toHaveProperty(k);
    const site = nodes.find((n) => n["@type"] === "WebSite")!;
    expect(site.name).toBe("Laptops HUB");
    // The domain alternate name is the serving host without "www." (laptopshub.pk in production).
    expect(site.alternateName).toContain(new URL(ORIGIN).host.replace(/^www\./, ""));
    expect(site).not.toHaveProperty("potentialAction");

    // The logo and share image are served.
    for (const p of ["/brand/laptops-hub-logo-512.png", "/brand/laptops-hub-share-1200x630.png"]) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
  });

  test("hero heading reads as words (no 'ofsmarter')", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const h1 = page.locator("h1").first();
    const [text, lines] = await h1.evaluate((el) => [el.textContent || "", [...el.querySelectorAll(":scope > span")].map((s) => s.textContent || "")]);
    expect(lines.length).toBeGreaterThan(1);
    expect(text.replace(/\s+/g, " ").trim()).toBe(lines.join(" ").replace(/\s+/g, " ").trim());
  });

  test("/compare is noindex and absent from the sitemap; sitemap lists canonical public URLs", async ({ request }) => {
    const c = await html(request, "/compare");
    expect(meta(c, "name", "robots")).toBe("noindex, follow");
    const sm = await (await request.get("/sitemap.xml")).text();
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain(`${ORIGIN}/`);
    expect(locs.some((u) => u.includes("/compare"))).toBe(false);
    expect(locs.some((u) => /\/(admin|api|checkout|cart|preview|order|search)(\/|$)/.test(new URL(u).pathname))).toBe(false);
    expect(locs.every((u) => u.startsWith(`${ORIGIN}/`))).toBe(true);
    expect(locs).toContain(`${ORIGIN}/products/${fx.products[0].handle}`);
  });

  test("owner edits homepage search appearance; public homepage follows; reset restores the default", async ({ page, request }) => {
    await signIn(page, "owner");
    await page.goto("/admin/seo");
    const form = page.getByTestId("seo-home-form");
    const title = `QA Home ${RUN} <script>alert(1)</script> & Co`;
    await form.getByLabel("Homepage search title").fill(title);
    await form.getByLabel("Homepage search description").fill(`QA description ${RUN} for Laptops HUB in Bahawalpur.`);
    await expect(page.getByTestId("seo-home-preview")).toContainText(`QA Home ${RUN}`);
    await form.getByRole("button", { name: "Save homepage search appearance" }).click();
    await expect(page.getByTestId("seo-home-saved")).toBeVisible();

    // Stored, and still there after a full reload.
    const { data } = await sb.from("store_settings").select("value").eq("key", "seo_defaults").single();
    expect((data!.value as Record<string, unknown>).home_title).toBe(title);
    await page.reload();
    await expect(page.getByTestId("seo-home-form").getByLabel("Homepage search title")).toHaveValue(title);

    // Public homepage: new title/description, escaped (the merchant text never becomes markup).
    await expect.poll(async () => decode(titleOf(await html(request, "/")) || ""), { timeout: 20_000 }).toBe(title);
    const s = await html(request, "/");
    expect(s).not.toContain("<script>alert(1)</script>");
    expect(meta(s, "name", "description")).toBe(`QA description ${RUN} for Laptops HUB in Bahawalpur.`);
    expect(decode(meta(s, "property", "og:title") || "")).toBe(title);

    // Reset → the default comes back.
    await page.getByTestId("seo-home-reset").click();
    await expect(page.getByTestId("seo-home-saved")).toBeVisible();
    await expect.poll(async () => decode(titleOf(await html(request, "/")) || ""), { timeout: 20_000 }).toBe(DEFAULT_HOME_TITLE);
  });

  test("an editor cannot change homepage search appearance (UI and API)", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto("/admin/seo");
    await expect(page.getByTestId("seo-home-form").getByLabel("Homepage search title")).toBeDisabled();
    const r = await page.request.put("/api/admin/store-settings", { headers: { origin: ORIGIN }, data: { seoHomeTitle: "Editor was here" } });
    expect(r.status()).toBe(403);
    const { data } = await sb.from("store_settings").select("value").eq("key", "seo_defaults").maybeSingle();
    expect(JSON.stringify(data?.value ?? {})).not.toContain("Editor was here");
  });

  test("guide: Admin → Blog search fields reach metadata and Article JSON-LD", async ({ request }) => {
    const { error } = await sb.from("articles").insert({
      slug: GUIDE,
      title: `QA guide ${RUN}`,
      excerpt: "QA excerpt.",
      body_html: "<p>QA body about choosing laptop memory.</p>",
      status: "published",
      published_at: "2026-11-01T09:00:00Z",
      seo_title: `QA guide search title ${RUN}`,
      seo_description: "QA guide search description.",
      author_name: "QA Author",
    });
    expect(error).toBeNull();
    const s = await html(request, `/guides/${GUIDE}`);
    expect(decode(titleOf(s) || "")).toContain(`QA guide search title ${RUN}`);
    expect(meta(s, "name", "description")).toBe("QA guide search description.");
    expect(canonicalOf(s)).toBe(`${ORIGIN}/guides/${GUIDE}`);
    expect(meta(s, "property", "og:type")).toBe("article");
    expect(meta(s, "property", "og:site_name")).toBe("Laptops HUB");
    const nodes = jsonLd(s);
    const art = nodes.find((n) => n["@type"] === "Article")!;
    expect(art).toMatchObject({ headline: `QA guide search title ${RUN}`, datePublished: expect.stringContaining("2026-11-01"), author: { "@type": "Person", name: "QA Author" } });
    expect(art.publisher).toEqual({ "@id": `${ORIGIN}/#organization` });
    expect(nodes.some((n) => n["@type"] === "BreadcrumbList")).toBe(true);
  });

  test("collections: own description and og:url (no repeated site description)", async ({ request }) => {
    const s = await html(request, "/collections/laptops");
    expect(canonicalOf(s)).toBe(`${ORIGIN}/collections/laptops`);
    const d = meta(s, "name", "description") || "";
    // The collection's own SEO/description text wins; otherwise the brand + city fallback is used.
    const { data: colRow } = await sb.from("collections").select("seo_description, description").eq("slug", "laptops").maybeSingle();
    const own = (colRow?.seo_description || colRow?.description || "").trim();
    if (own) expect(d).toBe(own);
    else expect(d).toContain("Laptops HUB, Bahawalpur");
    expect(d).not.toBe(DEFAULT_HOME_DESCRIPTION);
    expect(meta(s, "property", "og:url")).toBe(`${ORIGIN}/collections/laptops`);
    expect(meta(s, "property", "og:site_name")).toBe("Laptops HUB");
    const all = await html(request, "/collections/all");
    expect(meta(all, "name", "description")).not.toBe(d);
  });
});
