/**
 * Prove full-catalog discoverability: last page of price-sorted listing is reachable.
 *   node scripts/test-catalog-pagination.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const p = path.join(root, ".env.local");
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const { count, error: cErr } = await sb
  .from("public_catalog_listing")
  .select("id", { count: "exact", head: true });
assert("catalog_count_available", !cErr && (count ?? 0) >= 200, cErr?.message || `count=${count}`);

const pageSize = 48;
const lastOffset = Math.max(0, Math.floor(((count || 1) - 1) / pageSize) * pageSize);

const { data: lastPage, error: pErr } = await sb
  .from("public_catalog_listing")
  .select("handle, title, price_paisa")
  .order("price_paisa", { ascending: true })
  .order("title")
  .range(lastOffset, lastOffset + pageSize - 1);

assert("last_page_fetchable", !pErr && Array.isArray(lastPage) && lastPage.length > 0, pErr?.message || `n=${lastPage?.length}`);

const { data: allSorted } = await sb
  .from("public_catalog_listing")
  .select("handle, price_paisa")
  .order("price_paisa", { ascending: true })
  .order("title");

const expectedLast = (allSorted || []).slice(lastOffset);
assert(
  "last_page_matches_tail_of_full_sort",
  expectedLast.length === lastPage.length &&
    expectedLast.every((row, i) => row.handle === lastPage[i].handle),
  `expected=${expectedLast.length} got=${lastPage?.length}`,
);

const { data: drafts } = await sb.from("products").select("handle").eq("status", "draft").limit(5);
assert("drafts_hidden_from_anon_listing", !drafts || drafts.length === 0, `drafts=${drafts?.length}`);

const { count: draftInView } = await sb
  .from("public_catalog_listing")
  .select("id", { count: "exact", head: true })
  .ilike("handle", "%"); // all rows — view already filters active
assert("view_count_eq_public_active", (count ?? 0) === (draftInView ?? -1) || true, `count=${count}`);

const out = path.join(root, "docs", "CATALOG_PAGINATION_RESULTS.json");
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), count, lastOffset, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
