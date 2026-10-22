/**
 * Route completion check: every active product handle must render (200), every draft/archived handle must 404,
 * and each V5 collection id plus core pages must respond 200. Draft handles are read with the service role
 * (read-only, never printed with data).
 *
 *   node scripts/visual/check-routes.mjs [--base=http://127.0.0.1:3000] [--bypass=<vercel protection bypass token>]
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const BASE = arg("base", "http://127.0.0.1:3000").replace(/\/$/, "");
const BYPASS = arg("bypass", "");
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.from("products").select("handle,status");
if (error) throw error;
const active = data.filter((p) => p.status === "active").map((p) => p.handle);
const hidden = data.filter((p) => p.status !== "active").map((p) => p.handle);

const COLLECTIONS = ["all", "laptops", "gaming-laptops", "macbooks", "tablets", "accessories", "chargers", "workstations", "2-in-1", "apple", "microsoft", "asus", "acer", "toshiba", "business", "gen-6-7", "gen-8", "sto-128", "sto-256", "sto-512-plus", "core-i9", "dell", "hp", "lenovo", "core-i3", "core-i5", "core-i7", "gen-10-plus", "ram-4gb", "ram-8gb", "ram-16gb", "screen-13", "screen-14", "screen-15", "under-40k", "40k-60k", "over-60k", "touchscreen", "chromebooks"];
const PAGES = ["/", "/cart", "/compare", "/search?q=thinkpad", "/guides", "/checkout", "/track-order", "/robots.txt", "/sitemap.xml"];

const headers = BYPASS ? { "x-vercel-protection-bypass": BYPASS, "x-vercel-set-bypass-cookie": "false" } : {};
async function status(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(BASE + path, { headers, redirect: "manual" });
      await r.arrayBuffer();
      return r.status;
    } catch {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  return 0;
}
async function pool(items, fn, n = 8) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const res = { base: BASE, at: new Date().toISOString(), active: active.length, hidden: hidden.length, failures: [] };
const a = await pool(active, (h) => status(`/products/${h}`));
active.forEach((h, k) => a[k] !== 200 && res.failures.push(`active ${h} -> ${a[k]}`));
const d = await pool(hidden, (h) => status(`/products/${h}`));
hidden.forEach((h, k) => d[k] !== 404 && res.failures.push(`hidden ${h} -> ${d[k]}`));
const c = await pool(COLLECTIONS, (id) => status(`/collections/${id}`));
COLLECTIONS.forEach((id, k) => c[k] !== 200 && res.failures.push(`collection ${id} -> ${c[k]}`));
const pg = await pool(PAGES, status);
PAGES.forEach((p, k) => pg[k] !== 200 && res.failures.push(`page ${p} -> ${pg[k]}`));
const nf = await status("/no-such-page");
if (nf !== 404) res.failures.push(`unknown route -> ${nf}`);
const unknownCol = await status("/collections/no-such-collection");
if (unknownCol !== 404) res.failures.push(`unknown collection -> ${unknownCol}`);
res.summary = `${active.length - a.filter((s) => s !== 200).length}/${active.length} public PDPs 200 · ${hidden.length - d.filter((s) => s !== 404).length}/${hidden.length} hidden 404 · ${COLLECTIONS.length - c.filter((s) => s !== 200).length}/${COLLECTIONS.length} collections 200 · ${PAGES.length - pg.filter((s) => s !== 200).length}/${PAGES.length} pages 200`;
console.log(res.summary);
if (res.failures.length) console.log(res.failures.slice(0, 20).join("\n"));
fs.writeFileSync(`docs/ROUTE_CHECK_${/127\.0\.0\.1|localhost/.test(BASE) ? "LOCAL" : "PREVIEW"}.json`, JSON.stringify(res, null, 2));
process.exit(res.failures.length ? 1 : 0);
