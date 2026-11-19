/**
 * The owner's 36-step operational acceptance scenario, run end to end through the real admin and storefront UI on the
 * ISOLATED stack (local Supabase + `next start` built with THEME_PUBLISHED_ENABLED=1, the stand-in email provider).
 * A protected staging Preview is not available yet (docs/LAPTOPS_HUB_STAGING_CERTIFICATION_REPORT.md); this is the
 * same scenario, step for step, so it can be re-run unchanged against staging once it exists.
 *
 * Evidence: screenshots + docs/evidence/acceptance/db-evidence.json (database read-backs per step).
 * Everything it creates is synthetic ("QA Acceptance …") and is archived/removed in afterAll; settings it changes are
 * restored.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { formatPkr } from "../../src/lib/money";
import { fmtPkr } from "../../src/lib/catalog/v5-model";
import { DEFAULT_SOCIAL_PROOF, type SocialProofSettings } from "../../src/lib/content/social-proof";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { beginGuardedRun, endGuardedRun } from "./helpers/run-guard";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;
if (!LOOPBACK.test(SB_URL)) throw new Error("the acceptance scenario needs a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const FAKE = process.env.FAKE_RESEND_URL || "http://127.0.0.1:4599";
const OUT = "docs/evidence/acceptance";
const RUN = Date.now().toString(36);
const TITLE = `QA Acceptance Laptop ${RUN}`;
const HANDLE = `qa-acceptance-laptop-${RUN}`;
const SKU = (ram: string) => `QA-ACC-${RUN}-${ram}`.toUpperCase();
const PRICES = { "8GB": 85_000, "16GB": 95_000 } as const; // PKR, synthetic
const STOCK = { "8GB": 4, "16GB": 2 } as const; // synthetic test quantities on a local database
const COLLECTION = `QA Acceptance ${RUN}`;
const POST_SLUG = `qa-acceptance-guide-${RUN}`;
const REEL = `QA acceptance reel ${RUN}`;
const REVIEWER = `QA Acceptance Reviewer ${RUN}`;
const VIDEO = `${SB_URL.replace(/\/+$/, "")}/storage/v1/object/public/reels/qa-acceptance-${RUN}.webm`;
const IMG = "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111"; // approved preset
const HERO_B = "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111"; // approved preset

const evidence: Record<string, unknown> = { run: RUN, supabase: SB_URL, app: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001" };
const state: {
  productId?: string;
  variants: Record<string, string>;
  collectionSlug?: string;
  orderNumber?: string;
  orderId?: string;
  orderUrl?: string;
  boughtVariant?: string;
  soldRam?: "8GB" | "16GB";
  totalPaisa?: number;
  baselineThemeId?: string;
  hadPublication?: boolean;
  savedSocial?: unknown;
  baselinePublication?: string | null;
} = { variants: {} };

const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
const step = (n: number, data: unknown) => {
  evidence[`step_${String(n).padStart(2, "0")}`] = data;
};

async function signIn(page: Page, role: "owner" | "manager" | "fulfillment" | "editor") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

async function heroMainSrc(page: Page) {
  await page.goto("/");
  const center = page.locator('.v5-hero-comp a[style*="width: 64%"] img, .v5-hero-comp a[style*="width:64%"] img');
  await expect(center.first()).toBeVisible();
  return (await center.first().getAttribute("src")) || "";
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function publicContext(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

const GUARD = "owner-acceptance-36";
type Baseline = { social: unknown; publication: string | null };
const APP = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";

async function readBaseline(): Promise<Baseline> {
  const { data: sp } = await sb.from("store_settings").select("value").eq("key", "social_proof").maybeSingle();
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  return { social: sp?.value ?? null, publication: pub?.published_version_id ?? null };
}

/** Removes every synthetic record this scenario creates (fixed prefixes), including leftovers of an interrupted run. */
async function sweepSyntheticRecords() {
  const { data: prods } = await sb.from("products").select("id").like("handle", "qa-acceptance-laptop-%");
  const ids = (prods || []).map((p) => p.id);
  if (ids.length) {
    const { data: lines } = await sb.from("order_items").select("order_id").in("product_id", ids);
    const orderIds = Array.from(new Set((lines || []).map((l) => l.order_id)));
    if (orderIds.length) await sb.from("orders").delete().in("id", orderIds);
    await sb.from("product_badges").delete().in("product_id", ids);
    await sb.from("products").update({ status: "archived" }).in("id", ids).neq("status", "archived");
  }
  await sb.from("reels").delete().like("title", "QA acceptance reel %");
  await sb.from("product_reviews").delete().like("author_name", "QA Acceptance Reviewer %");
  await sb.from("articles").delete().like("slug", "qa-acceptance-guide-%");
  await sb.from("collections").delete().like("slug", "qa-acceptance-%");
}

