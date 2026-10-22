/* eslint-disable @typescript-eslint/no-explicit-any -- untyped V5 snapshot rows and raw PostgREST rows in a read-only QA script */
/**
 * Data parity: maps the live public catalog through the V5 adapter and compares every derived field
 * the V5 UI renders (model, config, brand, condition, chips, badge, price, image order, catalog order)
 * against the frozen V5 snapshot. Read-only, anon key.
 *
 *   npx tsx scripts/visual/verify-v5-data.mts
 */
import fs from "fs";
import vm from "vm";
import { createClient } from "@supabase/supabase-js";
import { toV5 } from "../../src/lib/catalog/v5-model.ts";
import { toPublicSpecs } from "../../src/lib/catalog/specs.ts";
import type { PublicProduct } from "../../src/types/catalog.ts";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const ctx: { window: { LH_CATALOG?: Record<string, unknown>[] } } = { window: {} };
vm.runInNewContext(fs.readFileSync("Laptops Hub storefront/data/lh-catalog.js", "utf8"), ctx);
const V5 = (ctx.window.LH_CATALOG || []).filter((p) => p.pub !== false) as Record<string, any>[];

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data, error } = await sb
  .from("products")
  .select("handle,title,manufacturer,category,specs,created_at,product_variants(id,sku,price_paisa,max_per_order,purchasable),product_media(url,alt,position)")
  .eq("status", "active")
  .order("created_at")
  .order("handle");
if (error) throw error;

const ord = (n: number) => { const s = n % 100; return n + (s >= 11 && s <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th"); };
const sto = (v: number) => (v >= 1000 ? Math.round(v / 1024) + "TB" : v + "GB");
const cpuF = (v: string) => (/^i\d$/.test(v) ? "Core " + v : v);
function v5Expected(p: Record<string, any>) {
  const parts = p.t.split(/ [-—] /);
  const ramN = parseInt(p.ram) || null, stoN = parseInt(p.sto) || null, comp = p.cat !== "accessory";
  const chips = comp ? [p.cpu ? cpuF(p.cpu) + (p.gen ? " · " + ord(p.gen) : "") : null, ramN ? ramN + "GB RAM" : null, stoN ? sto(stoN) : null, p.size ? p.size + '"' : null].filter(Boolean) : [p.sub || p.catLabel];
  return { model: p.model || parts[0], config: p.config != null ? p.config : parts.slice(1).join(" - "), brand: p.brand, cond: p.cond || null, chips, badge: (p.sub && p.cat !== "accessory" ? p.sub : p.catLabel) || "Laptop", cat: p.cat, pricePaisa: Math.round(p.price * 100), imgs: p.imgs.map((x: any) => x.u) };
}

const fields = ["model", "config", "brand", "cond", "chips", "badge", "cat", "pricePaisa", "imgs"] as const;
const mism: Record<string, string[]> = {};
let orderOk = true;
const rows = (data || []).map((r: any, i: number) => {
  const v = r.product_variants.find((x: any) => x.purchasable && x.price_paisa > 0);
  const pp: PublicProduct = { id: "", handle: r.handle, title: r.title, descriptionSafe: "", manufacturer: r.manufacturer, productType: null, category: r.category, featured: false, tags: [], specs: toPublicSpecs(r.specs), variantId: v.id, sku: v.sku, pricePaisa: v.price_paisa, compareAtPaisa: null, maxPerOrder: v.max_per_order, available: true, images: [...r.product_media].sort((a: any, b: any) => a.position - b.position).map((m: any) => ({ url: m.url, alt: m.alt, position: m.position })) };
  return toV5(pp, i);
});
rows.forEach((got, i) => {
  if (V5[i]?.h !== got.h) orderOk = false;
  const exp = V5.find((p) => p.h === got.h);
  if (!exp) { (mism.missing ||= []).push(got.h); return; }
  const e = v5Expected(exp) as Record<string, unknown>;
  const g: Record<string, unknown> = { ...got, imgs: got.imgs.map((x) => x.u) };
  for (const f of fields) if (JSON.stringify(e[f]) !== JSON.stringify(g[f])) (mism[f] ||= []).push(`${got.h}: v5=${JSON.stringify(e[f])} live=${JSON.stringify(g[f])}`);
});
console.log(`live ${rows.length} · v5 public ${V5.length} · catalog order identical: ${orderOk}`);
for (const f of [...fields, "missing"]) console.log(`${f.padEnd(10)} mismatches: ${(mism[f] || []).length}${(mism[f] || []).length ? "\n   " + mism[f].slice(0, 4).join("\n   ") : ""}`);
const bad = Object.values(mism).reduce((a, l) => a + l.length, 0);
fs.writeFileSync("docs/V5_DATA_PARITY_RESULTS.json", JSON.stringify({ at: new Date().toISOString(), live: rows.length, v5: V5.length, orderOk, mismatches: mism }, null, 2));
process.exit(bad || !orderOk ? 1 : 0);
