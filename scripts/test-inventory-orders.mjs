/**
 * Order ↔ inventory integrity against a LOCAL Supabase only (refuses hosted URLs). Migration 20261117100000.
 * Seeds its own product, variants and zone; enables checkout in the LOCAL store_settings and restores it afterwards.
 *
 *   node scripts/test-inventory-orders.mjs        (with the isolated env from .env.local)
 *
 * Covers: one-off unit race (8 parallel buyers, qty 1), duplicate submits deduct once, ledger row per tracked line,
 * multi-line failure rolls back everything, untracked never touched, sold-out refused, oversell only when the
 * variant allows it, cancel-before-shipping restores once (repeat cancel refused, stock unchanged), cancel after a
 * failed delivery does not auto-restock, and status changes never re-deduct.
 */
import { randomUUID } from "crypto";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
await assertLocalOnly("test-inventory-orders", { url });
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const tag = Date.now().toString(36);
const PRICE = 9_000_000;
const product = must(await sb.from("products").insert({ handle: `inv-${tag}`, title: `INV TEST ${tag}`, status: "active", category: "Laptop" }).select("id").single(), "product");
const mk = async (o) => must(await sb.from("product_variants").insert({ product_id: product.id, price_paisa: PRICE, max_per_order: 5, ...o }).select("id").single(), "variant");
const oneOff = await mk({ sku: `INV-1-${tag}`, inventory_mode: "tracked", quantity_on_hand: 1 });
const five = await mk({ sku: `INV-5-${tag}`, inventory_mode: "tracked", quantity_on_hand: 5 });
const soldOut = await mk({ sku: `INV-0-${tag}`, inventory_mode: "tracked", quantity_on_hand: 0 });
const untracked = await mk({ sku: `INV-U-${tag}`, inventory_mode: "untracked" });
const oversell = await mk({ sku: `INV-O-${tag}`, inventory_mode: "tracked", quantity_on_hand: 0, allow_oversell: true });
const zone = must(await sb.from("shipping_zones").insert({ name: `INV zone ${tag}`, provinces: ["Sindh"], cities: [], flat_fee_paisa: 36_000, cod_fee_paisa: 5_000, is_active: true }).select("id").single(), "zone");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const actor = fx.staff.manager.id;

const prevCod = (await sb.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle()).data?.value ?? null;
must(await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true } }), "enable checkout (local only)");

const payload = (lines, o = {}) => ({
  idempotency_key: `inv-${randomUUID()}`,
  customer_name: "Inventory Test",
  customer_phone_e164: "+923001234567",
  customer_phone_normalized: "923001234567",
  shipping_zone_id: zone.id,
  address: { line1: "Test street 1", city: "Karachi", province: "Sindh" },
  lines,
  ...o,
});
const order = (p) => sb.rpc("create_cod_order", { payload: p });
const qoh = async (id) => (await sb.from("product_variants").select("quantity_on_hand").eq("id", id).single()).data?.quantity_on_hand;
const ledger = async (variantId) => (await sb.from("inventory_ledger").select("delta,quantity_after,reason,reference_id").eq("variant_id", variantId).order("created_at")).data || [];
const orderBy = async (key) => (await sb.from("orders").select("id,order_number,status").eq("idempotency_key", key).maybeSingle()).data;
const move = (orderNumber, to) => sb.rpc("transition_order_status", { payload: { actor_user_id: actor, order_number: orderNumber, to_status: to } });

