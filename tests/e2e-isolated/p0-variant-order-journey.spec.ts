/**
 * P0: the variant the shopper selects is the variant that is quoted, ordered, stocked and restocked.
 * Merchant API (owner session) creates a 2-option laptop and a multi-variant product without option data; the
 * customer selects an exact variant on the PDP, checks out with COD, and the order item, stock and ledger are checked
 * in the database. Forged/sold-out/over-limit variants, the last-unit race and cancellation restock are covered too.
 * ISOLATED stack only (local Supabase + app on 127.0.0.1:3001 + fake email provider) — docs/ISOLATED_TESTS.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs";
import { formatPkr } from "../../src/lib/money";
import { fmtPkr } from "../../src/lib/catalog/v5-model";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SB_URL)) throw new Error("isolated journeys need a local Supabase");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const sb = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = randomUUID().slice(0, 6);
const ORIGIN = "http://127.0.0.1:3001";
const PHONE = "03001234567";
const FEES = fx.zone.flatFeePaisa + fx.zone.codFeePaisa;
const A = { handle: `qa-variant-laptop-${RUN}`, title: `QA Variant Laptop ${RUN}` };
const B = { handle: `qa-bare-variants-${RUN}`, title: `QA Bare Variants ${RUN}` };
type V = { id: string; title: string; sku: string; price_paisa: number; option_values: Record<string, string>; quantity_on_hand: number | null };
const vA: Record<string, V> = {};
const vB: V[] = [];
const orders: string[] = [];
let placedOrder = "";

async function signIn(page: Page, role: "owner" | "manager") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(fx.staff[role].email);
  await page.getByLabel("Password").fill(fx.staff[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(\?|$|\/(?!login))/);
}
const variantRows = async (handle: string) => {
  const { data: p } = await sb.from("products").select("id").eq("handle", handle).single();
  return ((await sb.from("product_variants").select("id, title, sku, price_paisa, option_values, quantity_on_hand").eq("product_id", p!.id).order("position")).data || []) as V[];
};
const cartLines = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("lh-cart-v1") || '{"lines":[]}').lines as { variantId: string; unitPricePaisa: number; quantity: number; config?: string; sku?: string }[]);
const apiOrder = (page: Page, lines: { variantId: string; quantity: number }[], key = `variant-${RUN}-${randomUUID()}`) =>
  page.request.post("/api/checkout/cod", {
    headers: { origin: ORIGIN },
    data: { idempotencyKey: key, customerName: "Variant Test", customerPhone: PHONE, shippingZoneId: fx.zone.id, confirmCod: true, address: { line1: "House 9, Test Road", city: fx.zone.city, province: fx.zone.province }, lines },
  });

test.describe.serial("P0: exact variant from PDP to COD order (isolated)", () => {
  let prevTracking: unknown = null;

  test.beforeAll(async () => {
    await assertLocalOnly("variant order journey");
    prevTracking = (await sb.from("store_settings").select("value").eq("key", "inventory_tracking").maybeSingle()).data?.value ?? null;
    await sb.from("store_settings").upsert({
      key: "inventory_tracking",
      value: { ...(typeof prevTracking === "object" && prevTracking ? prevTracking : {}), enabled: true },
    });
  });

  test.afterAll(async () => {
    if (prevTracking) await sb.from("store_settings").upsert({ key: "inventory_tracking", value: prevTracking });
    for (const handle of [A.handle, B.handle]) {
      const { data: p } = await sb.from("products").select("id").eq("handle", handle).maybeSingle();
      if (!p) continue;
      const { data: items } = await sb.from("order_items").select("order_id").eq("product_id", p.id);
      const ids = [...new Set((items || []).map((i) => i.order_id))];
      if (ids.length) await sb.from("orders").delete().in("id", ids);
      const { data: vs } = await sb.from("product_variants").select("id").eq("product_id", p.id);
      if (vs?.length) await sb.from("inventory_ledger").delete().in("variant_id", vs.map((v) => v.id));
      await sb.from("products").delete().eq("id", p.id);
    }
  });

  test("merchant: owner creates a 2-option laptop and a variant product without option data (real admin API)", async ({ page }) => {
    await signIn(page, "owner");
    const create = async (p: { handle: string; title: string }) => {
      const r = await page.request.post("/api/admin/products", { headers: { origin: ORIGIN }, data: { title: p.title, handle: p.handle, status: "active", manufacturer: "Dell", category: "Laptop", productType: "Laptop", pricePkr: 1000 } });
      expect(r.status(), await r.text()).toBeLessThan(300);
    };
    await create(A);
    const put = await page.request.put(`/api/admin/products/${A.handle}/variants`, {
      headers: { origin: ORIGIN },
      data: {
        optionNames: ["RAM", "Storage"],
        variants: [
          { sku: `QA-${RUN}-8-256`, pricePkr: 85000, optionValues: { RAM: "8GB", Storage: "256GB" }, inventoryMode: "untracked", position: 1 },
          { sku: `QA-${RUN}-8-512`, pricePkr: 88000, optionValues: { RAM: "8GB", Storage: "512GB" }, inventoryMode: "tracked", quantityOnHand: 0, position: 2 },
          { sku: `QA-${RUN}-16-256`, pricePkr: 92000, optionValues: { RAM: "16GB", Storage: "256GB" }, inventoryMode: "tracked", quantityOnHand: 3, position: 3 },
          { sku: `QA-${RUN}-16-512`, pricePkr: 95000, optionValues: { RAM: "16GB", Storage: "512GB" }, inventoryMode: "tracked", quantityOnHand: 1, position: 4 },
        ],
      },
    });
    expect(put.status(), await put.text()).toBeLessThan(300);
    for (const v of await variantRows(A.handle)) vA[`${v.option_values.RAM}/${v.option_values.Storage}`] = v;
    expect(Object.keys(vA).sort()).toEqual(["16GB/256GB", "16GB/512GB", "8GB/256GB", "8GB/512GB"]);
    expect(vA["16GB/256GB"]).toMatchObject({ price_paisa: 9_200_000, quantity_on_hand: 3 });

    // Legacy/imported shape: several variants, no option_names and no option_values (only titles).
    await create(B);
    const { data: pb } = await sb.from("products").select("id").eq("handle", B.handle).single();
    await sb.from("product_variants").delete().eq("product_id", pb!.id);
    await sb.from("product_variants").insert([
      { product_id: pb!.id, title: "Grade A", sku: `QA-${RUN}-GA`, price_paisa: 6_000_000, option_values: {}, position: 1 },
      { product_id: pb!.id, title: "Grade B", sku: `QA-${RUN}-GB`, price_paisa: 6_500_000, option_values: {}, position: 2 },
    ]);
    // A catalog write through the API refreshes the storefront cache (tag "catalog").
    const touch = await page.request.patch(`/api/admin/products/${B.handle}`, { headers: { origin: ORIGIN }, data: { status: "active" } });
    expect(touch.status(), await touch.text()).toBeLessThan(300);
    vB.push(...(await variantRows(B.handle)));
    expect(vB.map((v) => v.title)).toEqual(["Grade A", "Grade B"]);
  });

  test("PDP: default is the first available variant; sold-out option is shown, selectable and not buyable", async ({ page }) => {
    await page.goto(`/products/${A.handle}`);
    await page.evaluate(() => localStorage.removeItem("lh-cart-v1"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(A.title);
    const ram = page.getByRole("radiogroup", { name: "RAM" });
    const storage = page.getByRole("radiogroup", { name: "Storage" });
    await expect(ram.getByRole("radio", { name: "8GB" })).toHaveAttribute("aria-checked", "true");
    await expect(storage.getByRole("radio", { name: "256GB" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("pdp-price")).toHaveText(formatPkr(8_500_000));
    await expect(page.getByRole("button", { name: `Add to cart · ${fmtPkr(8_500_000)}` })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "RAM" }).getByRole("radio", { name: "16GB" })).toHaveAttribute("data-state", "available");
    // 8GB/512GB has 0 tracked units → announced and styled as sold out.
    const sold = storage.getByRole("radio", { name: "512GB, sold out" });
    await expect(sold).toHaveAttribute("data-state", "soldout");
    await sold.click();
    await expect(sold).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("pdp-price")).toHaveText(formatPkr(8_800_000));
    await expect(page.getByTestId("pdp-sold-out")).toHaveText("This option is sold out.");
    await expect(page.getByRole("button", { name: /^Add to cart · / })).toHaveCount(0);
    // Structured data is a price range, not the default variant's price.
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(ld.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "85000.00", highPrice: "95000.00", offerCount: 4 });
  });

  // Shopper path on the PDP: 8GB/256GB (default) → RAM 16GB → Storage 512GB → Storage 256GB → add to cart.
  async function choose16x256AndAdd(page: Page) {
    await page.goto(`/products/${A.handle}`);
    await page.evaluate(() => localStorage.removeItem("lh-cart-v1"));
    await page.reload();
    await page.getByRole("radiogroup", { name: "RAM" }).getByRole("radio", { name: "16GB" }).click();
    await expect(page.getByTestId("pdp-price")).toHaveText(formatPkr(9_200_000));
    await expect(page.getByTestId("pdp-sku")).toHaveText(`SKU: QA-${RUN}-16-256`);
    await page.getByRole("radiogroup", { name: "Storage" }).getByRole("radio", { name: "512GB" }).click();
    await expect(page.getByTestId("pdp-price")).toHaveText(formatPkr(9_500_000));
    await page.getByRole("radiogroup", { name: "Storage" }).getByRole("radio", { name: "256GB" }).click();
    const atc = page.getByRole("button", { name: `Add to cart · ${fmtPkr(9_200_000)}` });
    await expect(atc).toHaveAttribute("data-variant-id", vA["16GB/256GB"].id);
    await atc.click();
    const lines = await cartLines(page);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ variantId: vA["16GB/256GB"].id, unitPricePaisa: 9_200_000, quantity: 1, config: "16GB / 256GB", sku: `QA-${RUN}-16-256` });
  }

  test("PDP → cart: the selected variant (id, price, SKU, label) is what the cart holds", async ({ page }) => {
    await choose16x256AndAdd(page);
  });

  test("checkout: quote and committed COD order use exactly that variant; stock and ledger move once", async ({ page }) => {
    await choose16x256AndAdd(page);
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Variant Buyer");
    await page.getByLabel(/Mobile/).fill(PHONE);
    await page.getByLabel("Street address").fill("House 3, Street 4, Gulberg");
    await page.getByLabel("City").fill(fx.zone.city);
    await page.getByLabel("Province").selectOption(fx.zone.province);
    await page.getByRole("radio", { name: /Lahore standard \(test\)/ }).first().check();
    await expect(page.getByText(`Cash due: ${formatPkr(9_200_000 + FEES)}`)).toBeVisible();
    await page.getByRole("checkbox", { name: /I will pay the cash-due amount/ }).check();
    await page.getByRole("button", { name: "Place COD order" }).click();
    await page.waitForURL(/\/order\/success\//);
    await expect(page.getByTestId("order-total")).toHaveText(formatPkr(9_200_000 + FEES));
    placedOrder = (await page.locator("p", { hasText: /^LH-\d{6}-[0-9A-F]{6}$/ }).first().textContent())!.trim();
    orders.push(placedOrder);

    const { data: o } = await sb.from("orders").select("id, subtotal_paisa, total_due_paisa, status, payment_status, amount_collected_paisa").eq("order_number", placedOrder).single();
    expect(o).toMatchObject({ subtotal_paisa: 9_200_000, total_due_paisa: 9_200_000 + FEES, status: "placed", payment_status: "unpaid_cod", amount_collected_paisa: 0 });
    const { data: items } = await sb.from("order_items").select("variant_id, unit_price_paisa, quantity, variant_title_snapshot, sku_snapshot").eq("order_id", o!.id);
    expect(items).toEqual([{ variant_id: vA["16GB/256GB"].id, unit_price_paisa: 9_200_000, quantity: 1, variant_title_snapshot: "16GB / 256GB", sku_snapshot: `QA-${RUN}-16-256` }]);
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", vA["16GB/256GB"].id).single()).data!.quantity_on_hand).toBe(2);
    // Other variants untouched.
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", vA["16GB/512GB"].id).single()).data!.quantity_on_hand).toBe(1);
    const { data: ledger } = await sb.from("inventory_ledger").select("delta, quantity_after, reference_type").eq("variant_id", vA["16GB/256GB"].id).eq("reference_id", o!.id);
    expect(ledger).toEqual([{ delta: -1, quantity_after: 2, reference_type: expect.any(String) }]);
    expect((await cartLines(page)).length).toBe(0);
  });

  test("API: forged, sold-out, over-limit and unpublished variants are refused with shopper messages (no raw DB text)", async ({ page }) => {
    await page.goto("/");
    const forged = await apiOrder(page, [{ variantId: randomUUID(), quantity: 1 }]);
    expect(forged.status()).toBe(409);
    expect(await forged.json()).toMatchObject({ error: "variant_not_found", message: expect.stringMatching(/no longer available/) });
    const notUuid = await apiOrder(page, [{ variantId: "1; drop table orders", quantity: 1 }]);
    expect(notUuid.status()).toBe(400);
    expect((await notUuid.json()).error).toBe("validation_failed");
    const soldOut = await apiOrder(page, [{ variantId: vA["8GB/512GB"].id, quantity: 1 }]);
    expect(soldOut.status()).toBe(409);
    expect(await soldOut.json()).toMatchObject({ error: "insufficient_stock", message: expect.stringMatching(/sold out/) });
    const tooMany = await apiOrder(page, [{ variantId: vA["8GB/256GB"].id, quantity: 6 }]);
    expect(tooMany.status()).toBe(409);
    expect((await tooMany.json()).error).toBe("quantity_exceeds_limit");
    const moreThanStock = await apiOrder(page, [{ variantId: vA["16GB/256GB"].id, quantity: 3 }]);
    expect((await moreThanStock.json()).error).toBe("insufficient_stock");
    // The quote agrees with the order (no "available" quote for what checkout will refuse).
    const quote = await page.request.post("/api/checkout/quote", { headers: { origin: ORIGIN }, data: { address: { city: fx.zone.city, province: fx.zone.province }, shippingZoneId: fx.zone.id, lines: [{ variantId: vA["8GB/512GB"].id, quantity: 1 }] } });
    expect(quote.status()).toBe(409);
    expect((await quote.json()).error).toBe("insufficient_stock");
    // Unpublished product: variant exists but cannot be bought.
    await sb.from("products").update({ status: "draft" }).eq("handle", B.handle);
    const draft = await apiOrder(page, [{ variantId: vB[0].id, quantity: 1 }]);
    expect(draft.status()).toBe(409);
    expect((await draft.json()).error).toBe("product_not_purchasable");
    await sb.from("products").update({ status: "active" }).eq("handle", B.handle);
    for (const r of [forged, soldOut, tooMany, draft]) expect(JSON.stringify(await r.json())).not.toMatch(/violates|syntax|relation|constraint|uuid:/i);
  });

  test("last unit: two concurrent COD orders for the final 16GB/512GB unit → exactly one order", async ({ page }) => {
    await page.goto("/");
    const [r1, r2] = await Promise.all([apiOrder(page, [{ variantId: vA["16GB/512GB"].id, quantity: 1 }]), apiOrder(page, [{ variantId: vA["16GB/512GB"].id, quantity: 1 }])]);
    const statuses = [r1.status(), r2.status()].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = r1.status() === 409 ? await r1.json() : await r2.json();
    expect(loser.error).toBe("insufficient_stock");
    const winner = r1.status() === 200 ? await r1.json() : await r2.json();
    orders.push(winner.orderNumber);
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", vA["16GB/512GB"].id).single()).data!.quantity_on_hand).toBe(0);
  });

  test("PDP without option data lists each variant; the chosen one reaches the cart", async ({ page }) => {
    await page.goto(`/products/${B.handle}`);
    await page.evaluate(() => localStorage.removeItem("lh-cart-v1"));
    await page.reload();
    const group = page.getByRole("radiogroup", { name: "Option" });
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(group.getByRole("radio", { name: "Grade A" })).toHaveAttribute("aria-checked", "true");
    await group.getByRole("radio", { name: "Grade B" }).click();
    await expect(page.getByTestId("pdp-price")).toHaveText(formatPkr(6_500_000));
    await page.getByRole("button", { name: `Add to cart · ${fmtPkr(6_500_000)}` }).click();
    expect(await cartLines(page)).toMatchObject([{ variantId: vB[1].id, unitPricePaisa: 6_500_000, config: "Grade B" }]);
  });

  test("listing: a multi-variant card links to the option picker instead of adding an unchosen variant", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(A.title)}`);
    const card = page.locator("article", { hasText: A.title }).first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("card-choose-options")).toHaveAttribute("href", `/products/${A.handle}`);
    await expect(card.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
    await expect(card).toContainText(`From ${fmtPkr(8_500_000)}`);
  });

  test("merchant: cancelling the order restocks exactly the ordered variant, ledger records it, no cash recorded", async ({ page }) => {
    await signIn(page, "manager");
    await page.goto(`/admin/orders/${placedOrder}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(placedOrder);
    await expect(page.getByRole("button", { name: "Update status" })).toBeEnabled();
    await page.getByLabel("Next step").selectOption("cancelled");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(/Current:\s*cancelled/i)).toBeVisible();
    expect((await sb.from("product_variants").select("quantity_on_hand").eq("id", vA["16GB/256GB"].id).single()).data!.quantity_on_hand).toBe(3);
    const { data: o } = await sb.from("orders").select("id, payment_status, amount_collected_paisa").eq("order_number", placedOrder).single();
    expect(o).toMatchObject({ payment_status: "unpaid_cod", amount_collected_paisa: 0 });
    const { data: ledger } = await sb.from("inventory_ledger").select("delta").eq("variant_id", vA["16GB/256GB"].id).eq("reference_id", o!.id).order("created_at");
    expect(ledger!.map((l) => l.delta)).toEqual([-1, 1]);
    const { count } = await sb.from("cod_collections").select("id", { count: "exact", head: true }).eq("order_id", o!.id);
    expect(count).toBe(0);
  });
});
