/**
 * Idempotent catalog import from data/lh-catalog.js (sanitized public fields).
 * Does NOT commit CRM notes or cost fields.
 *
 * Usage:
 *   node scripts/import-catalog.mjs --dry-run
 *   node scripts/import-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnvLocal();

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function loadCatalog() {
  const s = fs.readFileSync(path.join(root, "data", "lh-catalog.js"), "utf8");
  const eq = s.indexOf("window.LH_CATALOG");
  let i = s.indexOf("=", eq) + 1;
  while (/\s/.test(s[i])) i++;
  let depth = 0;
  let end = -1;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "[") depth++;
    else if (s[j] === "]") {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${s.slice(i, end + 1)})`)();
}

function majorToPaisa(major) {
  return Math.round(Number(major) * 100);
}

function safeDescription(p) {
  // Never use Body HTML / CRM notes. Prefer curated intro if present.
  const bits = [];
  if (p.intro && typeof p.intro === "string") bits.push(String(p.intro).trim());
  if (p.specs && typeof p.specs === "object") {
    const entries = Object.entries(p.specs)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .slice(0, 12)
      .map(([k, v]) => `${k}: ${v}`);
    if (entries.length) bits.push(entries.join(" · "));
  }
  return bits.join("\n\n").slice(0, 4000);
}

const catalog = loadCatalog();
console.log(`Loaded ${catalog.length} products from lh-catalog.js`);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = {
  dryRun,
  total: catalog.length,
  upserted: 0,
  drafts: 0,
  active: 0,
  media: 0,
  skippedZeroPriceActive: 0,
  errors: [],
};

async function upsertOne(p) {
  const handle = p.h;
  const status = p.status === "draft" ? "draft" : "active";
  const pricePaisa = majorToPaisa(p.price ?? 0);
  if (status === "active" && pricePaisa <= 0) {
    report.skippedZeroPriceActive++;
    report.errors.push({ handle, error: "active_zero_price" });
    return;
  }

  const product = {
    handle,
    title: p.t || handle,
    description_safe: safeDescription(p),
    merchant_vendor: "Laptops HUB",
    manufacturer: p.brand || null,
    product_type: p.type || p.deviceType || null,
    category: p.catLabel || p.cat || null,
    status,
    featured: false,
    media_approval: "pending",
    tags: Array.isArray(p.flags) ? p.flags.map(String) : [],
    specs: {
      cpu: p.cpu ?? null,
      gen: p.gen ?? null,
      ram: p.ram ?? null,
      storage: p.sto ?? null,
      size: p.size ?? null,
      condition: p.cond ?? null,
      touch: p.touch ?? null,
      model: p.model ?? null,
      config: p.config ?? null,
      ...(p.specs && typeof p.specs === "object" ? p.specs : {}),
    },
    flags: Array.isArray(p.flags) ? p.flags.map(String) : [],
    import_source: "lh-catalog.js",
  };

  if (dryRun) {
    report.upserted++;
    if (status === "draft") report.drafts++;
    else report.active++;
    report.media += Array.isArray(p.imgs) ? p.imgs.length : 0;
    return;
  }

  const { data: prod, error } = await supabase
    .from("products")
    .upsert(product, { onConflict: "handle" })
    .select("id")
    .single();
  if (error) {
    report.errors.push({ handle, error: error.message });
    return;
  }

  const { error: vErr } = await supabase.from("product_variants").upsert(
    {
      product_id: prod.id,
      sku: p.sku || null,
      title: "Default",
      price_paisa: pricePaisa,
      compare_at_paisa: p.cmp != null ? majorToPaisa(p.cmp) : null,
      purchasable: status === "active" && pricePaisa > 0,
      inventory_mode: "untracked",
      max_per_order: 5,
    },
    { onConflict: "product_id,sku" },
  );
  // Unique (product_id, sku) — null SKUs may collide; fallback delete+insert
  if (vErr) {
    await supabase.from("product_variants").delete().eq("product_id", prod.id);
    const { error: vErr2 } = await supabase.from("product_variants").insert({
      product_id: prod.id,
      sku: p.sku || `SKU-${handle}`.slice(0, 64),
      title: "Default",
      price_paisa: pricePaisa,
      compare_at_paisa: p.cmp != null ? majorToPaisa(p.cmp) : null,
      purchasable: status === "active" && pricePaisa > 0,
      inventory_mode: "untracked",
      max_per_order: 5,
    });
    if (vErr2) {
      report.errors.push({ handle, error: vErr2.message });
      return;
    }
  }

  await supabase.from("product_media").delete().eq("product_id", prod.id);
  const imgs = Array.isArray(p.imgs) ? p.imgs : [];
  if (imgs.length) {
    const rows = imgs.map((img, idx) => ({
      product_id: prod.id,
      url: typeof img === "string" ? img : img.u || img.url || img.src,
      alt: (typeof img === "object" && (img.a || img.alt)) || p.t || handle,
      position: idx + 1,
      approval: "pending",
    }));
    const { error: mErr } = await supabase.from("product_media").insert(rows);
    if (mErr) report.errors.push({ handle, error: mErr.message });
    else report.media += rows.length;
  }

  report.upserted++;
  if (status === "draft") report.drafts++;
  else report.active++;
}

for (const p of catalog) {
  await upsertOne(p);
}

const outPath = path.join(root, "docs", "IMPORT_RECONCILIATION.md");
const md = `# Import reconciliation

- Dry run: ${dryRun}
- Catalog source products: ${report.total}
- Upserted: ${report.upserted}
- Active intended: ${report.active}
- Drafts: ${report.drafts}
- Media rows: ${report.media}
- Errors: ${report.errors.length}

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`;
fs.writeFileSync(outPath, md);
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${outPath}`);
if (report.errors.length) process.exitCode = 1;
