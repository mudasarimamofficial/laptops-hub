/**
 * Seeds a LOCAL Supabase with realistic, non-customer launch fixtures for the isolated browser journeys
 * (tests/e2e-isolated): two products, a Lahore/Punjab COD zone, checkout enabled in local store_settings, and staff
 * accounts (manager, fulfillment, editor). Refuses any non-local URL. Writes .isolated/fixture.json
 * (gitignored; contains only local test passwords).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… node scripts/test-fixtures/seed-isolated.mjs
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL must be a local Supabase.");
  process.exit(2);
}
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// Public catalog facts (the live catalog is public); prices here are test values on a local database.
const PRODUCTS = [
  {
    handle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
    title: "Dell Latitude 7420 Core i5 11th Gen 16GB RAM 256GB Storage",
    manufacturer: "Dell",
    price: 7_000_000,
    max: 2,
    img: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_75861162.jpg",
  },
  {
    handle: "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
    title: "Lenovo ThinkPad T580 Core i5 8th Gen 16GB RAM 512GB Storage",
    manufacturer: "Lenovo",
    price: 5_500_000,
    max: 2,
    img: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_75861162.jpg",
  },
];

const out = { products: [], zone: null, staff: {} };
for (const p of PRODUCTS) {
  const prod = must(
    await sb.from("products").upsert({ handle: p.handle, title: p.title, manufacturer: p.manufacturer, status: "active", category: "Laptop", product_type: "Laptop" }, { onConflict: "handle" }).select("id").single(),
    "product",
  );
  await sb.from("product_variants").delete().eq("product_id", prod.id);
  const v = must(await sb.from("product_variants").insert({ product_id: prod.id, sku: `ISO-${p.handle.slice(0, 12)}`, price_paisa: p.price, max_per_order: p.max, purchasable: true }).select("id").single(), "variant");
  await sb.from("product_media").delete().eq("product_id", prod.id);
  must(await sb.from("product_media").insert({ product_id: prod.id, url: p.img, alt: p.title, position: 1 }), "media");
  out.products.push({ handle: p.handle, title: p.title, pricePaisa: p.price, variantId: v.id, max: p.max });
}

const zone = must(
  await sb.from("shipping_zones").insert({ name: "Lahore standard (test)", provinces: ["Punjab"], cities: ["Lahore"], flat_fee_paisa: 30_000, cod_fee_paisa: 15_000, is_active: true, notes: "Test zone" }).select("id").single(),
  "zone",
);
out.zone = { id: zone.id, city: "Lahore", province: "Punjab", flatFeePaisa: 30_000, codFeePaisa: 15_000 };
must(await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true } }), "cod setting");

for (const role of ["manager", "fulfillment", "editor"]) {
  const email = `iso-${role}-${Date.now()}@lh-test.local`;
  const password = `T3st-${randomUUID()}`;
  const u = must(await sb.auth.admin.createUser({ email, password, email_confirm: true }), "user");
  must(await sb.from("admin_memberships").upsert({ user_id: u.user.id, role, is_active: true }), "membership");
  out.staff[role] = { email, password, id: u.user.id };
}

// Checkout requires the five policies to be published and legally approved: local stand-in policy text (never real
// terms) so the isolated journeys can order. Suites that toggle a policy restore it afterwards.
for (const slug of ["shipping", "returns", "warranty", "privacy", "terms"]) {
  must(
    await sb
      .from("content_pages")
      .update({ status: "published", body_html: `<h2>Local test policy</h2><p>Isolated test stand-in for ${slug}.</p>`, legal_approved: true, legal_approved_by: out.staff.manager.id })
      .eq("slug", slug),
    `policy ${slug}`,
  );
}

fs.mkdirSync(path.join(root, ".isolated"), { recursive: true });
fs.writeFileSync(path.join(root, ".isolated", "fixture.json"), JSON.stringify(out, null, 2));
console.log(`seeded ${out.products.length} products, zone ${out.zone.id}, staff ${Object.keys(out.staff).join(", ")}`);
