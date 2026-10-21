/**
 * Runtime P0 security probes against live Supabase (anon key).
 * Does NOT print secrets. Exit 0 only if all assertions pass.
 *
 *   node scripts/security-p0-probe.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) throw new Error(".env.local missing");
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon) throw new Error("missing public supabase env");

const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const anonClient = createClient(url, anon, { auth: { persistSession: false } });

// 1) Anon cannot read orders
{
  const { data, error } = await anonClient.from("orders").select("order_number,customer_name").limit(5);
  const blocked = !!error || !data || data.length === 0;
  // Empty table also "passes" length===0 but RLS should error or return []. Prefer error OR empty with no leak.
  assert(
    "anon_cannot_read_orders",
    blocked && !(data && data.some((r) => r.customer_name)),
    error?.message || `rows=${data?.length ?? 0}`,
  );
}

// 2) Anon cannot read inquiries
{
  const { data, error } = await anonClient.from("contact_inquiries").select("name,message").limit(5);
  assert(
    "anon_cannot_read_inquiries",
    !!error || !data || data.length === 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}

// 3) Anon must not receive quantity_on_hand / inventory_mode
{
  const { data, error } = await anonClient
    .from("product_variants")
    .select("id,price_paisa,quantity_on_hand,inventory_mode")
    .limit(3);
  const leaked =
    Array.isArray(data) &&
    data.some((r) => Object.prototype.hasOwnProperty.call(r, "quantity_on_hand") && r.quantity_on_hand !== undefined);
  // PostgREST typically errors on unauthorized columns
  const blocked = !!error || !leaked;
  assert(
    "anon_cannot_select_inventory_columns",
    blocked,
    error?.message || (leaked ? "INVENTORY_LEAKED" : "ok"),
  );
}

// 4) Anon must not receive product flags / media_approval / import_source
{
  const { data, error } = await anonClient
    .from("products")
    .select("handle,flags,media_approval,import_source")
    .eq("status", "active")
    .limit(3);
  const leaked =
    Array.isArray(data) &&
    data.some(
      (r) =>
        Object.prototype.hasOwnProperty.call(r, "flags") ||
        Object.prototype.hasOwnProperty.call(r, "media_approval") ||
        Object.prototype.hasOwnProperty.call(r, "import_source"),
    );
  assert(
    "anon_cannot_select_internal_product_columns",
    !!error || !leaked,
    error?.message || (leaked ? "FLAGS_LEAKED" : "ok"),
  );
}

// 5) Draft products not returned to anon
{
  const { data, error } = await anonClient.from("products").select("handle,status").eq("status", "draft").limit(10);
  assert(
    "anon_cannot_list_drafts",
    (!error && Array.isArray(data) && data.length === 0) || !!error,
    error?.message || `draft_rows=${data?.length ?? 0}`,
  );
}

// 6) Anon cannot self-insert admin membership
{
  const fakeUid = "00000000-0000-4000-8000-000000000001";
  const { error } = await anonClient.from("admin_memberships").insert({
    user_id: fakeUid,
    role: "owner",
    is_active: true,
  });
  assert("anon_cannot_insert_admin_membership", !!error, error?.message || "unexpected success");
}

// 7) Public prices still readable
{
  const { data, error } = await anonClient
    .from("product_variants")
    .select("id,price_paisa,purchasable")
    .gt("price_paisa", 0)
    .limit(3);
  assert(
    "anon_can_read_public_prices",
    !error && Array.isArray(data) && data.length > 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}

// 8) Service role still sees inventory (staff path after requireStaff)
if (service) {
  const svc = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await svc
    .from("product_variants")
    .select("id,quantity_on_hand,inventory_mode")
    .limit(1);
  assert(
    "service_role_can_read_inventory_for_staff_ops",
    !error && Array.isArray(data),
    error?.message || "ok",
  );
} else {
  assert("service_role_can_read_inventory_for_staff_ops", false, "SUPABASE_SERVICE_ROLE_KEY missing");
}

// 9) Order confirmation RPC exists and rejects garbage token
{
  const { data, error } = await anonClient.rpc("get_order_confirmation_by_token", {
    p_token: "00000000-0000-4000-8000-000000000099",
  });
  assert(
    "order_token_rpc_returns_empty_for_unknown",
    !error && Array.isArray(data) && data.length === 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log("\n---");
console.log(`Passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  process.exitCode = 1;
}

const out = path.join(root, "docs", "SECURITY_P0_PROBE_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
console.log(`Wrote ${out}`);
