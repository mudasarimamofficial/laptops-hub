/**
 * Direct Data API (PostgREST) privilege matrix — what each role can do with ITS OWN token, bypassing the Next.js
 * route handlers entirely. The app performs every merchant write and every private read through the service role
 * after `requireStaff(allowedRoles)`, so a staff JWT must not be able to write merchant tables or read customer PII
 * directly: otherwise a fulfillment/editor account could change prices, enable COD, approve legal pages or record
 * fake cash collection without the app's role checks.
 *
 * Positive controls prove the public catalog still works for anon (and for a signed-in staff browsing the shop).
 *
 * LOCAL Supabase only (scripts/lib/local-only.mjs).
 *   node scripts/security-direct-staff-access.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.existsSync(path.join(root, ".env.local")) ? fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
await assertLocalOnly("security-direct-staff-access");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = randomUUID().slice(0, 8);
const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const users = [];
async function makeUser(label, role, active = true) {
  const email = `lh-direct-${label}-${RUN}@lh-test.local`;
  const password = `T3st-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  users.push(data.user.id);
  if (role) must(await admin.from("admin_memberships").upsert({ user_id: data.user.id, role, is_active: active }), "membership");
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await c.auth.signInWithPassword({ email, password }), "signin");
  return c;
}

// ── fixtures (service role) ───────────────────────────────────────────────────────────────────────────────────────
const fx = {};
try {
  fx.product = must(await admin.from("products").insert({ handle: `direct-${RUN}`, title: `Direct ${RUN}`, status: "active", option_names: ["RAM"], flags: ["internal-qa"], import_source: "qa" }).select("id").single(), "product");
  fx.variant = must(await admin.from("product_variants").insert({ product_id: fx.product.id, title: "8GB", option_values: { RAM: "8GB" }, price_paisa: 8500000, purchasable: true, inventory_mode: "tracked", quantity_on_hand: 4 }).select("id").single(), "variant");
  fx.media = must(await admin.from("product_media").insert({ product_id: fx.product.id, url: `https://example.invalid/${RUN}.jpg`, alt: "qa", position: 1, rights_note: "internal licence note" }).select("id").single(), "media");
  fx.zone = must(await admin.from("shipping_zones").insert({ name: `Direct ${RUN}`, is_active: false, flat_fee_paisa: 36000, cod_fee_paisa: 5000 }).select("id").single(), "zone");
  fx.page = must(await admin.from("content_pages").insert({ slug: `direct-${RUN}`, title: "QA", status: "pending" }).select("id").single(), "page");
  fx.order = must(await admin.from("orders").insert({ order_number: `LH-DIRECT-${RUN}`, customer_name: "Direct QA", customer_phone_e164: "+923001234567", customer_phone_normalized: "03001234567", subtotal_paisa: 100, total_due_paisa: 100, idempotency_key: `direct-${RUN}` }).select("id").single(), "order");
  const settingBefore = (await admin.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle()).data?.value ?? null;

  const roles = {
    owner: await makeUser("owner", "owner"),
    admin: await makeUser("admin", "admin"),
    manager: await makeUser("manager", "manager"),
    editor: await makeUser("editor", "editor"),
    fulfillment: await makeUser("fulfillment", "fulfillment"),
    inactive: await makeUser("inactive", "manager", false),
    customer: await makeUser("customer", null),
    anon: createClient(url, anonKey, { auth: { persistSession: false } }),
  };

  // ── direct writes: every role must be refused (the app writes through the service role only) ──────────────────
  const writes = [
    ["products.update(title)", (c) => c.from("products").update({ title: "HACKED" }).eq("id", fx.product.id).select("id"),
      async () => (await admin.from("products").select("title").eq("id", fx.product.id).single()).data.title !== "HACKED"],
    ["product_variants.update(price,stock)", (c) => c.from("product_variants").update({ price_paisa: 100, quantity_on_hand: 999 }).eq("id", fx.variant.id).select("id"),
      async () => { const v = (await admin.from("product_variants").select("price_paisa, quantity_on_hand").eq("id", fx.variant.id).single()).data; return v.price_paisa === 8500000 && v.quantity_on_hand === 4; }],
    ["product_media.insert", (c) => c.from("product_media").insert({ product_id: fx.product.id, url: "https://evil.invalid/x.jpg" }).select("id"),
      async () => (await admin.from("product_media").select("id", { count: "exact", head: true }).eq("url", "https://evil.invalid/x.jpg")).count === 0],
    ["store_settings.upsert(cod_checkout enabled)", (c) => c.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true, reason: "hacked" } }).select("key"),
      async () => JSON.stringify((await admin.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle()).data?.value ?? null) === JSON.stringify(settingBefore)],
    ["shipping_zones.update(fee 0)", (c) => c.from("shipping_zones").update({ flat_fee_paisa: 0, cod_fee_paisa: 0 }).eq("id", fx.zone.id).select("id"),
      async () => (await admin.from("shipping_zones").select("flat_fee_paisa").eq("id", fx.zone.id).single()).data.flat_fee_paisa === 36000],
    ["content_pages.update(legal_approved)", (c) => c.from("content_pages").update({ legal_approved: true, status: "published" }).eq("id", fx.page.id).select("id"),
      async () => (await admin.from("content_pages").select("legal_approved, status").eq("id", fx.page.id).single()).data.status === "pending"],
    ["orders.update(payment collected)", (c) => c.from("orders").update({ payment_status: "collected", amount_collected_paisa: 100 }).eq("id", fx.order.id).select("id"),
      async () => (await admin.from("orders").select("payment_status").eq("id", fx.order.id).single()).data.payment_status !== "collected"],
    ["cod_collections.insert", (c) => c.from("cod_collections").insert({ order_id: fx.order.id, amount_paisa: 100, idempotency_key: `direct-${RUN}-${Math.random()}` }).select("id"),
      async () => (await admin.from("cod_collections").select("id", { count: "exact", head: true }).eq("order_id", fx.order.id)).count === 0],
    ["articles.insert(published)", (c) => c.from("articles").insert({ slug: `hack-${RUN}-${Math.random().toString(36).slice(2, 7)}`, title: "x", status: "published" }).select("id"),
      async () => (await admin.from("articles").select("id", { count: "exact", head: true }).like("slug", `hack-${RUN}-%`)).count === 0],
    ["collections.insert", (c) => c.from("collections").insert({ slug: `hack-${RUN}-${Math.random().toString(36).slice(2, 7)}`, title: "x", published: true }).select("id"),
      async () => (await admin.from("collections").select("id", { count: "exact", head: true }).like("slug", `hack-${RUN}-%`)).count === 0],
  ];
  // Put every fixture back after each attempt so each role is judged on its own (a successful write by one role must
  // not make the following roles look guilty or innocent).
  const restore = async () => {
    await admin.from("products").update({ title: `Direct ${RUN}` }).eq("id", fx.product.id);
    await admin.from("product_variants").update({ price_paisa: 8500000, quantity_on_hand: 4 }).eq("id", fx.variant.id);
    await admin.from("product_media").delete().eq("url", "https://evil.invalid/x.jpg");
    if (settingBefore === null) await admin.from("store_settings").delete().eq("key", "cod_checkout");
    else await admin.from("store_settings").upsert({ key: "cod_checkout", value: settingBefore });
    await admin.from("shipping_zones").update({ flat_fee_paisa: 36000, cod_fee_paisa: 5000 }).eq("id", fx.zone.id);
    await admin.from("content_pages").update({ legal_approved: false, status: "pending" }).eq("id", fx.page.id);
    await admin.from("cod_collections").delete().eq("order_id", fx.order.id);
    await admin.from("orders").update({ payment_status: "unpaid_cod", amount_collected_paisa: 0 }).eq("id", fx.order.id);
    await admin.from("articles").delete().like("slug", `hack-${RUN}-%`);
    await admin.from("collections").delete().like("slug", `hack-${RUN}-%`);
  };
  for (const [label, attempt, unchanged] of writes) {
    for (const [who, client] of Object.entries(roles)) {
      const r = await attempt(client);
      const ok = await unchanged();
      assert(`direct write refused: ${who} ${label}`, ok, r.error ? `error ${r.error.code}` : `rows=${r.data?.length ?? 0}`);
      if (!ok) await restore();
    }
  }

  // ── customer PII / ops tables: no direct reads for any role ──────────────────────────────────────────────────────
  for (const table of ["orders", "order_addresses", "order_items", "order_events", "cod_collections", "notification_outbox", "audit_logs", "contact_inquiries", "import_jobs", "fulfillments"]) {
    for (const [who, client] of Object.entries(roles)) {
      const r = await client.from(table).select("*").limit(5);
      assert(`direct read refused: ${who} ${table}`, Boolean(r.error) || (r.data?.length ?? 0) === 0, r.error ? `error ${r.error.code}` : `rows=${r.data.length}`);
    }
  }

  // ── internal catalog columns stay hidden from public roles ───────────────────────────────────────────────────────
  for (const who of ["anon", "customer"]) {
    const c = roles[who];
    for (const [table, col] of [["products", "flags"], ["products", "media_approval"], ["products", "import_source"], ["product_variants", "quantity_on_hand"], ["product_variants", "inventory_mode"], ["product_variants", "cost_paisa"], ["product_variants", "allow_oversell"], ["product_media", "rights_note"], ["product_media", "approval"], ["product_media", "source_provider"]]) {
      const r = await c.from(table).select(col).limit(1);
      assert(`${who} cannot read ${table}.${col}`, Boolean(r.error), r.error ? r.error.code : "column readable");
    }
  }

  // ── positive controls: the public catalog still works ────────────────────────────────────────────────────────────
  for (const who of ["anon", "customer", "editor"]) {
    const c = roles[who];
    const p = await c.from("products").select("id, handle, title, option_names, product_variants ( id, title, option_values, price_paisa, position, media_id, purchasable ), product_media ( url, alt, position )").eq("id", fx.product.id).maybeSingle();
    assert(`${who} reads public product + variants + media`, !p.error && p.data?.product_variants?.length === 1 && p.data.product_media?.length === 1 && p.data.option_names?.[0] === "RAM", p.error?.message ?? "");
    const l = await c.from("public_catalog_listing").select("handle, variant_id, price_paisa").eq("id", fx.product.id);
    assert(`${who} reads public_catalog_listing`, !l.error && l.data.length === 1, l.error?.message ?? "");
    const v = await c.from("catalog_products_public").select("handle, variant_id").eq("id", fx.product.id);
    assert(`${who} reads catalog_products_public`, !v.error && v.data.length === 1, v.error?.message ?? "");
    const a = await c.rpc("storefront_variant_availability", { p_product_ids: [fx.product.id] });
    assert(`${who} reads variant availability (boolean only)`, !a.error && a.data?.length === 1 && a.data[0].available === true && Object.keys(a.data[0]).sort().join() === "available,product_id,variant_id", a.error?.message ?? JSON.stringify(a.data));
  }
  const ins = await roles.anon.from("contact_inquiries").insert({ name: `Direct ${RUN}`, phone: "03001234567", message: "qa direct access matrix" });
  assert("anon can still submit a contact inquiry (insert only)", !ins.error, ins.error?.message ?? "");
} finally {
  await admin.from("contact_inquiries").delete().like("name", `Direct ${RUN}%`);
  if (fx.order) { await admin.from("cod_collections").delete().eq("order_id", fx.order.id); await admin.from("orders").delete().eq("id", fx.order.id); }
  if (fx.product) await admin.from("products").delete().eq("id", fx.product.id);
  if (fx.zone) await admin.from("shipping_zones").delete().eq("id", fx.zone.id);
  if (fx.page) await admin.from("content_pages").delete().eq("id", fx.page.id);
  await admin.from("articles").delete().like("slug", `hack-${RUN}-%`);
  await admin.from("collections").delete().like("slug", `hack-${RUN}-%`);
  await admin.from("product_media").delete().eq("url", "https://evil.invalid/x.jpg");
  for (const id of users) { await admin.from("admin_memberships").delete().eq("user_id", id); await admin.auth.admin.deleteUser(id).catch(() => null); }
}

const out = path.join(root, "docs", "SECURITY_DIRECT_ACCESS_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), supabase: url, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · wrote ${path.relative(root, out)}`);
process.exit(failed.length ? 1 : 0);
