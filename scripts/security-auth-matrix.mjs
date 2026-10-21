/**
 * Authorization matrix probes (anonymous HTTP + RLS).
 * Role-as-staff browser E2E still requires owner-seeded memberships.
 *
 *   node scripts/security-auth-matrix.mjs [baseUrl]
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

const base = (process.argv[2] || process.env.AUTH_MATRIX_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("missing public supabase env");

const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function probe(pathName, init) {
  const res = await fetch(`${base}${pathName}`, {
    ...init,
    redirect: "manual",
    headers: { ...(init?.headers || {}), "Cache-Control": "no-store" },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, text, json, location: res.headers.get("location") };
}

const sensitiveLeak = (body) =>
  /customer_phone|quantity_on_hand|service_role|SUPABASE_SERVICE|amount_collected|admin_memberships/i.test(body);

// ── Anonymous HTTP: admin APIs must 401 ────────────────────────────────────
const adminApis = [
  ["PATCH", "/api/admin/products/dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", { title: "x" }],
  ["POST", "/api/admin/orders/LH-TEST/status", { toStatus: "confirmed" }],
  ["POST", "/api/admin/cod-collections", { orderNumber: "LH-TEST", amountPkr: 1 }],
  ["POST", "/api/admin/shipping-zones", { name: "x", provinces: ["Punjab"], flatFeePkr: 0, codFeePkr: 0 }],
];

for (const [method, p, body] of adminApis) {
  try {
    const r = await probe(p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert(
      `anon_${method.toLowerCase()}_${p.replace(/\W+/g, "_").slice(0, 48)}`,
      r.status === 401 || r.status === 403,
      `status=${r.status}`,
    );
    assert(
      `anon_no_leak_${p.replace(/\W+/g, "_").slice(0, 40)}`,
      !sensitiveLeak(r.text),
      sensitiveLeak(r.text) ? "SENSITIVE_LEAK" : "ok",
    );
  } catch (e) {
    assert(`anon_${method}_${p}`, false, e instanceof Error ? e.message : "fetch failed");
  }
}

// Admin pages: unauthenticated should redirect to login (not dump HTML secrets)
for (const page of ["/admin", "/admin/products", "/admin/orders", "/admin/settings", "/admin/inquiries"]) {
  try {
    const r = await probe(page, { method: "GET" });
    const redirected =
      (r.status === 307 || r.status === 302 || r.status === 303) &&
      (r.location || "").includes("/admin/login");
    assert(`anon_redirect_${page.replace(/\//g, "_")}`, redirected || r.status === 401, `status=${r.status} loc=${r.location}`);
    assert(`anon_page_no_leak_${page.replace(/\//g, "_")}`, !sensitiveLeak(r.text), "ok");
  } catch (e) {
    assert(`anon_page_${page}`, false, e instanceof Error ? e.message : "fetch failed");
  }
}

// ── RLS: signed-in non-staff simulation via anon key (no membership) ───────
const anonClient = createClient(url, anon, { auth: { persistSession: false } });

{
  const { data, error } = await anonClient.from("orders").select("order_number,customer_name,customer_phone_e164").limit(5);
  assert(
    "nonstaff_rls_orders",
    !!error || !data || data.length === 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}
{
  const { data, error } = await anonClient.from("admin_memberships").select("user_id,role").limit(5);
  assert(
    "nonstaff_rls_memberships",
    !!error || !data || data.length === 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}
{
  const { data, error } = await anonClient.from("contact_inquiries").select("name,message").limit(5);
  assert(
    "nonstaff_rls_inquiries",
    !!error || !data || data.length === 0,
    error?.message || `rows=${data?.length ?? 0}`,
  );
}
{
  const { data, error } = await anonClient.from("products").select("handle,status").eq("status", "draft").limit(5);
  assert(
    "nonstaff_rls_drafts",
    (!error && Array.isArray(data) && data.length === 0) || !!error,
    error?.message || `drafts=${data?.length ?? 0}`,
  );
}
{
  const { data, error } = await anonClient
    .from("product_variants")
    .select("id,quantity_on_hand")
    .limit(3);
  const leaked = Array.isArray(data) && data.some((r) => "quantity_on_hand" in r && r.quantity_on_hand != null);
  assert("nonstaff_rls_inventory", !!error || !leaked, error?.message || (leaked ? "LEAK" : "ok"));
}

// Public catalog still works
{
  const { data, error } = await anonClient.from("products").select("handle,title").eq("status", "active").limit(3);
  assert("public_catalog_readable", !error && Array.isArray(data) && data.length > 0, error?.message || `n=${data?.length}`);
}

const out = path.join(root, "docs", "SECURITY_AUTH_MATRIX_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · wrote ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
