/**
 * P1 social proof on the ISOLATED stack: recent-order notices, data-backed "Top seller", editorial labels, and the reels
 * player (muted autoplay of the visible reel, explicit sound, reduced motion). Proves the zero-data baseline shows
 * nothing, then that only real confirmed orders produce notices/badges, with no personal data in the payload.
 * Everything created here is removed in afterAll and the social_proof setting is restored.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { DEFAULT_SOCIAL_PROOF, type SocialProofSettings } from "../../src/lib/content/social-proof";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [P0, P1] = fx.products as { handle: string; title: string; pricePaisa: number; variantId: string }[];
const OUT = "test-results/p1-evidence";
const RUN = Date.now().toString(36);
const VIDEO = `http://127.0.0.1:54321/storage/v1/object/public/reels/qa-social-${RUN}.webm`;
const CLIP = fs.readFileSync("tests/fixtures/reel-synthetic.webm"); // original synthetic test pattern (no third-party media)
const PRIVATE_NAME = `SANDBOX Buyer ${RUN}`;

let savedSetting: unknown = null;
const createdOrders: string[] = [];
let stashedDeliveredOrders: { id: string; status: string }[] = [];

async function signIn(page: Page, who: "owner" | "editor" = "owner") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[who].email);
  await page.getByLabel("Password").fill(fx.staff[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}

/** Notices and top sellers counted from DELIVERED orders only, so leftovers from other isolated suites (shipped/placed) never interfere. */
const ON: SocialProofSettings = {
  ...DEFAULT_SOCIAL_PROOF,
  activity: { ...DEFAULT_SOCIAL_PROOF.activity, enabled: true, minStatus: "delivered", intervalSeconds: 10, displaySeconds: 8 },
  topSeller: { ...DEFAULT_SOCIAL_PROOF.topSeller, enabled: true, minStatus: "delivered", minUnits: 3 },
};

async function putSettings(page: Page, s: SocialProofSettings) {
  const res = await page.request.put("/api/admin/social-proof", { data: s });
  expect(res.status(), await res.text()).toBe(200);
}

