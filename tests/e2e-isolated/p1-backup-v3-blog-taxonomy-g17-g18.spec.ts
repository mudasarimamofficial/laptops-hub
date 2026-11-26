/**
 * G17 backup v3 + G18 public blog taxonomy on the ISOLATED stack.
 *  G17: a new backup is schema v3 with content pages, reel product links and the theme publication; restore brings back
 *       a non-legal page, the reel's product links and the published homepage theme, while a legal page keeps its live
 *       text and the COD gate / notification settings stay live.
 *  G18: category, tags and template work publicly: article chips, Article markup, /guides?tag= and ?category= filters
 *       (noindex, canonical /guides), empty filter message.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);

async function signInOwner(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff.owner.email);
  await page.getByLabel("Password").fill(fx.staff.owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const page_ = async (slug: string) => (await sb.from("content_pages").select("*").eq("slug", slug).single()).data as Record<string, unknown>;
const links = async (reelId: string) =>
  ((await sb.from("reel_products").select("product_id, sort_order").eq("reel_id", reelId).order("sort_order")).data || []).map((l) => `${l.product_id}:${l.sort_order}`);
const livePub = async () => (await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle()).data?.published_version_id ?? null;

test("G17: v3 backup restores pages, reel links and the homepage theme; legal pages and gates stay live", async ({ page }) => {
  test.setTimeout(120_000);
  await assertLocalOnly("backup v3");
  const about0 = await page_("about");
  const privacy0 = await page_("privacy");
  const cod0 = (await sb.from("store_settings").select("value").eq("key", "cod_checkout").single()).data!.value;
  const pub0 = await livePub();
  const { data: tpl } = await sb.from("theme_templates").select("id").eq("key", "homepage").single();
  const { data: published } = await sb.from("theme_versions").select("id").eq("template_id", tpl!.id).eq("status", "published").limit(5);
  const otherVersion = (published || []).map((v) => v.id).find((id) => id !== pub0) ?? null;
  const prodIds = await Promise.all(
    [fx.products[0].handle, fx.products[1].handle].map(async (h: string) => (await sb.from("products").select("id").eq("handle", h).single()).data!.id as string),
  );
  const { data: reel } = await sb
    .from("reels")
    .insert({ title: `QA G17 reel ${RUN}`, video_url: "https://example.invalid/qa.mp4", status: "draft" })
    .select("id")
    .single();
  const reelId = reel!.id as string;
  await sb.from("reel_products").insert([
    { reel_id: reelId, product_id: prodIds[0], sort_order: 0 },
    { reel_id: reelId, product_id: prodIds[1], sort_order: 1 },
  ]);
  const created: string[] = [];
  try {
    await signInOwner(page);
    const mk = await page.request.post("/api/admin/backups", { headers: { origin: ORIGIN }, data: { label: `QA G17 v3 ${RUN}` } });
    expect(mk.status(), await mk.text()).toBe(200);
    const backupId = (await mk.json()).backup.id as string;
    created.push(backupId);
    const { data: snap } = await sb.from("merchant_snapshots").select("payload, validation, status").eq("id", backupId).single();
    expect(snap!.status).toBe("valid");
    expect(snap!.payload.schemaVersion).toBe(3);
    expect(Array.isArray(snap!.payload.content_pages) && snap!.payload.content_pages.length).toBeGreaterThan(0);
    expect(snap!.payload.reel_products.some((l: { reel_id: string }) => l.reel_id === reelId)).toBe(true);
    expect(Array.isArray(snap!.payload.theme.versions)).toBe(true);
    expect(snap!.validation.content_pages).toBeGreaterThan(0);

    // After the backup: change a normal page, a legal page, the reel links and the published theme.
    await sb.from("content_pages").update({ title: `QA changed about ${RUN}` }).eq("slug", "about");
    await sb.from("content_pages").update({ body_html: `<p>QA live privacy ${RUN}</p>` }).eq("slug", "privacy");
    await sb.from("reel_products").delete().eq("reel_id", reelId).eq("product_id", prodIds[1]);
    await sb.from("reel_products").update({ sort_order: 7 }).eq("reel_id", reelId).eq("product_id", prodIds[0]);
    if (otherVersion && pub0) {
      const { error } = await sb.rpc("rollback_homepage_theme", { payload: { actor_user_id: fx.staff.owner.id, target_version_id: otherVersion } });
      expect(error).toBeNull();
      expect(await livePub()).toBe(otherVersion);
    }

    const rs = await page.request.post(`/api/admin/backups/${backupId}/restore`, { headers: { origin: ORIGIN } });
    const body = await rs.json();
    expect(rs.status(), JSON.stringify(body)).toBe(200);
    if (body.checkpointId) created.push(body.checkpointId);

    expect((await page_("about")).title).toBe(about0.title);
    expect(body.extras.content_pages.restored).toBeGreaterThanOrEqual(1);
    expect(body.extras.content_pages.failed).toEqual([]);
    expect(body.extras.content_pages.keptLiveLegal).toContain("privacy");
    expect((await page_("privacy")).body_html).toBe(`<p>QA live privacy ${RUN}</p>`); // legal text stays live
    expect(await links(reelId)).toEqual([`${prodIds[0]}:0`, `${prodIds[1]}:1`]);
    expect(body.extras.reel_products.failed).toEqual([]);
    if (otherVersion && pub0) {
      expect(body.extras.theme.action).toBe("repointed");
      expect(await livePub()).toBe(pub0);
    }
    expect((await sb.from("store_settings").select("value").eq("key", "cod_checkout").single()).data!.value).toEqual(cod0);

    // The admin page explains what a restore covers.
    await page.goto("/admin/settings#backups");
    await expect(page.getByText(/reels, customer reviews, shipping zones, CMS pages and the published homepage theme|Backups & recovery/).first()).toBeVisible();
  } finally {
    await sb.from("content_pages").update({ title: about0.title, body_html: about0.body_html, status: about0.status }).eq("slug", "about");
    await sb.from("content_pages").update({ body_html: privacy0.body_html }).eq("slug", "privacy");
    await sb.from("reels").delete().eq("id", reelId);
    if (pub0 && (await livePub()) !== pub0) await sb.rpc("rollback_homepage_theme", { payload: { actor_user_id: fx.staff.owner.id, target_version_id: pub0 } });
    if (created.length) await sb.from("merchant_snapshots").delete().in("id", created);
  }
});

test("G18: blog category, tags and template work on the public site", async ({ page }) => {
  test.setTimeout(90_000);
  await assertLocalOnly("blog taxonomy");
  const slug = `qa-g18-${RUN}`;
  const other = `qa-g18-other-${RUN}`;
  const category = `QA Buying ${RUN}`;
  const ids: string[] = [];
  await signInOwner(page);
  // Through Admin › Blog (the merchant path; it also expires the guides cache).
  const create = async (data: Record<string, unknown>) => {
    const r = await page.request.post("/api/admin/posts", { headers: { origin: ORIGIN }, data });
    expect(r.status(), await r.text()).toBe(200);
    ids.push((await r.json()).id);
  };
  try {
    await create({
      slug, title: `QA taxonomy guide ${RUN}`, excerpt: "QA excerpt", bodyHtml: "<h2>One</h2><p>Body text for the QA guide.</p>",
      status: "published", category, tags: ["Battery", `qa${RUN}`], templateKey: "news",
    });
    await create({
      slug: other, title: `QA other guide ${RUN}`, excerpt: "Other", bodyHtml: "<p>Other body text.</p>",
      status: "published", category: "", tags: ["Screens", `qa${RUN}x`], templateKey: "product-review",
    });

    await page.goto(`/guides/${slug}`);
    const chips = page.getByTestId("guide-taxonomy");
    await expect(chips.getByRole("link", { name: category })).toHaveAttribute("href", `/guides?category=${encodeURIComponent(category).replace(/%20/g, "+")}`);
    await expect(chips.getByRole("link", { name: `#qa${RUN}`, exact: true })).toBeVisible();
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
    expect(ld).toContain('"@type":"NewsArticle"');
    expect(ld).toContain(`"articleSection":"${category}"`);
    expect(ld).toContain(`"keywords":"Battery, qa${RUN}"`);

    // Tag link → filtered index with only this post; not indexed, canonical /guides.
    await chips.getByRole("link", { name: `#qa${RUN}`, exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/guides" && u.searchParams.get("tag") === `qa${RUN}`);
    await expect(page.getByTestId("guides-filter")).toContainText(`#qa${RUN}`);
    const cardA = page.locator(`a[href="/guides/${slug}"]`).filter({ hasText: "Read guide" });
    const cardB = page.locator(`a[href="/guides/${other}"]`).filter({ hasText: "Read guide" });
    await expect(cardA).toBeVisible();
    await expect(cardA).toContainText(category);
    await expect(cardB).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/guides$/);

    // Category filter.
    await page.goto(`/guides?category=${encodeURIComponent(category)}`);
    await expect(cardA).toBeVisible();
    await expect(cardB).toHaveCount(0);

    // Unfiltered index: template label when there is no category; indexable.
    await page.goto("/guides");
    await expect(cardB).toContainText("Review");
    await expect(cardA).toContainText(category);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

    await page.goto("/guides?tag=nothing-matches-this");
    await expect(page.getByTestId("guides-filter-empty")).toBeVisible();
  } finally {
    for (const id of ids) await page.request.delete(`/api/admin/posts/${id}`, { headers: { origin: ORIGIN } });
    await sb.from("articles").delete().in("slug", [slug, other]);
  }
});
