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

// Stress: bursts of same-key calls on one order, and one key raced across two orders.
const o2 = await sandboxOrder("-B");
const o3 = await sandboxOrder("-C");
const burst = { rounds: 10, size: 8, errors: [], badSplit: 0 };
for (let r = 0; r < burst.rounds; r++) {
  const key = `idem-burst-${randomUUID()}`;
  const rs = await Promise.all(Array.from({ length: burst.size }, () => collect(o2.order_number, key, 100)));
  burst.errors.push(...rs.filter((x) => x.error).map((x) => x.error.message));
  if (rs.filter((x) => x.data && !x.data.idempotent_replay).length !== 1) burst.badSplit++;
}
const { data: o2After } = await sb.from("orders").select("amount_collected_paisa").eq("id", o2.id).single();
assert("burst_same_key_no_errors", burst.errors.length === 0, `${burst.rounds}x${burst.size} calls, errors=${JSON.stringify([...new Set(burst.errors)])}`);
assert("burst_same_key_one_fresh_per_key", burst.badSplit === 0, `rounds with != 1 fresh: ${burst.badSplit}`);
assert("burst_collected_once_per_key", o2After?.amount_collected_paisa === burst.rounds * 100, `collected=${o2After?.amount_collected_paisa}`);

const crossKey = `idem-cross-${randomUUID()}`;
const cross = await Promise.all([collect(o2.order_number, crossKey, 100), collect(o3.order_number, crossKey, 100)]);
const { count: crossRows } = await sb.from("cod_collections").select("id", { count: "exact", head: true }).eq("idempotency_key", crossKey);
assert(
  "cross_order_same_key_one_collection",
  cross.every((x) => !x.error) && crossRows === 1 && cross.filter((x) => x.data?.idempotent_replay).length === 1,
  `rows=${crossRows} ${cross.map((x) => x.error?.message || (x.data?.idempotent_replay ? "replay" : "fresh")).join("|")}`,
);

// Cleanup sandbox orders (cascade collections/events)
await sb.from("orders").delete().in("id", [order.id, o2.id, o3.id]);

const out = path.join(root, "docs", "COD_CONCURRENCY_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), orderNumber, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
