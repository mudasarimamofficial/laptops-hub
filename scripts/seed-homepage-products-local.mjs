/** Seed the three default homepage hero/story products on local Supabase (minimal). */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("seed-homepage-products");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const products = [
  {
    handle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
    title: "Dell Latitude 7420",
    manufacturer: "Dell",
    price: 7000000,
  },
  {
    handle: "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
    title: "HP ProBook 640 G2",
    manufacturer: "HP",
    price: 4500000,
  },
  {
    handle: "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
    title: "Lenovo ThinkPad T580",
    manufacturer: "Lenovo",
    price: 5500000,
  },
];

for (const p of products) {
  const { data: existing } = await sb.from("products").select("id").eq("handle", p.handle).maybeSingle();
  let productId = existing?.id;
  if (!productId) {
    const { data, error } = await sb
      .from("products")
      .insert({
        handle: p.handle,
        title: p.title,
        status: "active",
        description_safe: p.title,
        manufacturer: p.manufacturer,
        product_type: "Laptop",
        category: "Laptop",
        featured: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
    await sb.from("product_variants").insert({
      product_id: productId,
      title: "Default",
      price_paisa: p.price,
      inventory_mode: "untracked",
      purchasable: true,
      option_values: {},
      position: 1,
    });
    await sb.from("product_media").insert({
      product_id: productId,
      url: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_c562a7e7-4615-4268-b232-b0e421758b28.jpg",
      alt: p.title,
      position: 1,
      approval: "approved",
      origin: "source_shopify",
      health_status: "ok",
    });
  }
}

console.log("seed-homepage-products-local: ok");
