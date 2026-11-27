/**
 * Product CSV import + product SEO acceptance on the ISOLATED stack (never the production catalog).
 *
 * Upload → preview → dry-run (nothing written) → commit; invalid rows, missing prices, non-https images and existing
 * products handled safely; update-by-handle keeps blank columns; export → import round trip changes nothing;
 * public product page, SEO (title, description, canonical, OG image, Product JSON-LD with the active price), draft
 * 404 and sitemap; admin SEO edits reach the page at once; import/export permissions by role.
 * Every product this spec creates is deleted at the end; the fixture product is checked unchanged.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";
import { productJsonLd } from "./helpers/json-ld";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OUT = "test-results/product-import-seo";

const RUN = Date.now().toString(36);
const A = `qa-imp-${RUN}-alpha`;
const B = `qa-imp-${RUN}-beta`;
const C = `qa-imp-${RUN}-gamma`;
const EXISTING = fx.products[0].handle as string;
const IMG1 = `https://cdn.shopify.com/s/files/qa/${RUN}-alpha-1.jpg`;
const IMG2 = `https://cdn.shopify.com/s/files/qa/${RUN}-alpha-2.jpg`;
const SEO_TITLE = `QA Alpha search title ${RUN}`;
const SEO_DESC = "QA alpha search description, with a comma";

const HEADERS = [
  "Title", "URL handle", "Description", "Vendor", "Type", "Tags", "Status", "SKU", "Price", "Compare-at price",
  "Inventory tracker", "Inventory quantity", "Product image URL", "Image position", "Image alt text", "SEO title", "SEO description",
];
const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const row = (cells: Partial<Record<(typeof HEADERS)[number], string>>) => HEADERS.map((h) => q(cells[h] ?? "")).join(",");

const FIRST_CSV = [
  HEADERS.join(","),
  row({
    Title: "QA Import Alpha, 16GB", "URL handle": A, Description: "<p>Alpha, light &amp; fast</p>", Vendor: "Dell", Type: "Laptop",
    Tags: "office, qa", Status: "active", SKU: `QA-A-${RUN}`, Price: "50000", "Inventory tracker": "shopify", "Inventory quantity": "3",
    "Product image URL": IMG1, "Image position": "1", "Image alt text": "QA alpha front", "SEO title": SEO_TITLE, "SEO description": SEO_DESC,
  }),
  row({ "URL handle": A, "Product image URL": IMG2, "Image position": "2", "Image alt text": "QA alpha side" }),
  row({ Title: "QA Import Beta", "URL handle": B, Status: "active", SKU: `QA-B-${RUN}` }), // no price
  row({ Title: "QA Import Gamma", "URL handle": C, Status: "draft", Price: "1000", "Product image URL": "http://example.com/gamma.jpg" }),
  row({ Title: "Row without a handle", Price: "10" }),
  row({ Title: "QA SHOULD NOT APPLY", "URL handle": EXISTING, Price: "1", "SEO title": "QA SHOULD NOT APPLY" }),
].join("\n");

type Role = "owner" | "editor" | "manager" | "fulfillment";

async function signIn(page: Page, role: Role) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function asRole(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ baseURL: ORIGIN });
  const page = await ctx.newPage();
  await signIn(page, role);
  return { ctx, page };
}

async function snapshot(handle: string) {
  const { data: p } = await sb
    .from("products")
    .select("id, title, description_safe, merchant_vendor, product_type, status, tags, seo_title, seo_description")
    .eq("handle", handle)
    .single();
  const { data: v } = await sb
    .from("product_variants")
    .select("sku, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, purchasable, option_values")
    .eq("product_id", p!.id)
    .order("sku");
  const { data: m } = await sb.from("product_media").select("url, alt, position").eq("product_id", p!.id).order("position");
  return { product: p, variants: v, media: m };
}

async function importCsv(page: Page, csvText: string, strategy: string, dryRun: boolean, previewFingerprint?: string) {
  const r = await page.request.post("/api/admin/products/import", {
    headers: { origin: ORIGIN },
    data: { csvText, filename: "qa.csv", strategy, dryRun, confirmCommit: dryRun ? undefined : true, previewFingerprint },
  });
  return { status: r.status(), body: await r.json() };
}

async function expectedSellingPrice(listPkr: number): Promise<string> {
  const { data } = await sb.from("discount_campaigns").select("kind, value, status").eq("status", "active");
  const pct = (data || []).find((c) => c.kind === "percent");
  const paisa = pct ? Math.round(listPkr * 100 * (1 - Number(pct.value) / 100)) : listPkr * 100;
  return (paisa / 100).toFixed(2);
}

let existingBefore: Awaited<ReturnType<typeof snapshot>>;

test.describe.configure({ mode: "serial" });

test.describe("Product CSV import + product SEO (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("product import");
    existingBefore = await snapshot(EXISTING);
    fs.mkdirSync(OUT, { recursive: true });
  });

  test.afterAll(async () => {
    const { data } = await sb.from("products").select("id").like("handle", `qa-imp-${RUN}-%`);
    const ids = (data || []).map((p) => p.id as string);
    if (ids.length) {
      await sb.from("product_media").delete().in("product_id", ids);
      await sb.from("collection_products").delete().in("product_id", ids);
      await sb.from("product_variants").delete().in("product_id", ids);
      await sb.from("products").delete().in("id", ids);
    }
  });

  test("owner: upload → preview → dry-run writes nothing → commit; bad rows reported; public page and SEO", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "owner");
    await page.goto("/admin/products/import");
    await page.getByLabel("Shopify product CSV").setInputFiles({ name: "qa-import.csv", mimeType: "text/csv", buffer: Buffer.from(FIRST_CSV) });

    // Browser preview: 4 products by handle, the handle-less row reported.
    await expect(page.getByText("Products (by handle)").locator("..")).toContainText("4");
    await expect(page.getByText(/Line 6: Missing URL handle/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Run dry-run before commit" })).toBeDisabled();

    // Server dry-run: report only, nothing saved.
    await page.getByRole("button", { name: "Server dry-run" }).click();
    const summary = page.getByTestId("import-summary");
    await expect(summary).toContainText("Would add 3");
    await expect(summary).toContainText("skipped 1");
    await expect(summary).toContainText("nothing has been saved yet");
    const results = page.getByTestId("import-results");
    await expect(results).toContainText(`${EXISTING}: already exists — left unchanged`);
    await expect(results).toContainText("No variant with a valid price: it would be saved as a draft.");
    await expect(results).toContainText("image address must start with https://");
    await expect(page.getByTestId("import-row-errors")).toContainText("Line 6");
    expect((await sb.from("products").select("id").like("handle", `qa-imp-${RUN}-%`)).data).toHaveLength(0);

    // Changing the strategy needs a new dry-run before Commit is offered.
    await page.getByLabel("Import strategy").selectOption("skip_conflicts");
    await expect(page.getByRole("button", { name: "Run dry-run before commit" })).toBeDisabled();
    await page.getByLabel("Import strategy").selectOption("add_only");
    await page.getByRole("button", { name: "Server dry-run" }).click();
    await expect(summary).toContainText("Would add 3");

    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Commit import" }).click();
    await expect(summary).toContainText("Added 3");
    await expect(results).toContainText("No variant with a valid price, so the product was saved as a draft.");
    await expect(page.getByRole("button", { name: "Run dry-run before commit" })).toBeDisabled(); // no accidental re-commit
    await page.screenshot({ path: `${OUT}/import-committed.png`, fullPage: true });

    // Database: exact values, quoted commas intact, inventory tracked, images in order with alt text.
    const a = await snapshot(A);
    expect(a.product).toMatchObject({
      title: "QA Import Alpha, 16GB", description_safe: "<p>Alpha, light &amp; fast</p>", merchant_vendor: "Dell",
      status: "active", tags: ["office", "qa"], seo_title: SEO_TITLE, seo_description: SEO_DESC,
    });
    expect(a.variants).toEqual([
      expect.objectContaining({ sku: `QA-A-${RUN}`, price_paisa: 5_000_000, inventory_mode: "tracked", quantity_on_hand: 3, purchasable: true }),
    ]);
    expect(a.media).toEqual([
      { url: IMG1, alt: "QA alpha front", position: 1 },
      { url: IMG2, alt: "QA alpha side", position: 2 },
    ]);
    expect((await snapshot(B)).product!.status).toBe("draft");
    expect((await snapshot(B)).variants).toHaveLength(0);
    const c = await snapshot(C);
    expect(c.product!.status).toBe("draft");
    expect(c.media).toHaveLength(0);
    // The existing product is untouched by an add-only import.
    expect(await snapshot(EXISTING)).toEqual(existingBefore);

    // Public product page + SEO, right after the commit (the import refreshes the catalog cache).
    const res = await page.goto(`/products/${A}`);
    expect(res!.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(`^${SEO_TITLE}`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", SEO_DESC);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/products/${A}$`));
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", IMG1);
    const ld = await productJsonLd(page);
    expect(ld).toMatchObject({ name: "QA Import Alpha, 16GB", image: [IMG1, IMG2] });
    expect(ld!.offers).toMatchObject({ "@type": "Offer", priceCurrency: "PKR", price: await expectedSellingPrice(50000) });
    await page.screenshot({ path: `${OUT}/pdp-alpha.png` });

    for (const h of [B, C]) expect((await page.request.get(`/products/${h}`)).status(), h).toBe(404);
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/products/${A}</loc>`);
    expect(sitemap).not.toContain(`/products/${B}<`);
    expect(sitemap).not.toContain(`/products/${C}<`);
  });

  test("update-by-handle changes only filled columns; export → import round trip changes nothing", async ({ page }) => {
    await signIn(page, "owner");
    const before = await snapshot(A);

    // A price-only update file: no SEO, status, description, tags or stock columns.
    const priceOnly = ["URL handle,Title,Price", `${A},"QA Import Alpha, 16GB",52000`].join("\n");
    const dry = await importCsv(page, priceOnly, "update_by_handle", true);
    expect(dry.status).toBe(200);
    expect(dry.body.summary).toMatchObject({ updated: 1, created: 0 });
    const commit = await importCsv(page, priceOnly, "update_by_handle", false, dry.body.fingerprint);
    expect(commit.status).toBe(200);
    const after = await snapshot(A);
    expect(after.product).toEqual(before.product); // SEO, status, description, tags kept
    expect(after.variants).toEqual([{ ...before.variants![0], price_paisa: 5_200_000 }]); // stock tracking kept
    expect(after.media).toEqual(before.media);

    // Export (Shopify modern) and import the same file back: nothing changes.
    const exp = await page.request.get(`/api/admin/products/export?format=shopify_modern&handles=${A}`);
    expect(exp.status()).toBe(200);
    const csv = await exp.text();
    fs.writeFileSync(`${OUT}/export-alpha.csv`, csv);
    expect(csv).toContain(`"QA Import Alpha, 16GB"`);
    const rt = await importCsv(page, csv, "update_by_handle", false);
    expect(rt.status, JSON.stringify(rt.body).slice(0, 300)).toBe(200);
    expect(rt.body.summary).toMatchObject({ updated: 1, failed: 0 });
    expect(rt.body.rowErrors).toEqual([]);
    expect(await snapshot(A)).toEqual(after);
  });

  test("admin SEO edits and visibility reach the public page at once", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto(`/admin/products/${A}`);
    await page.getByLabel(/^Page title/).fill(`QA Alpha edited title ${RUN}`);
    await page.getByLabel(/^Description \(\d+\/500\)/).fill("QA alpha edited description");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/^Page title/)).toHaveValue(`QA Alpha edited title ${RUN}`);
    await expect(page.getByLabel(/^Description \(\d+\/500\)/)).toHaveValue("QA alpha edited description");

    await page.goto(`/products/${A}`);
    await expect(page).toHaveTitle(new RegExp(`^QA Alpha edited title ${RUN}`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "QA alpha edited description");

    // Draft: the page and its sitemap entry disappear immediately; active again brings both back.
    await page.goto(`/admin/products/${A}`);
    await page.getByLabel("Visibility").selectOption("draft");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    expect((await page.request.get(`/products/${A}`)).status()).toBe(404);
    expect(await (await page.request.get("/sitemap.xml")).text()).not.toContain(`/products/${A}<`);
    await page.getByLabel("Visibility").selectOption("active");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    expect((await page.request.get(`/products/${A}`)).status()).toBe(200);
  });

  test("import/export permissions: editor and fulfillment refused, manager may preview, cross-site and anonymous refused", async ({ browser, page }) => {
    const tiny = ["URL handle,Title,Price", `${A},QA,1`].join("\n");
    for (const role of ["editor", "fulfillment"] as const) {
      const s = await asRole(browser, role);
      expect((await importCsv(s.page, tiny, "update_by_handle", true)).status, role).toBe(403);
      await s.ctx.close();
    }
    const m = await asRole(browser, "manager");
    const dry = await importCsv(m.page, tiny, "update_by_handle", true);
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun).toBe(true);
    await m.ctx.close();

    const f = await asRole(browser, "fulfillment");
    expect((await f.page.request.get(`/api/admin/products/export?handles=${A}`)).status()).toBe(403);
    await f.ctx.close();

    await signIn(page, "owner");
    const cross = await page.request.post("/api/admin/products/import", {
      headers: { origin: "https://evil.example" },
      data: { csvText: tiny, strategy: "update_by_handle", dryRun: true },
    });
    expect(cross.status()).toBe(403);
    const anon = await browser.newContext({ baseURL: ORIGIN });
    expect((await anon.request.post("/api/admin/products/import", { headers: { origin: ORIGIN }, data: { csvText: tiny, dryRun: true } })).status()).toBe(401);
    await anon.close();
    // Nothing above changed the product price.
    expect((await snapshot(A)).variants![0].price_paisa).toBe(5_200_000);
  });
});