try {
  // 1. One-off laptop: eight simultaneous buyers, exactly one order.
  {
    const rs = await Promise.all(Array.from({ length: 8 }, () => order(payload([{ variant_id: oneOff.id, quantity: 1 }]))));
    const ok = rs.filter((r) => !r.error).length;
    const refused = rs.filter((r) => (r.error?.message || "").includes("insufficient_stock")).length;
    const l = await ledger(oneOff.id);
    assert("one_off_race_exactly_one_order", ok === 1 && refused === 7, `ok=${ok} insufficient_stock=${refused}`);
    assert("one_off_stock_zero_not_negative", (await qoh(oneOff.id)) === 0, `qoh=${await qoh(oneOff.id)}`);
    assert("one_off_single_ledger_row", l.length === 1 && l[0].delta === -1 && l[0].quantity_after === 0 && l[0].reason === "order_placed", JSON.stringify(l));
  }

  // 2. Duplicate submits (same idempotency key ×6 in parallel) deduct once.
  const dup = payload([{ variant_id: five.id, quantity: 2 }]);
  {
    await Promise.all(Array.from({ length: 6 }, () => order(dup)));
    await order(dup); // browser retry after a timeout
    const l = (await ledger(five.id)).filter((x) => x.reason === "order_placed");
    assert("duplicate_submit_deducts_once", (await qoh(five.id)) === 3 && l.length === 1 && l[0].delta === -2, `qoh=${await qoh(five.id)} ledger=${l.length}`);
  }

  // 3. A multi-line order whose second line fails leaves no order, no stock change and no ledger row.
  {
    const before = await qoh(five.id);
    const ledgerBefore = (await ledger(five.id)).length;
    const p = payload([{ variant_id: five.id, quantity: 1 }, { variant_id: soldOut.id, quantity: 1 }]);
    const r = await order(p);
    assert("failed_order_rolls_back_everything",
      (r.error?.message || "").includes("insufficient_stock") && !(await orderBy(p.idempotency_key)) &&
      (await qoh(five.id)) === before && (await ledger(five.id)).length === ledgerBefore,
      `${r.error?.message} qoh=${await qoh(five.id)}/${before}`);
  }

  // 4. Sold-out tracked variant is refused; untracked is sold without touching stock or the ledger.
  {
    const r = await order(payload([{ variant_id: soldOut.id, quantity: 1 }]));
    assert("sold_out_refused", (r.error?.message || "").includes("insufficient_stock"), r.error?.message || "accepted");
    const u = await order(payload([{ variant_id: untracked.id, quantity: 3 }]));
    assert("untracked_sold_no_stock_or_ledger", !u.error && (await qoh(untracked.id)) === null && (await ledger(untracked.id)).length === 0, u.error?.message || "");
  }

  // 5. Oversell only where the merchant allowed it; the ledger records the negative balance.
  {
    const r = await order(payload([{ variant_id: oversell.id, quantity: 2 }]));
    const l = await ledger(oversell.id);
    assert("oversell_allowed_variant_goes_negative_with_ledger", !r.error && (await qoh(oversell.id)) === -2 && l.length === 1 && l[0].quantity_after === -2, r.error?.message || JSON.stringify(l));
  }

  // 6. Cancel before shipping: stock returns exactly once.
  {
    const o = await orderBy(dup.idempotency_key);
    const c = await move(o.order_number, "cancelled");
    const after = await qoh(five.id);
    const back = (await ledger(five.id)).filter((x) => x.reason === "order_cancelled");
    assert("cancel_before_shipping_restocks", !c.error && after === 5 && back.length === 1 && back[0].delta === 2 && back[0].quantity_after === 5, c.error?.message || `qoh=${after} rows=${back.length}`);
    const again = await move(o.order_number, "cancelled");
    assert("repeat_cancel_refused_no_double_restock", (again.error?.message || "").includes("invalid_transition") && (await qoh(five.id)) === 5, again.error?.message || "accepted");
  }

  // 7. Status changes never re-deduct; cancel after a failed delivery does not auto-restock (unit is in transit /
  //    with the courier — staff inspect and adjust with a reason).
  {
    const p = payload([{ variant_id: five.id, quantity: 1 }]);
    must(await order(p), "order for lifecycle");
    const o = await orderBy(p.idempotency_key);
    const afterOrder = await qoh(five.id);
    for (const s of ["confirmed", "packing", "shipped", "delivery_failed"]) must(await move(o.order_number, s), `move ${s}`);
    const mid = await qoh(five.id);
    must(await move(o.order_number, "cancelled"), "cancel after failed delivery");
    const end = await qoh(five.id);
    const back = (await ledger(five.id)).filter((x) => x.reason === "order_cancelled" && x.reference_id === o.id);
    assert("status_changes_never_rededuct", afterOrder === 4 && mid === 4, `after_order=${afterOrder} after_transitions=${mid}`);
    assert("cancel_after_failed_delivery_no_auto_restock", end === 4 && back.length === 0, `qoh=${end} restock_rows=${back.length}`);
  }

  // 8. Ledger is not writable by anon/authenticated clients (service role / triggers only).
  {
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const w = await anon.from("inventory_ledger").insert({ variant_id: five.id, delta: 100, reason: "forged" });
    const r = await anon.from("inventory_ledger").select("id").limit(1);
    assert("anon_cannot_write_or_read_ledger", !!w.error && (!!r.error || (r.data || []).length === 0), `${w.error?.message} / ${r.error?.message || r.data?.length}`);
  }
} finally {
  if (prevCod) await sb.from("store_settings").upsert({ key: "cod_checkout", value: prevCod });
}

const failed = results.filter((r) => !r.ok).length;
fs.mkdirSync("docs/evidence", { recursive: true });
fs.writeFileSync("docs/evidence/INVENTORY_ORDERS_RESULTS.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + "\n");
console.log(`\n${results.length - failed}/${results.length} passed · docs/evidence/INVENTORY_ORDERS_RESULTS.json`);
process.exitCode = failed ? 1 : 0;
