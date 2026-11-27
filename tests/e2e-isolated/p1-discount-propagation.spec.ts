/**
 * Discount propagation on the ISOLATED stack: a storewide campaign created and activated in Admin → Discounts changes
 * the product page price, the announcement bar and the server checkout quote for a shopper; disabling it puts every
 * one of them back. Other campaigns are paused for the run and restored afterwards; the QA campaign is deleted.
 */
import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";
import { ORIGIN } from "./helpers/origin";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated tests need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const NAME = `QA propagation ${RUN}`;
const BANNER = `QA sale ${RUN} twelve percent`;
const PCT = 12;
const PRODUCT = fx.products[0] as { handle: string; variantId: string };
const pkr = (paisa: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(paisa / 100);

let paused: { id: string; status: string }[] = [];
let listPaisa = 0;

async function quoteSubtotal(browser: Browser): Promise<{ subtotal: number; savings: number }> {
  const ctx = await browser.newContext({ baseURL: ORIGIN });
  const r = await ctx.request.post("/api/checkout/quote", {
    headers: { origin: ORIGIN },
    data: { address: { city: "Lahore", province: "Punjab" }, lines: [{ variantId: PRODUCT.variantId, quantity: 1 }] },
  });
  const j = await r.json();
  await ctx.close();
  expect(j.ok, JSON.stringify(j)).toBe(true);
  return { subtotal: j.quote.subtotalPaisa, savings: j.quote.merchandiseSavingsPaisa };
}

async function shopperSees(browser: Browser, text: string, present: boolean) {
  const ctx = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await expect
    .poll(
      async () => {
        await page.goto(`/products/${PRODUCT.handle}`);
        // Intl may emit a no-break space after "Rs"; compare with all whitespace as plain spaces on both sides.
        const norm = (s: string) => s.replace(/\s/g, " ");
        return norm(await page.locator("body").innerText()).includes(norm(text));
      },
      { timeout: 20_000, intervals: [500, 1000, 2000] },
    )
    .toBe(present);
  await ctx.close();
}

test.describe.serial("Discount propagation (isolated)", () => {
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    await assertLocalOnly("discount propagation");
    const { data: live } = await sb.from("discount_campaigns").select("id, status").in("status", ["active", "scheduled"]);
    paused = live ?? [];
    if (paused.length) await sb.from("discount_campaigns").update({ status: "disabled" }).in("id", paused.map((c) => c.id));
    const { data: v } = await sb.from("product_variants").select("price_paisa").eq("id", PRODUCT.variantId).single();
    listPaisa = v!.price_paisa;
  });

  test.afterAll(async () => {
    await sb.from("discount_campaigns").delete().like("name", `QA propagation ${RUN}%`);
    for (const c of paused) await sb.from("discount_campaigns").update({ status: c.status }).eq("id", c.id);
  });

  test("activate in Admin → PDP price, announcement and checkout quote change; disable → all revert", async ({ browser }) => {
    const selling = Math.round((listPaisa * (100 - PCT)) / 100);
    // Baseline with no campaign live.
    expect(await quoteSubtotal(browser)).toEqual({ subtotal: listPaisa, savings: 0 });
    await shopperSees(browser, BANNER, false);

    const ctx = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(fx.staff.owner.email);
    await page.getByLabel("Password").fill(fx.staff.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
    await page.goto("/admin/discounts");
    await page.getByRole("button", { name: "Create discount" }).click();
    await page.getByLabel("Name").fill(NAME);
    await page.getByLabel(/^Value/).fill(String(PCT));
    await page.getByLabel("Announcement bar text").fill(BANNER);
    await page.getByLabel("Show storefront announcement").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit campaign" })).toBeVisible();
    // Saved as a draft: nothing public changes yet.
    expect(await quoteSubtotal(browser)).toEqual({ subtotal: listPaisa, savings: 0 });

    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByRole("button", { name: "Disable" })).toBeVisible();
    await expect.poll(async () => (await sb.from("discount_campaigns").select("status").eq("name", NAME).single()).data?.status).toBe("active");

    // Shopper: server quote, announcement bar and the product page price all follow.
    expect(await quoteSubtotal(browser)).toEqual({ subtotal: selling, savings: listPaisa - selling });
    await shopperSees(browser, BANNER, true);
    await shopperSees(browser, pkr(selling), true);

    // Disable from Admin → everything returns to the list price.
    await page.getByRole("button", { name: "Disable" }).click();
    await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();
    expect(await quoteSubtotal(browser)).toEqual({ subtotal: listPaisa, savings: 0 });
    await shopperSees(browser, BANNER, false);
    await shopperSees(browser, pkr(selling), false);
    await ctx.close();
  });
});
