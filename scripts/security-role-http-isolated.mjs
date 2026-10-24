/**
 * Staff-role authorization through the real Next.js routes, with real Supabase sessions (SSR auth cookie).
 * LOCAL Supabase only: creates Auth users and memberships. The app must be built/started against the same
 * local stack (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 …).
 *
 *   node scripts/security-role-http-isolated.mjs http://127.0.0.1:3000
 *
 * Authorization runs before body validation in every admin API, so an empty body probes permissions without
 * mutating anything: allowed → 400 validation_failed, not allowed → 403, no session → 401. Only the legal
 * approval checks perform real (local) writes.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL must be a local Supabase.");
  process.exit(2);
}
const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

/** @supabase/ssr cookie: "base64-" + base64url(session JSON), chunked at 3180 chars (.0, .1 …). */
function sessionCookie(session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (value.length <= 3180) return `${cookieName}=${value}`;
  const parts = [];
  for (let i = 0, n = 0; i < value.length; i += 3180, n++) parts.push(`${cookieName}.${n}=${value.slice(i, i + 3180)}`);
  return parts.join("; ");
}

const users = [];
async function user(role, active = true) {
  const email = `lh-http-${role ?? "nonstaff"}${active ? "" : "-inactive"}-${Date.now()}@lh-test.local`;
  const password = `T3st-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role) await admin.from("admin_memberships").upsert({ user_id: data.user.id, role, is_active: active });
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const u = { label: role ? `${role}${active ? "" : "(inactive)"}` : "nonstaff", role, active, id: data.user.id, cookie: sessionCookie(s.session) };
  users.push(u);
  return u;
}

async function call(u, method, p, body) {
  const res = await fetch(base + p, {
    method,
    redirect: "manual",
    headers: { ...(u ? { cookie: u.cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), origin: base },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await res.arrayBuffer();
  return { status: res.status, location: res.headers.get("location") || "" };
}

const APIS = [
  { m: "PATCH", p: "/api/admin/content/about", roles: ["owner", "admin", "manager", "editor"] },
  { m: "PATCH", p: "/api/admin/products/iso-http-none", roles: ["owner", "admin", "manager", "editor"] },
  { m: "POST", p: "/api/admin/shipping-zones", roles: ["owner", "admin", "manager"] },
  { m: "POST", p: "/api/admin/cod-collections", roles: ["owner", "admin", "manager", "fulfillment"] },
  { m: "POST", p: "/api/admin/orders/LH-NONE/status", roles: ["owner", "admin", "manager", "fulfillment"] },
  { m: "PATCH", p: "/api/admin/shipping-zones/00000000-0000-4000-8000-000000000000", roles: ["owner", "admin", "manager"] },
  { m: "POST", p: "/api/admin/notifications/retry", roles: ["owner", "admin", "manager", "fulfillment"] },
];
const PAGES = [
  { p: "/admin/content", roles: ["owner", "admin", "manager", "editor"] },
  { p: "/admin/products", roles: ["owner", "admin", "manager", "editor"] },
  { p: "/admin/orders", roles: ["owner", "admin", "manager", "fulfillment"] },
  { p: "/admin/inquiries", roles: ["owner", "admin", "manager", "editor", "fulfillment"] },
  { p: "/admin/settings", roles: ["owner", "admin", "manager"] },
];

try {
  const subjects = [];
  for (const r of ["owner", "admin", "manager", "editor", "fulfillment"]) subjects.push(await user(r));
  subjects.push(await user("manager", false), await user(null));

  // Anonymous.
  for (const a of APIS) {
    const r = await call(null, a.m, a.p, {});
    assert(`anon ${a.m} ${a.p}`, r.status === 401, `status=${r.status}`);
  }
  for (const pg of PAGES) {
    const r = await call(null, "GET", pg.p);
    assert(`anon GET ${pg.p}`, r.status >= 300 && r.status < 400 && r.location.includes("/admin/login"), `${r.status} ${r.location}`);
  }

  // Every subject × every API / page.
  for (const u of subjects) {
    for (const a of APIS) {
      const allowed = u.active && u.role && a.roles.includes(u.role);
      const r = await call(u, a.m, a.p, {});
      // Allowed: past authorization (400 validation or 404 unknown resource), never 401/403/5xx.
      const ok = allowed ? r.status === 400 || r.status === 404 : r.status === 403 || r.status === 401;
      assert(`${u.label} ${a.m} ${a.p} → ${allowed ? "allowed" : "denied"}`, ok, `status=${r.status}`);
    }
    for (const pg of PAGES) {
      const allowed = u.active && u.role && pg.roles.includes(u.role);
      const r = await call(u, "GET", pg.p);
      const ok = allowed ? r.status === 200 : r.status >= 300 && r.status < 400 && /\/admin\/(forbidden|login)/.test(r.location);
      assert(`${u.label} GET ${pg.p} → ${allowed ? "200" : "redirect"}`, ok, `${r.status} ${r.location}`);
    }
  }

  // Legal approval separation on a policy page (local writes).
  const by = Object.fromEntries(subjects.map((s) => [s.label, s]));
  const legal = { title: "Shipping & delivery", status: "published", bodyHtml: "<p>Local test</p>" };
  let r = await call(by.editor, "PATCH", "/api/admin/content/shipping", { ...legal, legalApproved: true });
  assert("editor cannot legally approve a policy page", r.status === 403, `status=${r.status}`);
  r = await call(by.editor, "PATCH", "/api/admin/content/shipping", legal);
  assert("editor cannot publish a policy page", r.status === 403, `status=${r.status}`);
  r = await call(by.manager, "PATCH", "/api/admin/content/shipping", { ...legal, legalApproved: false });
  assert("publishing a policy page without legal approval is refused", r.status === 409, `status=${r.status}`);
  r = await call(by.owner, "PATCH", "/api/admin/content/shipping", { ...legal, legalApproved: true });
  const row = (await admin.from("content_pages").select("status, legal_approved, legal_approved_by").eq("slug", "shipping").single()).data;
  assert("owner can approve and publish a policy page", r.status === 200 && row?.legal_approved === true && row?.legal_approved_by === by.owner.id, `status=${r.status} ${JSON.stringify(row)}`);
  // Public view now shows the CMS body; then withdraw approval and confirm it is gated again.
  let html = await (await fetch(`${base}/pages/shipping`)).text();
  assert("published policy renders CMS body", html.includes("Local test"));
  // Product pages label each policy link from the CMS state (published + approved → no "being finalised" tag).
  const pdpHandle = (await admin.from("products").select("handle").eq("status", "active").limit(1).maybeSingle()).data?.handle;
  const deliveryCard = async () => {
    const page = await (await fetch(`${base}/products/${pdpHandle}`)).text();
    return [...page.matchAll(/<a[^>]*href="\/pages\/shipping"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]).find((t) => />Delivery</.test(t)) ?? null;
  };
  if (pdpHandle) {
    const card = await deliveryCard();
    assert("product page: published delivery policy has no pending tag", card !== null && !card.includes("BEING FINALISED"), String(card).slice(0, 120));
  }
  const anonDb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const leak = await anonDb.from("content_pages").select("legal_approved_by").eq("slug", "shipping");
  assert("approver id is not readable by anon", !!leak.error, leak.error?.message || JSON.stringify(leak.data));
  await call(by.owner, "PATCH", "/api/admin/content/shipping", { ...legal, status: "pending", legalApproved: false });
  html = await (await fetch(`${base}/pages/shipping`)).text();
  assert("withdrawn policy is gated again immediately", !html.includes("Local test") && html.includes("BEING FINALISED"));
  if (pdpHandle) {
    const card = await deliveryCard();
    assert("product page: withdrawn delivery policy is tagged again immediately", card !== null && card.includes("BEING FINALISED"), String(card).slice(0, 120));
  }

  // Empty-body publish = publishing the V5 template: refused while the template has pending sections, and
  // otherwise only with explicit template approval (docs/PRODUCTION_READINESS.md, CMS rules).
  const empty = (title, extra = {}) => ({ title, status: "published", bodyHtml: "", ...extra });
  r = await call(by.owner, "PATCH", "/api/admin/content/about", empty("About", { approveTemplate: true }));
  assert("empty-body publish refused for a template with pending sections", r.status === 409, `status=${r.status}`);
  html = await (await fetch(`${base}/pages/about`)).text();
  assert("about stays gated", html.includes("BEING FINALISED"));
  r = await call(by.manager, "PATCH", "/api/admin/content/faq", empty("FAQ"));
  assert("empty-body publish needs explicit template approval", r.status === 409, `status=${r.status}`);
  r = await call(by.manager, "PATCH", "/api/admin/content/faq", empty("FAQ", { approveTemplate: true }));
  html = await (await fetch(`${base}/pages/faq`)).text();
  assert("approved template publishes (faq)", r.status === 200 && !html.includes("BEING FINALISED") && !/noindex/.test(html), `status=${r.status}`);
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  assert("published template is in the sitemap, gated pages are not", sitemap.includes("/pages/faq") && !sitemap.includes("/pages/about"));
  await call(by.manager, "PATCH", "/api/admin/content/faq", { title: "FAQ", status: "pending", bodyHtml: "" });
  html = await (await fetch(`${base}/pages/faq`)).text();
  assert("unpublished template is gated again", html.includes("BEING FINALISED") && /noindex/.test(html));

  // COD collection through the admin route: record, replay, conflict (docs/COD_IDEMPOTENCY_CONTRACT.md).
  const orderNumber = `LH-SANDBOX-HTTP-${Date.now()}`;
  const { data: ord } = await admin.from("orders").insert({
    order_number: orderNumber, status: "confirmed", payment_method: "cod", payment_status: "unpaid_cod",
    customer_name: "SANDBOX TEST — DELETE", customer_phone_e164: "+923001112233", customer_phone_normalized: "3001112233",
    subtotal_paisa: 1_000_000, shipping_paisa: 0, cod_fee_paisa: 0, discount_paisa: 0, tax_paisa: 0,
    total_due_paisa: 1_000_000, amount_collected_paisa: 0, idempotency_key: `sandbox-order-${orderNumber}`,
  }).select("id").single();
  try {
    const key = `http-${randomUUID()}`;
    const post = async (u, body) => {
      const res = await fetch(`${base}/api/admin/cod-collections`, { method: "POST", headers: { cookie: u.cookie, "content-type": "application/json", origin: base }, body: JSON.stringify(body) });
      return { status: res.status, json: await res.json().catch(() => ({})) };
    };
    const c1 = await post(by.fulfillment, { orderNumber, amountPkr: 1000, idempotencyKey: key });
    const c2 = await post(by.fulfillment, { orderNumber, amountPkr: 1000, idempotencyKey: key });
    const c3 = await post(by.fulfillment, { orderNumber, amountPkr: 2000, idempotencyKey: key });
    const c4 = await post(by.editor, { orderNumber, amountPkr: 1000, idempotencyKey: `http-${randomUUID()}` });
    const o = (await admin.from("orders").select("amount_collected_paisa").eq("id", ord.id).single()).data;
    assert("collection recorded once via route", c1.status === 200 && c1.json.idempotentReplay === false && o?.amount_collected_paisa === 100_000, `${c1.status} ${JSON.stringify(c1.json)} collected=${o?.amount_collected_paisa}`);
    assert("retry with same key replays", c2.status === 200 && c2.json.idempotentReplay === true && c2.json.collectionId === c1.json.collectionId, `${c2.status} ${JSON.stringify(c2.json)}`);
    assert("same key, different amount → 409 conflict, no constraint leak", c3.status === 409 && c3.json.error === "idempotency_conflict" && !/uidx|constraint|duplicate/i.test(JSON.stringify(c3.json)), `${c3.status} ${JSON.stringify(c3.json)}`);
    assert("editor cannot record collections", c4.status === 403, `status=${c4.status}`);
  } finally {
    await admin.from("audit_logs").delete().eq("entity_id", ord.id);
    await admin.from("orders").delete().eq("id", ord.id);
  }
} finally {
  for (const u of users) {
    await admin.from("admin_memberships").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id).catch(() => null);
  }
}

const out = path.join(root, "docs", "SECURITY_ROLE_HTTP_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ supabase: "local", base, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
