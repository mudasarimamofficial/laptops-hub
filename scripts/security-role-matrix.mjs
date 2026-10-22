/**
 * Full staff-role authorization matrix using isolated Auth users + memberships.
 * Creates ephemeral fixtures, runs API/RLS checks, then deactivates/deletes them.
 *
 *   node scripts/security-role-matrix.mjs [baseUrl]
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

const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error("missing supabase env");

const admin = createClient(url, service, { auth: { persistSession: false } });
const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const ROLES = ["owner", "admin", "manager", "editor", "fulfillment"];
const fixtures = [];

async function makeUser(role, active = true) {
  const email = `lh-matrix-${role}${active ? "" : "-inactive"}-${Date.now()}@lh-test.local`;
  const password = `T3st-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message || "createUser failed");
  await admin.from("admin_memberships").upsert({
    user_id: data.user.id,
    role,
    is_active: active,
  });
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sErr } = await userClient.auth.signInWithPassword({ email, password });
  if (sErr || !session.session) throw new Error(sErr?.message || "signIn failed");
  fixtures.push({ email, userId: data.user.id, role, active, accessToken: session.session.access_token });
  return fixtures[fixtures.length - 1];
}

async function api(token, method, pathName, body) {
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` } : {}),
      "Cache-Control": "no-store",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: res.status, json, text };
}

// Note: Next.js admin APIs use cookie session via createClient(), not Bearer.
// So we also verify DB has_staff_role semantics + service RPC forbidden checks,
// and cookie-less HTTP still 401s. For cookie session role tests we probe memberships via user JWT.

try {
  // Non-staff signed-in user
  const email = `lh-matrix-nonstaff-${Date.now()}@lh-test.local`;
  const password = `T3st-${randomUUID()}`;
  const { data: ns } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  fixtures.push({ email, userId: ns.user.id, role: "nonstaff", active: false, accessToken: null });
  const nsClient = createClient(url, anon, { auth: { persistSession: false } });
  await nsClient.auth.signInWithPassword({ email, password });
  const { data: nsOrders, error: nsOrdErr } = await nsClient.from("orders").select("order_number").limit(1);
  assert("nonstaff_cannot_read_orders", !!nsOrdErr || !nsOrders?.length, nsOrdErr?.message || "ok");
  const { data: nsMem } = await nsClient.from("admin_memberships").select("role").limit(1);
  assert("nonstaff_cannot_list_memberships", !nsMem || nsMem.length === 0, `rows=${nsMem?.length}`);

  for (const role of ROLES) {
    await makeUser(role, true);
  }
  await makeUser("editor", false); // inactive

  for (const f of fixtures.filter((x) => ROLES.includes(x.role))) {
    const client = createClient(url, anon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${f.accessToken}` } },
    });
    // Force session
    await client.auth.setSession({ access_token: f.accessToken, refresh_token: "noop" }).catch(() => null);

    const { data: mem } = await admin
      .from("admin_memberships")
      .select("role, is_active")
      .eq("user_id", f.userId)
      .maybeSingle();
    assert(`${f.role}_membership_active_${f.active}`, !!mem && mem.is_active === f.active && mem.role === f.role);

    // RPC forbidden for inactive / wrong role: record_cod_collection with editor
    if (f.role === "editor" && f.active) {
      const { error } = await admin.rpc("record_cod_collection", {
        payload: {
          actor_user_id: f.userId,
          order_number: "LH-NONE",
          amount_paisa: 100,
          idempotency_key: `deny-${randomUUID()}`,
        },
      });
      assert("editor_cod_rpc_forbidden", (error?.message || "").includes("forbidden"), error?.message);
    }
    if (["owner", "admin", "manager", "fulfillment"].includes(f.role) && f.active) {
      const { error } = await admin.rpc("record_cod_collection", {
        payload: {
          actor_user_id: f.userId,
          order_number: "LH-NONE",
          amount_paisa: 100,
          idempotency_key: `nf-${randomUUID()}`,
        },
      });
      assert(`${f.role}_cod_rpc_not_found_not_forbidden`, (error?.message || "").includes("not_found"), error?.message);
    }
  }

  const inactive = fixtures.find((f) => f.role === "editor" && !f.active);
  if (inactive) {
    const { error } = await admin.rpc("transition_order_status", {
      payload: {
        actor_user_id: inactive.userId,
        order_number: "LH-NONE",
        to_status: "confirmed",
      },
    });
    assert("inactive_staff_rpc_forbidden", (error?.message || "").includes("forbidden"), error?.message);
  }

  // Anonymous still blocked on admin APIs
  const anonHit = await api(null, "POST", "/api/admin/cod-collections", {
    orderNumber: "LH-NONE",
    amountPkr: 1,
    idempotencyKey: randomUUID(),
  });
  assert("anon_cod_api_401", anonHit.status === 401 || anonHit.status === 403, `status=${anonHit.status}`);
} finally {
  for (const f of fixtures) {
    await admin.from("admin_memberships").delete().eq("user_id", f.userId);
    await admin.auth.admin.deleteUser(f.userId).catch(() => null);
  }
}

const out = path.join(root, "docs", "SECURITY_ROLE_MATRIX_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · wrote ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
