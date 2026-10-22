/**
 * Concurrent COD collection integrity test against live Supabase (service role).
 * Uses a clearly marked reversible sandbox order. Does not enable public COD.
 *
 *   node scripts/test-cod-concurrency.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) throw new Error(".env.local missing");
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

// Writes fixtures (Auth users, memberships, orders): refuse hosted databases unless explicitly allowed.
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "") && process.env.ALLOW_REMOTE_FIXTURES !== "1") {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase. Start `supabase start` and pass the local URL/keys (see docs/ISOLATED_TESTS.md).");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) throw new Error("missing supabase service env");

const sb = createClient(url, service, { auth: { persistSession: false } });
const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// Ensure a staff actor exists for RPC authorization (prefer existing owner/admin)
const { data: memberships } = await sb
  .from("admin_memberships")
  .select("user_id, role, is_active")
  .eq("is_active", true)
  .in("role", ["owner", "admin", "manager", "fulfillment"])
  .limit(1);

let actorId = memberships?.[0]?.user_id;
if (!actorId) {
  // Create ephemeral auth user + membership for sandbox only
  const email = `cod-sandbox-${Date.now()}@lh-test.local`;
  const { data: created, error: cuErr } = await sb.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
  });
  if (cuErr || !created?.user) {
    console.error("Cannot create sandbox staff:", cuErr?.message);
    process.exit(1);
  }
  actorId = created.user.id;
  await sb.from("admin_memberships").insert({ user_id: actorId, role: "manager", is_active: true });
  console.log("Created ephemeral sandbox staff for COD concurrency test");
}

const totalDue = 10_000_00; // Rs 10,000 in paisa
const half = 5_000_00;

async function sandboxOrder(suffix = "") {
  const orderNumber = `LH-SANDBOX-${Date.now()}${suffix}`;
  const { data, error } = await sb
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: "confirmed",
      payment_method: "cod",
      payment_status: "unpaid_cod",
      customer_name: "SANDBOX TEST — DELETE",
      customer_phone_e164: "+923001112233",
      customer_phone_normalized: "3001112233",
      subtotal_paisa: totalDue,
      shipping_paisa: 0,
      cod_fee_paisa: 0,
      discount_paisa: 0,
      tax_paisa: 0,
      total_due_paisa: totalDue,
      amount_collected_paisa: 0,
      idempotency_key: `sandbox-order-${orderNumber}`,
      customer_note: "Automated concurrency fixture — safe to delete",
    })
    .select("id, order_number")
    .single();
  if (error || !data) {
    console.error("Failed to create sandbox order:", error?.message);
    process.exit(1);
  }
  return data;
}

const order = await sandboxOrder();
const orderNumber = order.order_number;
const collect = (number, key, amount = half) =>
  sb.rpc("record_cod_collection", {
    payload: { actor_user_id: actorId, order_number: number, amount_paisa: amount, idempotency_key: key, collector_ref: "sandbox" },
  });

const sameKey = `idem-same-${randomUUID()}`;
const [a, b] = await Promise.all([
  sb.rpc("record_cod_collection", {
    payload: {
      actor_user_id: actorId,
      order_number: orderNumber,
      amount_paisa: half,
      idempotency_key: sameKey,
      collector_ref: "sandbox-A",
      note: "concurrent same key",
    },
  }),
  sb.rpc("record_cod_collection", {
    payload: {
      actor_user_id: actorId,
      order_number: orderNumber,
      amount_paisa: half,
      idempotency_key: sameKey,
      collector_ref: "sandbox-B",
      note: "concurrent same key",
    },
  }),
]);

assert("same_key_both_ok_or_one_ok", !a.error && !b.error, `${a.error?.message || ""} ${b.error?.message || ""}`);
const replays = [a.data, b.data].filter((d) => d?.idempotent_replay).length;
const fresh = [a.data, b.data].filter((d) => d && !d.idempotent_replay).length;
assert("same_key_one_fresh_one_replay", fresh === 1 && replays === 1, `fresh=${fresh} replay=${replays}`);

const { data: afterSame } = await sb
  .from("orders")
  .select("amount_collected_paisa, payment_status")
  .eq("id", order.id)
  .single();
assert("same_key_collected_once", afterSame?.amount_collected_paisa === half, `collected=${afterSame?.amount_collected_paisa}`);

const key1 = `idem-diff-a-${randomUUID()}`;
const key2 = `idem-diff-b-${randomUUID()}`;
const [c, d] = await Promise.all([
  sb.rpc("record_cod_collection", {
    payload: {
      actor_user_id: actorId,
      order_number: orderNumber,
      amount_paisa: half,
      idempotency_key: key1,
      collector_ref: "sandbox-C",
    },
  }),
  sb.rpc("record_cod_collection", {
    payload: {
      actor_user_id: actorId,
      order_number: orderNumber,
      amount_paisa: half,
      idempotency_key: key2,
      collector_ref: "sandbox-D",
    },
  }),
]);

const overOrOk = [c, d];
const successes = overOrOk.filter((r) => !r.error && r.data?.ok);
const overs = overOrOk.filter((r) => (r.error?.message || "").includes("over_collection"));
assert(
  "diff_keys_no_double_money",
  successes.length + overs.length === 2 && successes.length === 1,
  `ok=${successes.length} over=${overs.length} err=${overOrOk.map((r) => r.error?.message).join("|")}`,
);

const { data: finalOrder } = await sb
  .from("orders")
  .select("amount_collected_paisa, payment_status, total_due_paisa")
  .eq("id", order.id)
  .single();
assert(
  "final_collected_eq_total",
  finalOrder?.amount_collected_paisa === totalDue && finalOrder?.payment_status === "collected",
  JSON.stringify(finalOrder),
);

const { count: colCount } = await sb
  .from("cod_collections")
  .select("id", { count: "exact", head: true })
  .eq("order_id", order.id);
assert("exactly_two_collection_rows", colCount === 2, `rows=${colCount}`);

const extraOrders = [];
// Stress + idempotency contract (docs/COD_IDEMPOTENCY_CONTRACT.md). Assertions use persisted rows, not flags.
const o2 = await sandboxOrder("-B");
const o3 = await sandboxOrder("-C");
const rowsFor = async (table, col, val) =>
  (await sb.from(table).select("id", { count: "exact", head: true }).eq(col, val)).count;
const isConflict = (r) => (r.error?.message || "").includes("idempotency_conflict");

// Same key, same order, same amount, N concurrent: exactly one fresh, the rest replay, one row of everything.
const burst = { errors: [], badSplit: 0, calls: 0, keys: 0 };
for (const size of [2, 8, 16, 32]) {
  for (let r = 0; r < 3; r++) {
    const key = `idem-burst-${randomUUID()}`;
    const rs = await Promise.all(Array.from({ length: size }, () => collect(o2.order_number, key, 100)));
    burst.calls += size;
    burst.keys++;
    burst.errors.push(...rs.filter((x) => x.error).map((x) => x.error.message));
    const fresh = rs.filter((x) => x.data && !x.data.idempotent_replay);
    const ids = new Set(rs.map((x) => x.data?.collection_id));
    if (fresh.length !== 1 || ids.size !== 1) burst.badSplit++;
  }
}
const { data: o2After } = await sb.from("orders").select("amount_collected_paisa").eq("id", o2.id).single();
const o2Rows = await rowsFor("cod_collections", "order_id", o2.id);
const { count: o2Events } = await sb.from("order_events").select("id", { count: "exact", head: true }).eq("order_id", o2.id).eq("event_type", "cod_collected");
const { count: o2Audit } = await sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("entity_id", o2.id).eq("action", "cod.collect");
assert("burst_same_key_no_errors", burst.errors.length === 0, `${burst.calls} calls over ${burst.keys} keys (2/8/16/32), errors=${JSON.stringify([...new Set(burst.errors)])}`);
assert("burst_one_fresh_one_collection_id_per_key", burst.badSplit === 0, `keys with != 1 fresh or mixed ids: ${burst.badSplit}`);
assert("burst_collected_once_per_key", o2After?.amount_collected_paisa === burst.keys * 100, `collected=${o2After?.amount_collected_paisa} expected=${burst.keys * 100}`);
assert("burst_rows_events_audit_once_per_key", o2Rows === burst.keys && o2Events === burst.keys && o2Audit === burst.keys, `rows=${o2Rows} events=${o2Events} audit=${o2Audit}`);

// Replay after completion: same key, same order, same amount -> same collection id, nothing new written.
{
  const key = `idem-replay-${randomUUID()}`;
  const first = await collect(o2.order_number, key, 100);
  const again = await collect(o2.order_number, key, 100);
  const rows = await rowsFor("cod_collections", "idempotency_key", key);
  assert("replay_after_completion", !first.error && again.data?.idempotent_replay === true && again.data?.collection_id === first.data?.collection_id && rows === 1, JSON.stringify({ first: first.error?.message || "ok", again: again.data || again.error?.message, rows }));
  // Same key, different amount, after completion -> conflict, nothing written.
  const before = (await sb.from("orders").select("amount_collected_paisa").eq("id", o2.id).single()).data?.amount_collected_paisa;
  const diff = await collect(o2.order_number, key, 200);
  const after = (await sb.from("orders").select("amount_collected_paisa").eq("id", o2.id).single()).data?.amount_collected_paisa;
  assert("same_key_different_amount_conflict", isConflict(diff) && before === after && (await rowsFor("cod_collections", "idempotency_key", key)) === 1, `${diff.error?.message || "ok"} before=${before} after=${after}`);
  // Same key, other order, after completion -> conflict, other order untouched.
  const other = await collect(o3.order_number, key, 100);
  const o3c = (await sb.from("orders").select("amount_collected_paisa").eq("id", o3.id).single()).data?.amount_collected_paisa;
  assert("same_key_other_order_conflict", isConflict(other) && o3c === 0, `${other.error?.message || "ok"} o3_collected=${o3c}`);
}

// Same key raced across two orders (both arrival orders, several rounds): one collection, one conflict.
{
  let bad = 0;
  const seen = new Set();
  for (let r = 0; r < 10; r++) {
    const key = `idem-cross-${randomUUID()}`;
    const pair = r % 2 ? [o3.order_number, o2.order_number] : [o2.order_number, o3.order_number];
    const rs = await Promise.all(pair.map((n) => collect(n, key, 100)));
    const ok = rs.filter((x) => !x.error && !x.data?.idempotent_replay).length;
    const conflicts = rs.filter(isConflict).length;
    rs.forEach((x) => seen.add(x.error?.message || (x.data?.idempotent_replay ? "replay" : "fresh")));
    if (ok !== 1 || conflicts !== 1 || (await rowsFor("cod_collections", "idempotency_key", key)) !== 1) bad++;
  }
  assert("cross_order_same_key_one_collection_one_conflict", bad === 0, `bad rounds=${bad}/10 outcomes=${[...seen].join("|")}`);
}

// Same key, same order, different amounts concurrently: one recorded, the other conflicts (never both).
{
  let bad = 0;
  for (let r = 0; r < 10; r++) {
    const key = `idem-amt-${randomUUID()}`;
    const rs = await Promise.all([collect(o3.order_number, key, 100), collect(o3.order_number, key, 300)]);
    const ok = rs.filter((x) => !x.error).length;
    if (ok !== 1 || rs.filter(isConflict).length !== 1 || (await rowsFor("cod_collections", "idempotency_key", key)) !== 1) bad++;
  }
  assert("same_order_different_amount_race_one_conflict", bad === 0, `bad rounds=${bad}/10`);
}

// Different keys, same order, 16 concurrent for more than is due: never over-collected.
{
  const o4 = await sandboxOrder("-D");
  const rs = await Promise.all(Array.from({ length: 16 }, () => collect(o4.order_number, `idem-over-${randomUUID()}`, 2_000_00)));
  const ok = rs.filter((x) => !x.error).length;
  const overs = rs.filter((x) => (x.error?.message || "").includes("over_collection")).length;
  const c = (await sb.from("orders").select("amount_collected_paisa, payment_status").eq("id", o4.id).single()).data;
  assert("distinct_keys_no_over_collection", ok === 5 && overs === 11 && c?.amount_collected_paisa === totalDue && c?.payment_status === "collected", `ok=${ok} over=${overs} ${JSON.stringify(c)}`);
  extraOrders.push(o4.id);
}

// Cleanup sandbox orders (cascade collections/events) and their audit rows (local only).
const sandboxIds = [order.id, o2.id, o3.id, ...extraOrders];
await sb.from("audit_logs").delete().in("entity_id", sandboxIds);
await sb.from("orders").delete().in("id", sandboxIds);

const out = path.join(root, "docs", "COD_CONCURRENCY_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), orderNumber, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
