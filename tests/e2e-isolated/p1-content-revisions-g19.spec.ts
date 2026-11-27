/**
 * G19 content pages on the ISOLATED stack (needs 20261126160000_content_page_revisions applied locally).
 *  - create a draft page, write it, add search fields, publish → public page, metadata, canonical, sitemap
 *  - change its address → old address 308-redirects, sitemap lists the new one only
 *  - history: versions with staff and action; compare; restore brings back an earlier text as a new version
 *  - out-of-date save refused; invalid address refused; legal pages keep their gate and address; roles enforced
 * Pages with history cannot be deleted (by design), so the test page is left unpublished at the end.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const SLUG = `qa-care-${RUN}`;
const SLUG2 = `qa-laptop-care-${RUN}`;
const TITLE = `QA laptop care ${RUN}`;

async function signIn(page: Page, who: "owner" | "editor" | "fulfillment") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const row = async (slug: string) =>
  (await sb.from("content_pages").select("id, slug, title, body_html, status, version, seo_title, seo_description").eq("slug", slug).maybeSingle()).data;
const formFor = (page: Page, slug: string) => page.locator("form").filter({ has: page.getByRole("heading", { name: slug, exact: true }) });

test.describe.serial("G19: content pages — create, SEO, publish, address change, history (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("content revisions");
  });
  test.afterAll(async () => {
    // History is permanent; leave the QA page unpublished so it is never public.
    await sb.from("content_pages").update({ status: "draft" }).in("slug", [SLUG, SLUG2]);
  });

  test("owner creates, writes and publishes a page with search fields", async ({ page, request }) => {
    test.setTimeout(120_000);
    await signIn(page, "owner");
    await page.goto("/admin/content");
    const create = page.getByTestId("content-create");
    await create.getByLabel("New page title").fill(TITLE);
    await create.getByLabel("New page address").fill("Bad Address!");
    await create.getByRole("button", { name: "Create draft page" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /lower-case letters/ })).toBeVisible();
    await create.getByLabel("New page address").fill(SLUG);
    await create.getByRole("button", { name: "Create draft page" }).click();
    await expect(page.getByText(`Draft page created at /pages/${SLUG}`)).toBeVisible();
    expect((await row(SLUG))!.status).toBe("draft");
    expect((await request.get(`/pages/${SLUG}`)).status()).toBe(404);

    const form = formFor(page, SLUG);
    await expect(form.getByLabel("HTML source")).toHaveCount(0); // advanced source is hidden by default
    await form.getByRole("button", { name: "Show HTML source (advanced)" }).click();
    await form.getByLabel("HTML source").fill("<h2>Keep it cool</h2><p>Use it on a hard surface.</p>");
    await form.getByLabel("Search title").fill(`Laptop care tips ${RUN}`);
    await form.getByLabel("Search description").fill(`How to keep a laptop cool and clean (${RUN}).`);
    await form.getByLabel("Editorial status").selectOption("published");
    await form.getByRole("button", { name: "Save page" }).click();
    await expect(form.getByText("Saved as version 2.")).toBeVisible();

    const res = await request.get(`/pages/${SLUG}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>Laptop care tips ${RUN}`);
    expect(html).toContain(`name="description" content="How to keep a laptop cool and clean (${RUN}).`);
    expect(html).toMatch(new RegExp(`rel="canonical" href="[^"]*/pages/${SLUG}"`));
    expect(html).toContain("Use it on a hard surface.");
    await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(`/pages/${SLUG}<`)).toBe(true);
  });

  test("address change keeps a redirect; history compares and restores", async ({ page, request }) => {
    test.setTimeout(120_000);
    await signIn(page, "owner");
    await page.goto("/admin/content");
    let form = formFor(page, SLUG);
    await form.getByLabel("Page address").fill(SLUG2);
    await form.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText(new RegExp(`moved to /pages/${SLUG2}`))).toBeVisible();
    const old = await request.get(`/pages/${SLUG}`, { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers()["location"]).toMatch(new RegExp(`/pages/${SLUG2}$`));
    await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(`/pages/${SLUG2}<`)).toBe(true);
    expect((await (await request.get("/sitemap.xml")).text()).includes(`/pages/${SLUG}<`)).toBe(false);

    // A new body as version 4, then restore version 2's text.
    await page.reload();
    form = formFor(page, SLUG2);
    await form.getByRole("button", { name: "Show HTML source (advanced)" }).click();
    await form.getByLabel("HTML source").fill("<h2>Keep it cool</h2><p>Rewritten paragraph.</p>");
    await form.getByRole("button", { name: "Save page" }).click();
    await expect(form.getByText("Saved as version 4.")).toBeVisible();

    await form.getByRole("button", { name: "Show history" }).click();
    const revs = form.getByTestId("content-revision");
    await expect(revs).toHaveCount(4);
    await expect(revs.first()).toContainText("Version 4");
    await expect(revs.first()).toContainText("owner");
    await expect(form.getByTestId("content-revision").filter({ hasText: "Address changed" })).toHaveCount(1);
    await form.getByRole("button", { name: "Compare version 2 with current" }).click();
    const diff = form.getByTestId("content-diff");
    await expect(diff).toContainText("Removed: Use it on a hard surface.");
    await expect(diff).toContainText("Added: Rewritten paragraph.");

    page.once("dialog", (d) => d.accept());
    await form.getByRole("button", { name: "Restore version 2" }).click();
    await expect(form.getByTestId("content-history-msg")).toContainText("Version 2 restored as version 5");
    const r = await row(SLUG2);
    expect(r!.version).toBe(5);
    expect(r!.body_html).toContain("Use it on a hard surface.");
    expect(r!.status).toBe("published");
    await expect(form.getByLabel("HTML source")).toHaveValue(/Use it on a hard surface\./);
    expect(await (await request.get(`/pages/${SLUG2}`)).text()).toContain("Use it on a hard surface.");
    const { data: hist } = await sb.from("content_page_revisions").select("version, action, restored_from").eq("page_id", r!.id).order("version");
    expect(hist!.map((h) => h.action)).toEqual(["create", "publish", "rename", "save", "restore"]);
    expect(hist![4].restored_from).toBe(2);

    // An out-of-date tab cannot overwrite.
    const stale = await page.request.patch(`/api/admin/content/${SLUG2}`, {
      data: { title: TITLE, status: "published", bodyHtml: "<p>Old tab</p>", expectedVersion: 4 },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toBe("stale_version");
    expect((await row(SLUG2))!.body_html).not.toContain("Old tab");
  });

  test("roles and policy pages: editors cannot publish or restore published policies; addresses are locked", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto("/admin/content");
    const warranty = formFor(page, "warranty");
    await expect(warranty.getByLabel("Page address")).toHaveCount(0);
    const w = await row("warranty");
    const pub = await page.request.patch("/api/admin/content/warranty", {
      data: { title: w!.title, status: "published", bodyHtml: w!.body_html, expectedVersion: w!.version, legalApproved: true },
    });
    expect(pub.status()).toBe(403);
    const rename = await page.request.patch("/api/admin/content/about", {
      data: { title: "About", status: "draft", bodyHtml: "", expectedVersion: (await row("about"))!.version, newSlug: "about-us" },
    });
    expect(rename.status()).toBe(409);
    const taken = await page.request.post("/api/admin/content", { data: { title: "Fake policy", slug: "privacy" } });
    expect([409]).toContain(taken.status());
    if (w!.status === "published") {
      const restore = await page.request.post("/api/admin/content/warranty/revisions", { data: { version: 1, expectedVersion: w!.version } });
      expect(restore.status()).toBe(403);
    }
    expect((await row("warranty"))!.version).toBe(w!.version);

    await signIn(page, "fulfillment");
    const denied = await page.request.post("/api/admin/content", { data: { title: "No access", slug: `qa-denied-${RUN}` } });
    expect(denied.status()).toBe(403);
  });
});