async function order(status: string, handle: string, title: string, qty: number, unit: number) {
  const n = `LH-SANDBOX-SP-${RUN}-${createdOrders.length}`;
  const { data, error } = await sb
    .from("orders")
    .insert({
      order_number: n,
      status,
      customer_name: PRIVATE_NAME,
      customer_phone_e164: "+923001112233",
      customer_phone_normalized: "3001112233",
      subtotal_paisa: unit * qty,
      total_due_paisa: unit * qty,
      idempotency_key: `sandbox-sp-${n}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdOrders.push(data!.id);
  await sb.from("order_addresses").insert({ order_id: data!.id, line1: "SANDBOX street 1", city: "lahore", province: "Punjab" });
  await sb.from("order_items").insert({ order_id: data!.id, handle, title_snapshot: title, unit_price_paisa: unit, quantity: qty, line_total_paisa: unit * qty });
}

async function cleanup() {
  for (const id of createdOrders.splice(0)) await sb.from("orders").delete().eq("id", id);
  await sb.from("orders").delete().like("order_number", "LH-SANDBOX-SP-%");
  await sb.from("reels").delete().like("title", "QA social reel %");
  const { data: prods } = await sb.from("products").select("id").in("handle", [P0.handle, P1.handle]);
  for (const p of prods || []) await sb.from("product_badges").delete().eq("product_id", p.id);
}

test.describe.serial("P1: truthful social proof (isolated)", () => {
  test.beforeAll(async () => {
    await assertLocalOnly("social proof journeys");
    fs.mkdirSync(OUT, { recursive: true });
    await cleanup();
    const { data: existingDelivered } = await sb.from("orders").select("id, status").eq("status", "delivered");
    if (existingDelivered && existingDelivered.length > 0) {
      stashedDeliveredOrders = existingDelivered;
      await sb.from("orders").update({ status: "shipped" }).in("id", existingDelivered.map((o) => o.id));
    }
    const { data } = await sb.from("store_settings").select("value").eq("key", "social_proof").maybeSingle();
    savedSetting = data?.value ?? null;
  });
  test.afterAll(async () => {
    await cleanup();
    if (stashedDeliveredOrders.length > 0) {
      for (const o of stashedDeliveredOrders) {
        await sb.from("orders").update({ status: o.status }).eq("id", o.id);
      }
    }
    if (savedSetting === null) await sb.from("store_settings").delete().eq("key", "social_proof");
    else await sb.from("store_settings").update({ value: savedSetting }).eq("key", "social_proof");
  });

  test("zero qualifying orders: features on, yet no notice and no top-seller badge", async ({ page }) => {
    await signIn(page);
    // Unqualified orders only (placed / cancelled / shipped) — they must never count.
    await order("placed", P0.handle, P0.title, 5, P0.pricePaisa);
    await order("cancelled", P0.handle, P0.title, 5, P0.pricePaisa);
    await order("shipped", P0.handle, P0.title, 5, P0.pricePaisa);
    await putSettings(page, ON);

    const api = await page.request.get("/api/activity/recent");
    expect((await api.json()).items).toEqual([]);

    await page.goto("/admin/merchandising");
    await expect(page.getByTestId("qualifying-orders")).toHaveText("0");
    await expect(page.getByTestId("top-seller-count")).toHaveText("0");

    await page.goto(`/products/${P0.handle}`);
    await page.waitForTimeout(9_500);
    await expect(page.getByTestId("purchase-activity")).toHaveCount(0);
    await expect(page.getByTestId("merch-badge")).toHaveCount(0);
  });

  test("real confirmed orders: anonymous notice + data-backed top seller; no personal data", async ({ page }) => {
    await signIn(page);
    await order("delivered", P0.handle, P0.title, 2, P0.pricePaisa);
    await order("delivered", P0.handle, P0.title, 1, P0.pricePaisa);
    await order("delivered", P1.handle, P1.title, 1, P1.pricePaisa); // below the 3-unit rule
    await order("shipped", P1.handle, P1.title, 9, P1.pricePaisa); // not delivered: never counts
    // Saving settings expires the social-proof caches.
    await putSettings(page, { ...ON, activity: { ...ON.activity, intervalSeconds: 11 } });

    const res = await page.request.get("/api/activity/recent");
    const raw = await res.text();
    const { items } = JSON.parse(raw);
    expect(items.length).toBe(2);
    for (const it of items) expect(Object.keys(it).sort()).toEqual(["city", "handle", "imageUrl", "title", "when"]);
    expect(items.some((i: { handle: string }) => i.handle === P0.handle)).toBe(true);
    expect(items.some((i: { handle: string }) => i.handle === P1.handle)).toBe(true);
    expect(items.every((i: { city: unknown }) => i.city === null)).toBe(true);
    expect(raw).not.toContain(PRIVATE_NAME);
    expect(raw).not.toMatch(/3001112233|LH-SANDBOX|SANDBOX street|lahore/i);

    await page.goto("/admin/merchandising");
    await expect(page.getByTestId("qualifying-orders")).toHaveText("3");
    await expect(page.getByTestId("social-proof-status")).toContainText(P0.handle);
    await expect(page.getByTestId("top-seller-count")).toHaveText("1");

    await page.goto(`/products/${P0.handle}`);
    const badge = page.getByTestId("merch-badge").first();
    await expect(badge).toHaveAttribute("data-kind", "top_seller");
    await expect(badge).toHaveText(/Top seller/i);
    const toast = page.getByTestId("purchase-activity");
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toHaveText(/^A customer ordered .+ (today|yesterday|this week|recently)×?$/);
    await expect(toast).not.toHaveText(/paid|bought|purchased/i);
    await page.screenshot({ path: `${OUT}/social-proof-pdp.png` });

    // Dismiss stops notices for the session.
    await toast.getByRole("button", { name: "Hide recent order notices" }).click();
    await expect(toast).toHaveCount(0);
    await page.waitForTimeout(11_000);
    await expect(page.getByTestId("purchase-activity")).toHaveCount(0);

    // Never on checkout.
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/checkout");
    await page.waitForTimeout(9_500);
    await expect(page.getByTestId("purchase-activity")).toHaveCount(0);
  });

  test("editorial label: set in admin, shown with its own look; sales claims cannot be set", async ({ page }) => {
    await signIn(page, "editor");
    await page.goto("/admin/merchandising");
    await expect(page.getByTestId("social-proof-form")).toHaveCount(0); // editors manage labels, not settings
    const form = page.getByTestId("badge-form");
    await form.getByLabel("Product").fill(P1.handle);
    await form.getByLabel("Label").selectOption("popular_pick");
    await form.getByRole("button", { name: "Save label" }).click();
    await expect(form.getByText("Label saved.")).toBeVisible();
    await expect(page.getByTestId("badge-row").filter({ hasText: P1.handle })).toContainText("Showing");

    const forged = await page.request.put("/api/admin/product-badges", { data: { productHandle: P1.handle, kind: "top_seller" } });
    expect(forged.status()).toBe(400);
    const settingsAsEditor = await page.request.put("/api/admin/social-proof", { data: DEFAULT_SOCIAL_PROOF });
    expect(settingsAsEditor.status()).toBe(403);

    await page.goto(`/products/${P1.handle}`);
    const badge = page.getByTestId("merch-badge").first();
    await expect(badge).toHaveAttribute("data-kind", "popular_pick");
    await expect(badge).toHaveText(/Popular pick/i);

    const { data: audit } = await sb.from("audit_logs").select("id").eq("action", "product_badge.create").order("created_at", { ascending: false }).limit(1);
    expect(audit?.length).toBe(1);
  });

  test("reels: visible reel autoplays muted, one at a time; sound only on request; reduced motion waits", async ({ page, browser }) => {
    await signIn(page);
    const base = { video_url: VIDEO, rights_status: "owned", status: "published", sort_order: -500 };
    const ins = await sb.from("reels").insert([
      { ...base, title: `QA social reel A ${RUN}`, creator_name: "QA Creator", creator_consent: true, tag: "Productivity" },
      { ...base, title: `QA social reel B ${RUN}`, sort_order: -499, creator_name: "", creator_consent: false, tag: "" },
    ]);
    expect(ins.error).toBeNull();
    await putSettings(page, { ...DEFAULT_SOCIAL_PROOF, reels: { heading: `Generation QA ${RUN}`, autoplayMuted: true } });
    // Reel caches expire on admin reel changes; poke one through the API so the direct inserts become visible.
    const { data: rowA } = await sb.from("reels").select("id, title, caption, video_url, rights_status, rights_note, sort_order, status").like("title", "QA social reel A %").single();
    await page.request.put(`/api/admin/reels/${rowA!.id}`, {
      data: { title: rowA!.title, videoUrl: VIDEO, rightsStatus: "owned", status: "published", sortOrder: -500, creatorName: "QA Creator", creatorConsent: true, tag: "Productivity" },
    });

    const serve = async (p: Page) =>
      p.route(/qa-social-.*.webm/, (route) => route.fulfill({ status: 200, contentType: "video/webm", body: CLIP }));
    await serve(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const section = page.getByTestId("reels-section");
    await expect(section.getByRole("heading", { name: `Generation QA ${RUN}` })).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    const videos = section.getByTestId("reel-video");
    await expect(section.getByText("QA Creator")).toBeVisible();
    await expect(section.getByText("#Productivity")).toBeVisible();

    await expect
      .poll(async () => videos.evaluateAll((els) => (els as HTMLVideoElement[]).filter((v) => !v.paused).length), { timeout: 15_000 })
      .toBe(1);
    expect(await videos.evaluateAll((els) => (els as HTMLVideoElement[]).every((v) => v.muted))).toBe(true);
    expect(await videos.evaluateAll((els) => (els as HTMLVideoElement[]).map((v) => v.preload))).toEqual(expect.arrayContaining(["none"]));

    // Sound on for the second reel: it plays unmuted, the first stops.
    const reelB = section.getByTestId("reel").filter({ hasText: `QA social reel B ${RUN}` });
    await reelB.getByTestId("reel-sound").click();
    await expect.poll(async () => reelB.getByTestId("reel-video").evaluate((v: HTMLVideoElement) => !v.paused && !v.muted)).toBe(true);
    expect(await videos.evaluateAll((els) => (els as HTMLVideoElement[]).filter((v) => !v.paused).length)).toBe(1);
    await expect(reelB.getByTestId("reel-sound")).toHaveAttribute("aria-pressed", "true");
    await section.screenshot({ path: `${OUT}/reels-playing.png` });

    // Reduced motion: nothing starts by itself; the play button works.
    const ctx = await browser.newContext({ reducedMotion: "reduce", baseURL: page.url().replace(/\/$/, "") });
    const rm = await ctx.newPage();
    await serve(rm);
    await rm.goto("/");
    const rmSection = rm.getByTestId("reels-section");
    await rmSection.scrollIntoViewIfNeeded();
    await rm.waitForTimeout(2_500);
    const rmVideos = rmSection.getByTestId("reel-video");
    expect(await rmVideos.evaluateAll((els) => (els as HTMLVideoElement[]).filter((v) => !v.paused).length)).toBe(0);
    await rmSection.getByTestId("reel").first().getByTestId("reel-play").click();
    await expect.poll(async () => rmVideos.evaluateAll((els) => (els as HTMLVideoElement[]).filter((v) => !v.paused).length)).toBe(1);
    await ctx.close();
  });

  test("broken video shows an unavailable state instead of a dead player", async ({ page }) => {
    await page.route(/qa-social-.*.webm/, (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/");
    const section = page.getByTestId("reels-section");
    await section.scrollIntoViewIfNeeded();
    await section.getByTestId("reel").first().getByTestId("reel-play").click().catch(() => null);
    await expect(section.getByText("This video is not available right now.").first()).toBeVisible({ timeout: 15_000 });
  });
});
