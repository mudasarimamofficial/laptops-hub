/**
 * Programmatic catalog naming audit (read-only).
 * Distinguishes presentation risk (brand already in model) from source-data issues.
 */
import { createClient } from "@supabase/supabase-js";
import { formatProductDisplayName } from "../src/lib/catalog/product-display-name";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE URL / SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb
  .from("products")
  .select("handle, title, manufacturer, status, specs")
  .eq("status", "active")
  .limit(500);
if (error) {
  console.error(error.message);
  process.exit(1);
}

type Row = {
  handle: string;
  title: string;
  manufacturer: string | null;
  specs: Record<string, unknown> | null;
};

const rows = (data || []) as Row[];
const presentationRisk: { handle: string; brand: string; model: string; naive: string; fixed: string }[] = [];
const adjacentDupes: { handle: string; title: string }[] = [];

for (const r of rows) {
  const brand = (r.manufacturer || "").trim();
  const modelSpec = typeof r.specs?.model === "string" ? r.specs.model : "";
  const model = (modelSpec || r.title.split(/ [-—] /)[0] || r.title).trim();
  const naive = `${brand} ${model}`.replace(/\s+/g, " ").trim();
  const fixed = formatProductDisplayName(brand, model);
  if (brand && model && naive !== fixed) {
    presentationRisk.push({ handle: r.handle, brand, model, naive, fixed });
  }
  if (/\b(\w+)\s+\1\b/i.test(r.title)) {
    adjacentDupes.push({ handle: r.handle, title: r.title });
  }
}

console.log(
  JSON.stringify(
    {
      auditedActiveProducts: rows.length,
      presentationBrandDedupeNeeded: presentationRisk.length,
      titleAdjacentWordDupes: adjacentDupes.length,
      samplePresentationFixes: presentationRisk.slice(0, 15),
      sampleTitleDupes: adjacentDupes.slice(0, 10),
    },
    null,
    2,
  ),
);
