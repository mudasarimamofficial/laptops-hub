/**
 * COD checkout integrity against a LOCAL Supabase only (refuses hosted URLs).
 * Seeds its own product, variant and shipping zone, enables checkout in the local store_settings,
 * then checks forged prices, double submits, oversell races, limits, drafts, zones and anon access.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/test-cod-checkout-isolated.mjs [appBaseUrl]
 *
 * With appBaseUrl, the same checks also go through POST /api/checkout/cod of an app built against the local stack
 * with COD_CHECKOUT_ENABLED=true.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL must be a local Supabase (this test enables checkout and writes orders).");
  process.exit(2);
}
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = (process.argv[2] || "").replace(/\/$/, "");
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// ── Fixtures ────────────────────────────────────────────────────────────────
const tag = Date.now().toString(36);
const product = must(await sb.from("products").insert({ handle: `iso-test-${tag}`, title: `ISO TEST ${tag}`, status: "active", category: "Laptop" }).select("id").single(), "product");
const draft = must(await sb.from("products").insert({ handle: `iso-draft-${tag}`, title: `ISO DRAFT ${tag}`, status: "draft" }).select("id").single(), "draft");
const PRICE = 4_500_000; // Rs 45,000
const variant = must(await sb.from("product_variants").insert({ product_id: product.id, sku: `ISO-${tag}`, price_paisa: PRICE, max_per_order: 2 }).select("id").single(), "variant");
const tracked = must(await sb.from("product_variants").insert({ product_id: product.id, sku: `ISO-T-${tag}`, price_paisa: PRICE, max_per_order: 2, inventory_mode: "tracked", quantity_on_hand: 1 }).select("id").single(), "tracked");
const draftVar = must(await sb.from("product_variants").insert({ product_id: draft.id, sku: `ISO-D-${tag}`, price_paisa: PRICE }).select("id").single(), "draftVar");
const zone = must(await sb.from("shipping_zones").insert({ name: `ISO zone ${tag}`, provinces: ["Punjab"], cities: ["Lahore"], flat_fee_paisa: 25_000, cod_fee_paisa: 10_000, is_active: true }).select("id").single(), "zone");
must(await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true } }), "enable checkout (local only)");

const payload = (o = {}) => ({
  idempotency_key: `iso-${randomUUID()}`,
  customer_name: "Isolated Test",
  customer_phone_e164: "+923001112233",
  customer_phone_normalized: "923001112233",
  shipping_zone_id: zone.id,
  address: { line1: "Test street 1", city: "Lahore", province: "Punjab" },
  lines: [{ variant_id: variant.id, quantity: 1 }],
  ...o,
});
const rpc = (p) => sb.rpc("create_cod_order", { payload: p });
// Evidence is committed: never print order access tokens or customer fields.
const safe = (r) => r.error?.message || JSON.stringify({ ok: r.data?.ok, duplicate: r.data?.duplicate });
const ordersFor = async (key) => (await sb.from("orders").select("id,total_due_paisa,subtotal_paisa,payment_status,status").eq("idempotency_key", key)).data || [];

try {
  // 1. Forged prices / totals in the payload are ignored: the DB recomputes from the variant and zone.
  {
    const p = payload({ lines: [{ variant_id: variant.id, quantity: 2, unit_price_paisa: 1, price_paisa: 1 }], subtotal_paisa: 1, total_due_paisa: 1, shipping_paisa: 0 });
    const r = await rpc(p);
    const [o] = await ordersFor(p.idempotency_key);
    const expected = PRICE * 2 + 25_000 + 10_000;
    assert("forged_price_ignored", !r.error && o?.total_due_paisa === expected && o?.subtotal_paisa === PRICE * 2, `total=${o?.total_due_paisa} expected=${expected} ${r.error?.message || ""}`);
    assert("new_order_unpaid_cod", o?.payment_status === "unpaid_cod" && o?.status === "placed", JSON.stringify(o));
  }
  // 2. Five concurrent submits with one idempotency key → exactly one order.
  {
    const p = payload();
    const rs = await Promise.all(Array.from({ length: 5 }, () => rpc(p)));
    const rows = await ordersFor(p.idempotency_key);
    const errs = rs.filter((r) => r.error).map((r) => r.error.message);
    assert("same_key_one_order", rows.length === 1, `orders=${rows.length}`);
    assert("same_key_responses", rs.every((r) => !r.error || /duplicate key|idempotency/.test(r.error.message)), `errors=${JSON.stringify(errs)}`);
    const again = await rpc(p);
    assert("same_key_replay_returns_duplicate", again.data?.duplicate === true && again.data?.order_id === rows[0]?.id, safe(again));
    // Same key, different cart or zone: conflict, never the earlier order as this cart's confirmation.
    const otherCart = await rpc({ ...p, lines: [{ variant_id: variant.id, quantity: 2 }] });
    assert("same_key_different_cart_conflict", (otherCart.error?.message || "").includes("idempotency_conflict") && (await ordersFor(p.idempotency_key)).length === 1, safe(otherCart));
    const otherZone = await rpc({ ...p, shipping_zone_id: null });
    assert("same_key_different_zone_conflict", (otherZone.error?.message || "").includes("idempotency_conflict"), safe(otherZone));
    const split = await rpc({ ...p, lines: [{ variant_id: variant.id, quantity: 1 }] });
    assert("same_key_same_cart_still_duplicate", split.data?.duplicate === true, split.error?.message || `duplicate=${split.data?.duplicate}`);
  }
  // 3. Oversell race on a tracked variant with 1 unit: exactly one succeeds.
  {
    const rs = await Promise.all(Array.from({ length: 4 }, () => rpc(payload({ lines: [{ variant_id: tracked.id, quantity: 1 }] }))));
    const ok = rs.filter((r) => !r.error).length;
    const stock = rs.filter((r) => (r.error?.message || "").includes("insufficient_stock")).length;
    const left = (await sb.from("product_variants").select("quantity_on_hand").eq("id", tracked.id).single()).data?.quantity_on_hand;
    assert("tracked_no_oversell", ok === 1 && stock === 3 && left === 0, `ok=${ok} insufficient=${stock} left=${left}`);
  }
  // 4–7. Limits, drafts, zones, disabled checkout.
  const err = async (p) => (await rpc(p)).error?.message || "no error";
  assert("quantity_over_limit_rejected", (await err(payload({ lines: [{ variant_id: variant.id, quantity: 3 }] }))).includes("quantity_exceeds_limit"));
  assert("draft_product_rejected", (await err(payload({ lines: [{ variant_id: draftVar.id, quantity: 1 }] }))).includes("product_not_purchasable"));
  assert("zone_mismatch_rejected", (await err(payload({ address: { line1: "x", city: "Karachi", province: "Sindh" } }))).includes("zone_mismatch"));
  assert("missing_zone_rejected", (await err(payload({ shipping_zone_id: null }))).includes("shipping_required"));
  assert("short_idempotency_key_rejected", (await err(payload({ idempotency_key: "abc" }))).includes("invalid_idempotency_key"));
  // 8. Anonymous clients cannot call the order RPC or insert/read orders directly.
  {
    const r = await anon.rpc("create_cod_order", { payload: payload() });
    assert("anon_rpc_denied", !!r.error, r.error?.message);
    const ins = await anon.from("orders").insert({ order_number: `X-${tag}`, idempotency_key: `x-${tag}` });
    assert("anon_order_insert_denied", !!ins.error, ins.error?.message);
    // Shipping quote is public: served address returns the zone, unserved address is "unserviceable".
    const q = await anon.rpc("quote_cod_shipping", { payload: { address: { city: "Lahore", province: "Punjab" } } });
    assert("anon_quote_served_address", !q.error && q.data?.ok === true && (q.data.options || []).some((o) => o.id === zone.id), q.error?.message || JSON.stringify({ ok: q.data?.ok, n: q.data?.options?.length }));
    const q2 = await anon.rpc("quote_cod_shipping", { payload: { address: { city: "Lahore", province: "Punjab" }, shipping_zone_id: zone.id } });
    assert("anon_quote_with_zone_id", !q2.error && q2.data?.ok === true, q2.error?.message || q2.data?.error);
    const q3 = await anon.rpc("quote_cod_shipping", { payload: { address: { city: "Quetta", province: "Balochistan" } } });
    assert("anon_quote_unserved_address", !q3.error && q3.data?.ok === false && q3.data?.error === "unserviceable", q3.error?.message || q3.data?.error);
    const sel = await anon.from("orders").select("id").limit(1);
    assert("anon_orders_unreadable", !!sel.error || (sel.data || []).length === 0, sel.error?.message || `rows=${sel.data?.length}`);
    // Server-only RPCs (staff ones trust payload.actor_user_id): no execute for anon (20261023120000).
    for (const [fn, args] of [
      ["record_cod_collection", { payload: {} }],
      ["transition_order_status", { payload: {} }],
      ["consume_rate_limit", { p_key: "probe", p_limit: 0, p_window_seconds: 0 }],
    ]) {
      const r = await anon.rpc(fn, args);
      assert(`anon_${fn}_denied`, r.error?.code === "42501", r.error ? `${r.error.code} ${r.error.message}` : "executed");
    }
  }
  // 9. HTTP layer (optional): forged fields, double submit and disabled-state mapping through the real route.
  if (app) {
    const body = (key, extra = {}) => ({
      idempotencyKey: key,
      customerName: "Isolated Test",
      customerPhone: "03001112233",
      shippingZoneId: zone.id,
      confirmCod: true,
      address: { line1: "Test street 1", city: "Lahore", province: "Punjab" },
      lines: [{ variantId: variant.id, quantity: 1, unitPricePaisa: 1 }],
      totalDuePaisa: 1,
      ...extra,
    });
    const post = (b) => fetch(`${app}/api/checkout/cod`, { method: "POST", headers: { "content-type": "application/json", origin: app }, body: JSON.stringify(b) });
    // Checkout requires the five policies published + legally approved: local stand-ins, restored afterwards.
    const POLICY = ["shipping", "returns", "warranty", "privacy", "terms"];
    const savedPolicies = (await sb.from("content_pages").select("slug, status, body_html, legal_approved, legal_approved_by").in("slug", POLICY)).data || [];
    const approver = (await sb.from("admin_memberships").select("user_id").limit(1).maybeSingle()).data?.user_id ?? null;
    for (const slug of POLICY) {
      await sb.from("content_pages").update({ status: "published", body_html: `<p>Isolated test stand-in for ${slug}.</p>`, legal_approved: true, legal_approved_by: approver }).eq("slug", slug);
    }
    // A withdrawn policy stops ordering on the next request: refused, no order.
    await sb.from("content_pages").update({ legal_approved: false }).eq("slug", "terms");
    const gateKey = `iso-http-gate-${randomUUID()}`;
    const gated = await post(body(gateKey));
    const gj = await gated.json().catch(() => ({}));
    assert("http_policy_withdrawn_refuses_order", gated.status === 403 && gj.error === "policies_pending" && (await ordersFor(gateKey)).length === 0, `${gated.status} ${JSON.stringify(gj)}`);
    await sb.from("content_pages").update({ legal_approved: true }).eq("slug", "terms");
    let rs = [], js = [], rows = [], key = "";
    const statuses = [];
    for (let round = 0; round < 8; round++) {
      key = `iso-http-${randomUUID()}`;
      rs = await Promise.all(Array.from({ length: 6 }, () => post(body(key))));
      js = await Promise.all(rs.map((r) => r.json().catch(() => ({}))));
      rows = await ordersFor(key);
      statuses.push(...rs.map((r) => r.status));
      if (rows.length !== 1 || rs.some((r) => r.status !== 200)) break;
    }
    console.log(`  http rounds: ${statuses.length / 6}, statuses seen: ${[...new Set(statuses)].join(",")}`);
    assert("http_double_submit_one_order", rows.length === 1, `orders=${rows.length} statuses=${rs.map((r) => r.status)}`);
    assert("http_double_submit_all_ok", rs.every((r) => r.status === 200) && js.every((j) => j.orderNumber), `statuses=${rs.map((r) => r.status)} bodies=${JSON.stringify(js.map((j) => j.error || "ok"))}`);
    assert("http_forged_price_ignored", rows[0]?.total_due_paisa === PRICE + 35_000, `total=${rows[0]?.total_due_paisa}`);
    assert("http_no_constraint_leak", js.every((j) => !/constraint|duplicate key/i.test(JSON.stringify(j))), JSON.stringify(js.map((j) => j.error || "ok")));
    // Same key resubmitted with a different cart through the route: 409, no second order, no confirmation.
    const changed = await post(body(key, { lines: [{ variantId: variant.id, quantity: 2 }] }));
    const cj = await changed.json().catch(() => ({}));
    assert("http_same_key_different_cart_409", changed.status === 409 && cj.error === "idempotency_conflict" && !cj.orderNumber && !cj.accessToken && (await ordersFor(key)).length === 1, `${changed.status} ${JSON.stringify(cj)}`);

    // Anonymous customer paths that depend on the explicit grants (20261023120000).
    const quote = await fetch(`${app}/api/checkout/quote`, { method: "POST", headers: { "content-type": "application/json", origin: app }, body: JSON.stringify({ address: { city: "Lahore", province: "Punjab" }, shippingZoneId: zone.id, lines: [{ variantId: variant.id, quantity: 1 }] }) });
    const qj = await quote.json().catch(() => ({}));
    assert("http_shipping_quote_anon", quote.status === 200, `status=${quote.status} ${qj.error || ""} ${qj.message || ""}`);
    const conf = await fetch(`${app}/order/success/${js[0].accessToken}`);
    const confHtml = await conf.text();
    assert("http_order_confirmation_by_token", conf.status === 200 && confHtml.includes(js[0].orderNumber), `status=${conf.status}`);
    const marker = `iso-contact-${tag}`;
    const contact = await fetch(`${app}/api/contact`, { method: "POST", headers: { "content-type": "application/json", origin: app }, body: JSON.stringify({ name: "Isolated Test", email: "iso@lh-test.local", subject: "Local test", message: marker }) });
    const saved = (await sb.from("contact_inquiries").select("id").eq("message", marker)).data || [];
    assert("http_contact_insert_as_anon", contact.status === 200 && saved.length === 1, `status=${contact.status} rows=${saved.length}`);
    if (saved.length) await sb.from("contact_inquiries").delete().in("id", saved.map((r) => r.id));
    for (const row of savedPolicies) {
      await sb.from("content_pages").update({ status: row.status, body_html: row.body_html, legal_approved: row.legal_approved, legal_approved_by: row.legal_approved_by }).eq("slug", row.slug);
    }
  }
} finally {
  // Local stack only: remove fixtures and turn checkout back off.
  await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: false } });
  const ids = ((await sb.from("orders").select("id").in("shipping_zone_id", [zone.id])).data || []).map((o) => o.id);
  if (ids.length) await sb.from("orders").delete().in("id", ids);
  await sb.from("shipping_zones").delete().eq("id", zone.id);
  await sb.from("products").delete().in("id", [product.id, draft.id]);
}

const out = path.join(root, "docs", "COD_CHECKOUT_ISOLATED_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ supabase: "local", app: app || null, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
