/**
 * G05 (P0): collections can be managed after creation (title, description, visibility, search text), built-in
 * storefront collections say plainly what applies (search text only) instead of silently ignoring edits, and their
 * web addresses cannot be taken by a new collection. Isolated stack only; QA rows are removed and SEO text restored.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const SLUG = `qa-col-${RUN}`;

let laptopsSeo: { seo_title: string | null; seo_description: string | null } | null = null;

async function signIn(page: Page, role: "owner" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/&amp;/g, "&") ?? "";

test.describe.serial("Collection management (G05, isolated)", () => {
  test.beforeAll(async () => {
    const { data } = await sb.from("collections").select("seo_title, seo_description").eq("slug", "laptops").single();
    laptopsSeo = data;
  });
  test.afterAll(async () => {
    const { data: c } = await sb.from("collections").select("id").eq("slug", SLUG).maybeSingle();
    if (c) {
      await sb.from("collection_products").delete().eq("collection_id", c.id);
      await sb.from("collections").delete().eq("id", c.id);
    }
    if (laptopsSeo) await sb.from("collections").update(laptopsSeo).eq("slug", "laptops");
  });

  test("a merchant collection: rename, search text, hide and show again", async ({ page, request }) => {
    await signIn(page, "owner");
    const created = await page.request.post("/api/admin/collections", {
      data: { title: `QA Collection ${RUN}`, slug: SLUG, published: true, collectionType: "manual" },
    });
    expect(created.status(), await created.text()).toBeLessThan(300);
    const { data: col } = await sb.from("collections").select("id").eq("slug", SLUG).single();
    const { data: prod } = await sb.from("products").select("id").eq("handle", fx.products[0].handle).single();
    await sb.from("collection_products").insert({ collection_id: col!.id, product_id: prod!.id, position: 1 });

    await page.goto(`/admin/collections/${SLUG}`);
    const form = page.getByTestId("collection-details-form");
    await expect(form.getByTestId("collection-built-in-note")).toHaveCount(0);
    await form.getByLabel("Title", { exact: true }).fill(`QA Renamed ${RUN}`);
    await form.getByLabel("Search title").fill(`QA Search ${RUN}`);
    await form.getByLabel("Search description").fill(`QA search description ${RUN}.`);
    await form.getByRole("button", { name: "Save details" }).click();
    await expect(form.getByTestId("collection-details-saved")).toBeVisible();

    await expect.poll(async () => titleOf(await (await request.get(`/collections/${SLUG}`)).text()), { timeout: 20_000 }).toContain(`QA Search ${RUN}`);
    await expect.poll(async () => (await (await request.get(`/collections/${SLUG}`)).text()).includes(`QA Renamed ${RUN}`), { timeout: 20_000 }).toBe(true);

    // Hide (with confirmation) → the page is gone and it leaves the sitemap; show again → back.
    page.once("dialog", (d) => void d.accept());
    await form.getByLabel("Visible on the storefront").uncheck();
    await form.getByRole("button", { name: "Save details" }).click();
    await expect(form.getByTestId("collection-details-saved")).toContainText("hidden");
    await expect.poll(async () => (await request.get(`/collections/${SLUG}`)).status(), { timeout: 20_000 }).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`/collections/${SLUG}<`);

    await form.getByLabel("Visible on the storefront").check();
    await form.getByRole("button", { name: "Save details" }).click();
    await expect(form.getByTestId("collection-details-saved")).toBeVisible();
    await expect.poll(async () => (await request.get(`/collections/${SLUG}`)).status(), { timeout: 20_000 }).toBe(200);
  });

  test("a built-in collection: only search text applies; other edits are refused, not ignored", async ({ page, request }) => {
    await signIn(page, "editor");
    await page.goto("/admin/collections/laptops");
    const form = page.getByTestId("collection-details-form");
    await expect(form.getByTestId("collection-built-in-note")).toBeVisible();
    await expect(form.getByLabel("Title", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add rule|save rules/i })).toHaveCount(0);

    await form.getByLabel("Search title").fill(`QA Laptops ${RUN}`);
    await form.getByRole("button", { name: "Save details" }).click();
    await expect(form.getByTestId("collection-details-saved")).toBeVisible();
    await expect.poll(async () => titleOf(await (await request.get("/collections/laptops")).text()), { timeout: 20_000 }).toContain(`QA Laptops ${RUN}`);

    const { data: prod } = await sb.from("products").select("id").eq("handle", fx.products[0].handle).single();
    for (const data of [{ title: "Renamed" }, { published: false }, { rule: { match: "all", conditions: [] } }, { addProductIds: [prod!.id] }]) {
      const r = await page.request.patch("/api/admin/collections/laptops", { data });
      expect(r.status(), JSON.stringify(data)).toBe(409);
      expect((await r.json()).error).toBe("built_in");
    }
    const { data: still } = await sb.from("collections").select("title, published").eq("slug", "laptops").single();
    expect(still!.published).toBe(true);
  });

  test("a new collection cannot take a built-in web address", async ({ page }) => {
    await signIn(page, "owner");
    const r = await page.request.post("/api/admin/collections", { data: { title: "Laptops again", slug: "laptops", published: true, collectionType: "manual" } });
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toBe("slug_reserved");
    // A title that would derive a built-in slug gets a free one instead.
    const r2 = await page.request.post("/api/admin/collections", { data: { title: "Gaming laptops", published: false, collectionType: "manual" } });
    expect(r2.status(), await r2.text()).toBeLessThan(300);
    const { slug } = (await r2.json()) as { slug: string };
    expect(slug).not.toBe("gaming-laptops");
    await sb.from("collections").delete().eq("slug", slug);
  });
});
