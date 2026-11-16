/**
 * Local-only: stage + dry-run + commit + idempotent re-import for Shopify CSV.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("test-shopify-csv-commit-smoke.mjs");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const csv = `\uFEFFHandle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Price,Image Src,Image Position,Image Alt Text,Status
smoke-csv-a,Smoke CSV A,"<p>Desc A</p>",HP,Laptop,"business, smoke",TRUE,Condition,Excellent,SMOKE-CSV-A,125000.00,https://cdn.shopify.com/s/files/1/0000/0001/products/a.jpg,1,Front,active
smoke-csv-a,,,,,,,Condition,Excellent,,,https://cdn.shopify.com/s/files/1/0000/0001/products/a2.jpg,2,Side,
smoke-csv-b,Smoke CSV B,<p>Desc B</p>,Dell,Laptop,smoke,TRUE,Condition,Good,SMOKE-CSV-B,99000.50,https://cdn.shopify.com/s/files/1/0000/0001/products/b.jpg,1,Front,active
`;

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows[0] || []).map((h) => h.trim());
  return {
    headers,
    rows: rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    }),
  };
}

const { detectShopifyCsvProfile, stageShopifyRows } = await import("../src/lib/catalog/shopify-csv.ts");
const { commitStagedProducts } = await import("../src/lib/catalog/shopify-import-commit.ts");

const { headers, rows } = parseCsv(csv);
const detected = detectShopifyCsvProfile(headers);
if (detected.profile === "unknown") {
  console.error("detect failed");
  process.exit(1);
}
const staged = stageShopifyRows(rows, detected.mapped);
console.log(`staged products=${staged.products.length} errors=${staged.errors.length}`);

const dry = await commitStagedProducts(sb, staged.products, {
  strategy: "add_only",
  dryRun: true,
});
console.log("dry-run summary", dry.summary);

const first = await commitStagedProducts(sb, staged.products, {
  strategy: "add_only",
  dryRun: false,
});
console.log("commit summary", first.summary);
if (first.summary.created < 2) {
  console.error("expected 2 created", first.results);
  process.exit(1);
}

const { count: mediaCount } = await sb
  .from("product_media")
  .select("id", { count: "exact", head: true })
  .in("url", [
    "https://cdn.shopify.com/s/files/1/0000/0001/products/a.jpg",
    "https://cdn.shopify.com/s/files/1/0000/0001/products/a2.jpg",
    "https://cdn.shopify.com/s/files/1/0000/0001/products/b.jpg",
  ]);
console.log("media rows for smoke URLs", mediaCount);
if ((mediaCount ?? 0) < 3) {
  console.error("expected >=3 media URL refs");
  process.exit(1);
}

const second = await commitStagedProducts(sb, staged.products, {
  strategy: "add_only",
  dryRun: false,
});
console.log("reimport add_only summary", second.summary);
if (second.summary.skipped < 2) {
  console.error("expected skip on second add_only import", second.results);
  process.exit(1);
}

const { count: mediaAfter } = await sb
  .from("product_media")
  .select("id", { count: "exact", head: true })
  .in("url", [
    "https://cdn.shopify.com/s/files/1/0000/0001/products/a.jpg",
    "https://cdn.shopify.com/s/files/1/0000/0001/products/a2.jpg",
    "https://cdn.shopify.com/s/files/1/0000/0001/products/b.jpg",
  ]);
if (mediaAfter !== mediaCount) {
  console.error("media duplicated on reimport", mediaAfter, mediaCount);
  process.exit(1);
}

// cleanup
for (const h of ["smoke-csv-a", "smoke-csv-b"]) {
  const { data: p } = await sb.from("products").select("id").eq("handle", h).maybeSingle();
  if (p) {
    await sb.from("product_media").delete().eq("product_id", p.id);
    await sb.from("product_variants").delete().eq("product_id", p.id);
    await sb.from("collection_products").delete().eq("product_id", p.id);
    await sb.from("products").delete().eq("id", p.id);
  }
}

console.log("shopify-csv-commit-smoke: ok");