async function restoreBaseline(b: Baseline) {
  if (b.social === null) await sb.from("store_settings").delete().eq("key", "social_proof");
  else await sb.from("store_settings").upsert({ key: "social_proof", value: b.social });
  const { data: pub } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
  if (b.publication && pub?.published_version_id !== b.publication) {
    // Through the real admin API (the publication pointer is only changed by the audited rollback RPC).
    const anon = createClient(SB_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await anon.auth.signInWithPassword({ email: fx.staff.owner.email, password: fx.staff.owner.password });
    const r = await fetch(`${APP}/api/admin/theme/homepage/rollback`, {
      method: "POST",
      headers: { authorization: `Bearer ${data.session!.access_token}`, "content-type": "application/json", origin: APP },
      body: JSON.stringify({ confirmRollback: true, targetVersionId: b.publication }),
    });
    if (!r.ok) throw new Error(`theme rollback during restore failed: ${r.status} ${await r.text()}`);
  }
  await sweepSyntheticRecords();
}

test.describe.serial("Owner acceptance scenario — 36 steps (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("36-step acceptance scenario");
    fs.mkdirSync(OUT, { recursive: true });
    await fetch(`${FAKE}/_reset`, { method: "POST" });
    await sb.from("rate_limit_buckets").delete().like("bucket_key", "review:%");
    const g = await beginGuardedRun<Baseline>(GUARD, readBaseline, restoreBaseline);
    evidence.recoveredFromInterruptedRun = g.recoveredFromInterruptedRun;
    await sweepSyntheticRecords();
    state.savedSocial = g.baseline.social;
    state.baselinePublication = g.baseline.publication;
    // Explicit baseline: nothing synthetic from an earlier run is still public.
    const { count } = await sb.from("products").select("id", { count: "exact", head: true }).like("handle", "qa-acceptance-laptop-%").neq("status", "archived");
    expect(count).toBe(0);
  });

  test.afterAll(async () => {
    fs.writeFileSync(`${OUT}/db-evidence.json`, JSON.stringify(evidence, null, 2));
    // Restores settings + the theme publication and removes every synthetic record (orders of the test product
    // included, so no later suite counts them). The guard file is removed only after that succeeded.
    await restoreBaseline({ social: state.savedSocial ?? null, publication: state.baselinePublication ?? null });
    endGuardedRun(GUARD);
  });

  test("1–5: owner creates a laptop with two variants, prices and real (synthetic) stock", async ({ page }) => {
    await signIn(page, "owner"); // 1
    await expect(page.getByRole("navigation").getByRole("link", { name: "Staff" })).toBeVisible();
    step(1, { role: "owner", email: fx.staff.owner.email });

    await page.goto("/admin/products/new"); // 2
    await page.getByLabel("Title").fill(TITLE);
    await expect(page.getByLabel("URL handle")).toHaveValue(HANDLE);
    await page.getByLabel("Price (PKR)").fill(String(PRICES["8GB"]));
    await page.getByLabel("Brand / manufacturer").fill("QA Brand");
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL(new RegExp(`/admin/products/${HANDLE}$`));
    const { data: p } = await sb.from("products").select("id, status").eq("handle", HANDLE).single();
    state.productId = p!.id;
    expect(p!.status).toBe("draft");
    step(2, { productId: p!.id, handle: HANDLE, status: p!.status });

    // 3–5: option RAM → two variants, each with its price, tracked stock
    // A new product starts with one "Default" option row (Shopify-style); the merchant turns it into RAM.
    await page.getByLabel("Option name").first().fill("RAM");
    await page.getByLabel("Values (comma-separated)").first().fill("8GB, 16GB");
    await page.getByRole("button", { name: /Generate \/ refresh matrix/ }).click();
    for (const ram of ["8GB", "16GB"] as const) {
      await page.getByLabel(`SKU for ${ram}`, { exact: true }).fill(SKU(ram));
      await page.getByLabel(`Price in PKR for ${ram}`, { exact: true }).fill(String(PRICES[ram]));
      await page.getByLabel(`Inventory tracking for ${ram}`, { exact: true }).selectOption("tracked");
      await page.getByLabel(`Quantity on hand for ${ram}`, { exact: true }).fill(String(STOCK[ram]));
    }
    await page.getByRole("button", { name: "Save variants" }).click();
    await expect(page.getByText(/Saved 2 variants|variants? saved/i).first()).toBeVisible();
    const { data: vs } = await sb.from("product_variants").select("id, title, sku, price_paisa, inventory_mode, quantity_on_hand").eq("product_id", state.productId!).order("title");
    expect(vs).toHaveLength(2);
    for (const v of vs!) {
      const ram = v.title as "8GB" | "16GB";
      state.variants[ram] = v.id;
      expect(v).toMatchObject({ sku: SKU(ram), price_paisa: PRICES[ram] * 100, inventory_mode: "tracked", quantity_on_hand: STOCK[ram] });
    }
    step(3, { variants: vs!.map((v) => ({ title: v.title, sku: v.sku })) });
    step(4, { prices_paisa: Object.fromEntries(vs!.map((v) => [v.title, v.price_paisa])) });
    step(5, { stock: Object.fromEntries(vs!.map((v) => [v.title, v.quantity_on_hand])) });
    await shot(page, "05-variants-saved", true);
  });

  test("6–9: media, collection, publish, storefront appearance", async ({ page, browser }) => {
    await signIn(page, "owner");
    await page.goto(`/admin/products/${HANDLE}`);
    await page.getByLabel("Image URL (HTTPS)").fill(IMG); // 6 — an approved preset image
    await page.getByLabel("Alt text").fill(`${TITLE} front view`);
    await page.getByRole("button", { name: "Add URL" }).click();
    await expect(page.getByText(/rights (stay|remain) pending until/i)).toBeVisible();
    const { data: media } = await sb.from("product_media").select("url, alt, position, approval").eq("product_id", state.productId!);
    expect(media).toHaveLength(1);
    expect(media![0].url).toBe(IMG);
    step(6, { media: media![0], note: "Rights flag stays 'pending' until the owner approves it (never auto-approved)." });

    await page.goto("/admin/collections/new"); // 7
    await page.getByLabel("Title").fill(COLLECTION);
    await page.getByLabel("Published").check();
    await page.getByRole("button", { name: "Create collection" }).click();
    await page.waitForURL(/\/admin\/collections\/(?!new)[a-z0-9-]+$/);
    state.collectionSlug = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
    await page.getByLabel("Search products to add").fill(`Acceptance Laptop ${RUN}`);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.locator("li", { hasText: HANDLE }).getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Product added.")).toBeVisible();
    step(7, { collection: state.collectionSlug });

    await page.goto(`/admin/products/${HANDLE}`); // 8
    await page.getByLabel("Status").first().selectOption("active");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText(/^Saved\./).first()).toBeVisible();
    const { data: p } = await sb.from("products").select("status").eq("id", state.productId!).single();
    expect(p!.status).toBe("active");
    step(8, { status: p!.status });

    const pub = await publicContext(browser); // 9
    await pub.page.goto(`/products/${HANDLE}`);
    await expect(pub.page.getByRole("heading", { level: 1 })).toContainText(TITLE);
    // The V5 product page sells the product's first purchasable variant (no option picker in the frozen design).
    const priceText = (await pub.page.locator("main").innerText()).replace(/\s+/g, " ");
    state.soldRam = (["8GB", "16GB"] as const).find((r) => priceText.includes(fmtPkr(PRICES[r] * 100)));
    expect(state.soldRam, "PDP shows one of the variant prices").toBeTruthy();
    await shot(pub.page, "09-pdp");
    await pub.page.goto(`/collections/${state.collectionSlug}`);
    const handles = await pub.page.locator("article.v5-card a[href^='/products/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!.split("/").pop()))]);
    expect(handles).toEqual([HANDLE]);
    await shot(pub.page, "09-collection");
    step(9, { pdp: `/products/${HANDLE}`, collectionShows: handles });
    await pub.ctx.close();
  });

  test("10–15: cart, Pakistan address, quote, COD order, confirmation, stock + ledger", async ({ page }) => {
    await page.goto(`/products/${HANDLE}`);
    await page.getByRole("button", { name: /Add to cart/ }).first().click(); // 10
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Acceptance Buyer"); // 11
    await page.getByLabel(/Mobile/).fill("03001234567");
    await page.getByLabel(/Email/).fill("acceptance-buyer@lh-test.local");
    await page.getByLabel("Street address").fill("House 12, Street 4, Gulberg III");
    await page.getByLabel("City").fill("Lahore");
    await page.getByLabel("Province").selectOption("Punjab");
    await page.getByRole("radio", { name: /Lahore standard \(test\)/ }).first().check(); // 12
    const { data: zone } = await sb.from("shipping_zones").select("flat_fee_paisa, cod_fee_paisa, free_shipping_min_paisa").eq("id", fx.zone.id).single();
    const subtotal = PRICES[state.soldRam!] * 100;
    const free = zone!.free_shipping_min_paisa != null && subtotal >= zone!.free_shipping_min_paisa;
    const total = subtotal + (free ? 0 : zone!.flat_fee_paisa) + zone!.cod_fee_paisa;
    state.totalPaisa = total;
    await expect(page.getByText(`Cash due: ${formatPkr(total)}`)).toBeVisible();
    step(12, { subtotal, zone, totalDue: state.totalPaisa });
    await shot(page, "12-checkout-quote", true);

    await page.getByRole("checkbox", { name: /I will pay the cash-due amount/ }).check(); // 13
    await page.getByRole("button", { name: "Place COD order" }).click();
    await page.waitForURL(/\/order\/success\//); // 14
    state.orderUrl = new URL(page.url()).pathname;
    await expect(page.getByTestId("order-total")).toHaveText(formatPkr(total));
    state.orderNumber = (await page.locator("p", { hasText: /^LH-\d{6}-[0-9A-F]{6}$/ }).first().textContent())!.trim();
    await shot(page, "14-confirmation");
    const { data: o } = await sb.from("orders").select("id, status, payment_status, subtotal_paisa, shipping_paisa, cod_fee_paisa, total_due_paisa").eq("order_number", state.orderNumber).single();
    state.orderId = o!.id;
    expect(o).toMatchObject({ status: "placed", payment_status: "unpaid_cod", total_due_paisa: state.totalPaisa });
    const { data: items } = await sb.from("order_items").select("variant_id, quantity, unit_price_paisa").eq("order_id", o!.id);
    expect(items).toHaveLength(1);
    state.boughtVariant = Object.entries(state.variants).find(([, id]) => id === items![0].variant_id)![0];
    expect(state.boughtVariant).toBe(state.soldRam);
    step(13, { orderNumber: state.orderNumber });
    step(14, { order: o, items });

    const deadline = Date.now() + 20_000; // business + customer emails go to the stand-in provider only
    let mails: { to: string[]; subject: string }[] = [];
    while (Date.now() < deadline) {
      mails = ((await (await fetch(`${FAKE}/_log`)).json()).delivered as typeof mails).filter((d) => d.subject.includes(state.orderNumber!));
      if (mails.length >= 2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(mails.map((m) => m.to[0]).sort()).toEqual(["acceptance-buyer@lh-test.local", "owner@lh-test.local"]);

    const ram = state.boughtVariant as "8GB" | "16GB"; // 15
    const { data: v } = await sb.from("product_variants").select("quantity_on_hand").eq("id", state.variants[ram]).single();
    expect(v!.quantity_on_hand).toBe(STOCK[ram] - 1);
    const { data: ledger } = await sb.from("inventory_ledger").select("delta, quantity_after, reason, reference_type, reference_id").eq("variant_id", state.variants[ram]).eq("reason", "order_placed");
    expect(ledger).toEqual([{ delta: -1, quantity_after: STOCK[ram] - 1, reason: "order_placed", reference_type: "order", reference_id: o!.id }]);
    step(15, { variant: ram, quantityAfter: v!.quantity_on_hand, ledger, emails: mails.map((m) => ({ to: m.to, subject: m.subject })) });
  });

  test("16–22: order desk — confirm, pack, ship, deliver, record COD cash, accounting", async ({ page }) => {
    await signIn(page, "manager");
    await page.goto("/admin/orders"); // 16
    await page.getByRole("link", { name: state.orderNumber! }).click();
    await page.waitForURL(new RegExp(`/admin/orders/${state.orderNumber}$`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(state.orderNumber!);
    step(16, { visibleTo: "manager" });
    const transitions = ["confirmed", "packing", "shipped", "out_for_delivery", "delivered"]; // 17–20
    for (const to of transitions) {
      await page.getByLabel("Next step").selectOption(to);
      if (to === "shipped") {
        await page.getByLabel(/^Carrier/).fill("Test Courier");
        await page.getByLabel(/^Tracking number/).fill(`ACC-${RUN}`);
      }
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByText(new RegExp(`Current:\\s*${to}`, "i"))).toBeVisible();
    }
    await shot(page, "20-delivered", true);
    const { data: before } = await sb.from("orders").select("status, payment_status, amount_collected_paisa").eq("id", state.orderId!).single();
    expect(before).toMatchObject({ status: "delivered", payment_status: "unpaid_cod", amount_collected_paisa: 0 }); // delivery is not payment
    step(20, before);

    await page.getByLabel("Collector reference").fill(`rider-${RUN}`); // 21
    await page.getByRole("button", { name: "Record collection" }).click();
    await expect(page.getByText("Fully collected.")).toBeVisible();
    const { data: after } = await sb.from("orders").select("status, payment_status, amount_collected_paisa, total_due_paisa").eq("id", state.orderId!).single();
    expect(after).toMatchObject({ status: "delivered", payment_status: "collected", amount_collected_paisa: state.totalPaisa });
    const { data: cols } = await sb.from("cod_collections").select("amount_paisa, collector_ref").eq("order_id", state.orderId!);
    expect(cols).toEqual([{ amount_paisa: state.totalPaisa, collector_ref: `rider-${RUN}` }]);
    step(21, { collections: cols });

    const { data: events } = await sb.from("order_events").select("to_status").eq("order_id", state.orderId!).order("created_at"); // 22
    const statuses = events!.map((e) => e.to_status).filter(Boolean);
    for (const s of transitions) expect(statuses).toContain(s);
    const { count: audits } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("entity_id", state.orderId!);
    expect(audits).toBeGreaterThanOrEqual(transitions.length + 1);
    await page.goto(state.orderUrl!);
    await expect(page.getByTestId("order-status")).toHaveText("Delivered");
    await expect(page.getByText("Paid — cash collected")).toBeVisible();
    step(22, { order: after, statusEvents: statuses, auditRows: audits });
  });

  test("23–27: review, blog, reel, editorial badge, genuine sales indicators", async ({ page, browser }) => {
    await page.goto(`/products/${HANDLE}`); // 23
    const box = page.getByTestId("pdp-reviews");
    await box.getByRole("button", { name: "Write a review" }).click();
    await box.getByLabel("5 out of 5").check({ force: true });
    await box.getByLabel("Your name").fill(REVIEWER);
    await box.getByLabel("Your review", { exact: true }).fill("Arrived on time, battery and keyboard as described, no marks on the screen.");
    await box.getByRole("button", { name: "Submit review" }).click();
    await expect(box.getByTestId("review-sent")).toBeVisible();
    await signIn(page, "owner");
    await page.goto("/admin/reviews");
    const row = page.getByTestId("review-row").filter({ hasText: REVIEWER });
    await row.getByRole("button", { name: "Approve" }).click();
    // Approving refreshes the Pending queue, so the row leaves it (how fast depends on the router); check the stored
    // status, that it left the queue, and that the Approved tab shows it as approved.
    await expect
      .poll(async () => (await sb.from("product_reviews").select("status").eq("author_name", REVIEWER).single()).data?.status)
      .toBe("approved");
    await expect(row).toHaveCount(0);
    await page.goto("/admin/reviews?status=approved");
    await expect(page.getByTestId("review-row").filter({ hasText: REVIEWER }).getByRole("button", { name: "Approve" })).toHaveAttribute("aria-pressed", "true");
    await page.goto(`/products/${HANDLE}`);
    await expect(page.getByTestId("pdp-reviews").getByTestId("review-summary")).toContainText("5.0 out of 5 · 1 review");
    const { data: rv } = await sb.from("product_reviews").select("status, rating").eq("author_name", REVIEWER).single();
    step(23, rv);

    await page.goto("/admin/blog/new"); // 24
    await page.getByLabel("Title", { exact: true }).fill(`QA acceptance guide ${RUN}`);
    await page.getByLabel("Web address").fill(POST_SLUG);
    await page.getByLabel("Summary").fill("Synthetic staging article proving the guides pages.");
    // Body: TipTap surface is the primary editor; type into it so the real author path is covered.
    const editor = page.getByTestId("blog-rich-editor");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.click();
    await page.keyboard.type("Look at the battery health and the keyboard first.");
    await page.getByLabel("Visible — published now").check();
    await page.getByRole("button", { name: "Create post" }).click();
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?saved=1$/);
    await expect(page.getByText("Post saved.").first()).toBeVisible();
    await page.goto(`/guides/${POST_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: `QA acceptance guide ${RUN}` })).toBeVisible();
    await page.goto("/guides");
    await expect(page.locator(`a[href="/guides/${POST_SLUG}"]`).first()).toBeVisible();
    await shot(page, "24-guides");
    step(24, { guide: `/guides/${POST_SLUG}`, listed: true });

    await page.route(/\/reels\/qa-acceptance-[^/]*\.webm/, (route) => // 25 (local stack has no storage service)
      route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync("tests/fixtures/reel-synthetic.webm") }),
    );
    await page.goto("/admin/reels");
    const form = page.getByTestId("reel-new-form");
    await form.getByLabel("Title").fill(REEL);
    await form.getByLabel("Video file link").fill(VIDEO);
    await form.getByLabel("Video rights").selectOption("owned");
    await form.getByLabel("Status").selectOption("published");
    await form.getByLabel("Linked product handle (optional)").fill(HANDLE);
    await form.getByRole("button", { name: "Add reel" }).click();
    await expect(form.getByText("Reel saved.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("reels-section").getByTestId("reel").filter({ hasText: REEL })).toBeVisible();
    await page.getByTestId("reels-section").screenshot({ path: `${OUT}/25-reel.png` });
    step(25, { reel: REEL, rights: "owned (synthetic test pattern)" });

    await page.goto("/admin/merchandising"); // 26
    const bf = page.getByTestId("badge-form");
    await bf.getByLabel("Product").fill(HANDLE);
    await bf.getByLabel("Label").selectOption("staff_pick");
    await bf.getByRole("button", { name: "Save label" }).click();
    await expect(bf.getByText("Label saved.")).toBeVisible();
    step(26, { label: "staff_pick" });

    // 27: automatic indicators come only from real qualifying orders. The "Top seller" rule needs at least 2 units
    // (the schema refuses 1), so: one delivered unit → activity notice but no badge; a second real COD order placed
    // through checkout and delivered → badge.
    const on: SocialProofSettings = {
      ...DEFAULT_SOCIAL_PROOF,
      activity: { ...DEFAULT_SOCIAL_PROOF.activity, enabled: true, minStatus: "delivered", intervalSeconds: 10, displaySeconds: 8 },
      topSeller: { ...DEFAULT_SOCIAL_PROOF.topSeller, enabled: true, minStatus: "delivered", minUnits: 2 },
    };
    expect((await page.request.put("/api/admin/social-proof", { data: on })).status()).toBe(200);
    expect((await page.request.put("/api/admin/social-proof", { data: { ...on, topSeller: { ...on.topSeller, minUnits: 1 } } })).status()).toBe(400);
    let recent = await (await page.request.get("/api/activity/recent")).json();
    expect(recent.items.some((i: { handle: string }) => i.handle === HANDLE)).toBe(true);
    expect(JSON.stringify(recent)).not.toMatch(/Acceptance Buyer|03001234567|Gulberg/);
    await page.goto(`/products/${HANDLE}`);
    let kinds = await page.getByTestId("merch-badge").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
    expect(kinds).not.toContain("top_seller"); // one unit is below the rule
    expect(kinds).toContain("staff_pick");

    const second = await page.request.post("/api/checkout/cod", {
      headers: { origin: "http://127.0.0.1:3001" },
      data: {
        idempotencyKey: `acc-second-${RUN}`, customerName: "Second Buyer", customerPhone: "03007654321", shippingZoneId: fx.zone.id, confirmCod: true,
        address: { line1: "House 3, Street 9, Johar Town", city: "Lahore", province: "Punjab" },
        lines: [{ variantId: state.variants[state.soldRam!], quantity: 1 }],
      },
    });
    expect(second.status()).toBe(200);
    const { orderNumber: n2 } = await second.json();
    for (const to of ["confirmed", "packing", "shipped", "out_for_delivery", "delivered"]) {
      const r = await page.request.post(`/api/admin/orders/${n2}/status`, { headers: { origin: "http://127.0.0.1:3001" }, data: { toStatus: to } });
      expect(r.status(), to).toBe(200);
    }
    expect((await page.request.put("/api/admin/social-proof", { data: { ...on, activity: { ...on.activity, intervalSeconds: 11 } } })).status()).toBe(200); // expires caches
    recent = await (await page.request.get("/api/activity/recent")).json();
    await page.goto(`/products/${HANDLE}`);
    kinds = await page.getByTestId("merch-badge").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
    // One badge per product: the data-backed "Top seller" takes precedence over the editorial label.
    expect(kinds).toEqual(["top_seller"]);
    // The notice is capped per browser session (maxPerSession); this long scenario has already used that session on
    // earlier pages, so whether the cap is reached depended on timing. Check it as a new shopper would see it.
    const shopper = await browser.newContext({ baseURL: page.url().replace(/\/products\/.*$/, "") });
    const sp = await shopper.newPage();
    await sp.goto(`/products/${HANDLE}`);
    await expect(sp.getByTestId("purchase-activity")).toBeVisible({ timeout: 15_000 });
    await expect(sp.getByTestId("purchase-activity")).not.toHaveText(/paid|bought|purchased/i);
    await shot(sp, "27-badges-activity");
    await shopper.close();
    step(27, { secondOrder: n2, badgesAfterTwoDeliveredUnits: kinds, oneUnitBadge: false, recentActivity: recent.items.filter((i: { handle: string }) => i.handle === HANDLE) });
  });

  test("28–32: theme editor — change a section, draft, preview, publish, roll back", async ({ page, browser }) => {
    page.on("dialog", (d) => d.accept());
    await signIn(page, "owner");
    const { data: pubRow } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
    state.hadPublication = Boolean(pubRow);
    await page.goto("/admin/online-store", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: /cinematic hero/i }).first().click({ timeout: 30_000 });
    const main = page.getByTestId("theme-image-mainImageUrl");
    await expect(main).toBeVisible();
    if (!pubRow) {
      // Fresh database: publish the current homepage as-is first, so there is a version to roll back to.
      await page.getByTestId("theme-save-draft").click();
      await expect(page.getByText(/draft saved/i)).toBeVisible();
      await page.getByTestId("theme-publish").click();
      await expect(page.getByTestId("theme-notice")).toContainText(/Published immutable snapshot/i);
    }
    const { data: base } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").single();
    state.baselineThemeId = base!.published_version_id;
    const pub0 = await publicContext(browser);
    const before = await heroMainSrc(pub0.page);
    await pub0.ctx.close();
    expect(before).not.toContain("laptop-hub-hero-lenovo-lap");

    await page.goto("/admin/online-store"); // 28–29
    await page.getByRole("button", { name: /cinematic hero/i }).first().click();
    await page.getByTestId("theme-image-mainImageUrl").fill(HERO_B);
    await page.getByTestId("theme-save-draft").click();
    await expect(page.getByText(/draft saved/i)).toBeVisible();
    const pub1 = await publicContext(browser);
    expect(await heroMainSrc(pub1.page)).toBe(before); // draft is not public
    await pub1.ctx.close();
    step(29, { draftHero: HERO_B, publicStill: before });

    const popup = page.waitForEvent("popup"); // 30
    await page.getByTestId("theme-open-preview").click();
    const preview = await popup;
    await expect(preview.getByText(/draft preview only/i)).toBeVisible();
    await expect(preview.locator(`img[src*="laptop-hub-hero-lenovo-lap"]`).first()).toBeVisible();
    await shot(preview, "30-theme-preview");
    await preview.close();
    step(30, { preview: "draft visible to staff only" });

    await expect(page.getByTestId("theme-publish")).toBeEnabled(); // 31
    await page.getByTestId("theme-publish").click();
    await expect(page.getByTestId("theme-notice")).toContainText(/Published immutable snapshot/i);
    const pub2 = await publicContext(browser);
    expect(await heroMainSrc(pub2.page)).toContain("laptop-hub-hero-lenovo-lap");
    await pub2.ctx.close();
    const { data: published } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").single();
    expect(published!.published_version_id).not.toBe(state.baselineThemeId);
    step(31, { publishedVersion: published!.published_version_id });

    await page.goto("/admin/online-store"); // 32
    await page.getByTestId(`theme-rollback-${state.baselineThemeId}`).click();
    await expect(page.getByTestId("theme-notice")).toContainText(/[Rr]oll/i);
    const pub3 = await publicContext(browser);
    expect(await heroMainSrc(pub3.page)).toBe(before);
    await pub3.ctx.close();
    const { data: rolled } = await sb.from("theme_publications").select("published_version_id").eq("template_key", "homepage").single();
    step(32, { rolledBackTo: rolled!.published_version_id, baseline: state.baselineThemeId, publicHero: before });
  });

  test("33–34: restricted employee is refused prohibited actions", async ({ page }) => {
    await signIn(page, "fulfillment"); // 33
    await page.goto("/admin/orders");
    await expect(page.getByRole("link", { name: state.orderNumber! })).toBeVisible(); // allowed: the order desk
    const refused: Record<string, number | string> = {};
    for (const path of ["/admin/products", "/admin/settings", "/admin/online-store", "/admin/staff", "/admin/inventory"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/forbidden/);
      refused[path] = "forbidden";
    }
    const stockBefore = (await sb.from("product_variants").select("quantity_on_hand").eq("id", state.variants["8GB"]).single()).data!.quantity_on_hand;
    const api: [string, string, unknown][] = [
      ["POST", "/api/admin/products", { title: "x", pricePkr: 1 }],
      ["PUT", `/api/admin/products/${HANDLE}/variants`, { variants: [] }],
      ["POST", "/api/admin/theme/homepage/publish", { confirmPublish: true }],
      ["PUT", "/api/admin/social-proof", DEFAULT_SOCIAL_PROOF],
      ["POST", "/api/admin/staff", { email: "x@lh-test.local", role: "owner" }],
      ["POST", "/api/admin/inventory/adjust", { variantId: state.variants["8GB"], mode: "delta", amount: 5, reason: "other" }],
    ];
    for (const [method, url, data] of api) {
      const r = await page.request.fetch(url, { method, data, headers: { origin: "http://127.0.0.1:3001" } });
      expect(r.status(), `${method} ${url}`).toBe(403);
      refused[`${method} ${url}`] = r.status();
    }
    const { data: v } = await sb.from("product_variants").select("quantity_on_hand").eq("id", state.variants["8GB"]).single();
    expect(v!.quantity_on_hand).toBe(stockBefore); // nothing changed
    step(33, { role: "fulfillment" });
    step(34, refused);
  });

  test("35: mobile storefront and admin layouts", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const checks: Record<string, boolean> = {};
    for (const path of ["/", `/products/${HANDLE}`, `/collections/${state.collectionSlug}`, "/checkout", state.orderUrl!]) {
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      checks[path] = await noOverflow(page);
    }
    await page.goto(`/products/${HANDLE}`);
    await shot(page, "35-mobile-pdp");
    await signIn(page, "manager");
    for (const path of ["/admin", "/admin/orders", `/admin/orders/${state.orderNumber}`, "/admin/inventory", `/admin/products/${HANDLE}`]) {
      await page.goto(path);
      await expect(page.locator("#admin-main")).toBeVisible();
      checks[path] = await noOverflow(page);
    }
    await page.goto(`/admin/orders/${state.orderNumber}`);
    await shot(page, "35-mobile-admin-order");
    await ctx.close();
    expect(Object.entries(checks).filter(([, ok]) => !ok)).toEqual([]);
    step(35, { viewport: "390x844", noHorizontalOverflow: checks });
  });

  test("36: nothing outside the isolated stack was touched", async () => {
    // Every write in this run went to the loopback Supabase and the stand-in mail provider; the guard refuses anything else.
    expect(SB_URL).toMatch(LOOPBACK);
    expect(evidence.app as string).toMatch(LOOPBACK);
    const log = (await (await fetch(`${FAKE}/_log`)).json()) as { delivered: { to: string[] }[] };
    expect(log.delivered.every((d) => d.to.every((t) => t.endsWith("@lh-test.local")))).toBe(true);
    step(36, {
      supabase: SB_URL,
      app: evidence.app,
      emailRecipients: [...new Set(log.delivered.flatMap((d) => d.to))],
      production: "checked separately, read-only: see docs/LAPTOPS_HUB_STAGING_CERTIFICATION_REPORT.md §production-untouched",
    });
  });
});
