/**
 * Full-catalog discoverability on the LOCAL stack, with a synthetic multi-page dataset that is always seeded (never
 * conditional on how many products the local DB happens to hold) and always removed.
 *
 *   node scripts/test-catalog-pagination.mjs [appBaseUrl]     (default http://127.0.0.1:3001)
 *
 * Proves, for 105 synthetic active products priced below every real fixture (so they lead the price-asc sort) plus
 * one synthetic draft:
 *   - the public listing view counts them and its last page equals the tail of the full sort (Data API level);
 *   - the storefront /collections/all?sort=price-asc "Load more" pages reveal exactly 12 more products per page, in
 *     price order, with no product skipped or repeated, and the final page shows every active product without a
 *     "Load more" link;
 *   - the draft is never listed and its PDP is 404.
 * Exit code 0 only if every check passed. Refuses a non-local Supabase or app.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { assertLocalOnly } from "./lib/local-only.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m || process.env[m[1]]) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}
await assertLocalOnly("test-catalog-pagination.mjs");
const APP = (process.argv[2] || process.env.TEST_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(APP)) throw new Error(`refusing non-local app ${APP}`);

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PREFIX = "qa-synth-page-";
const N = 105;
const PAGE = 12; // src/lib/catalog/v5-collection.ts
const RUN = Date.now().toString(36);
const synthHandle = (i) => `${PREFIX}${String(i).padStart(3, "0")}`;
const DRAFT = `${PREFIX}draft`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};
const cleanup = async () => must(await admin.from("products").delete().like("handle", `${PREFIX}%`), "cleanup");

/** Product handles in DOM order from a collection page (cards link to /products/<handle>). */
const handlesIn = (html) => {
  const seen = [];
  for (const m of html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
};
const get = async (p) => {
  const r = await fetch(APP + p, { headers: { "cache-control": "no-cache" } });
  return { status: r.status, html: await r.text() };
};

let failure = null;
try {
  await cleanup();
  const rows = Array.from({ length: N }, (_, k) => ({ title: `QA Synthetic Laptop ${String(k + 1).padStart(3, "0")}`, handle: synthHandle(k + 1), status: "active", manufacturer: "QA" }));
  rows.push({ title: "QA Synthetic Draft", handle: DRAFT, status: "draft", manufacturer: "QA" });
  const inserted = must(await admin.from("products").insert(rows).select("id, handle"), "insert synthetic products");
  const byHandle = Object.fromEntries(inserted.map((p) => [p.handle, p.id]));
  must(
    await admin.from("product_variants").insert(
      inserted.map((p) => {
        const i = p.handle === DRAFT ? 1 : Number(p.handle.slice(PREFIX.length));
        // Rs 1,000 + Rs 10 × i: below every real fixture and strictly increasing, so price-asc order is known.
        return { product_id: p.id, title: "Standard", sku: `QA-SYNTH-${RUN}-${p.handle.slice(PREFIX.length)}`, price_paisa: 100_000 + i * 1_000, quantity_on_hand: 10, position: 1, purchasable: true };
      }),
    ),
    "insert synthetic variants",
  );
  check("synthetic_dataset_seeded", Object.keys(byHandle).length === N + 1, `${N} active + 1 draft`);

  // ── Data API level ──
  const { count, error: cErr } = await anon.from("public_catalog_listing").select("id", { count: "exact", head: true });
  const { count: synthCount } = await anon.from("public_catalog_listing").select("id", { count: "exact", head: true }).like("handle", `${PREFIX}%`);
  check("view_lists_every_synthetic_active_product", !cErr && synthCount === N, cErr?.message || `synthetic=${synthCount} total=${count}`);
  const { data: draftRow } = await anon.from("public_catalog_listing").select("handle").eq("handle", DRAFT);
  check("view_hides_draft", Array.isArray(draftRow) && draftRow.length === 0, `rows=${draftRow?.length}`);

  const apiPage = 48;
  const lastOffset = Math.floor(((count || 1) - 1) / apiPage) * apiPage;
  const { data: lastPage, error: pErr } = await anon.from("public_catalog_listing").select("handle").order("price_paisa").order("title").order("id").range(lastOffset, lastOffset + apiPage - 1);
  const { data: allSorted } = await anon.from("public_catalog_listing").select("handle").order("price_paisa").order("title").order("id");
  const tail = (allSorted || []).slice(lastOffset);
  check(
    "view_last_page_equals_tail_of_full_sort",
    !pErr && lastPage?.length > 0 && tail.length === lastPage.length && tail.every((r, i) => r.handle === lastPage[i].handle),
    pErr?.message || `offset=${lastOffset} expected=${tail.length} got=${lastPage?.length}`,
  );
  check("view_first_rows_are_synthetic_in_price_order", (allSorted || []).slice(0, N).every((r, i) => r.handle === synthHandle(i + 1)), "price-asc");

  // ── Storefront level (catalog cache: unstable_cache tag "catalog", 60 s) ──
  const total = count;
  let first = null;
  for (let t = 0; t < 30; t++) {
    first = await get("/collections/all?sort=price-asc");
    if (first.status === 200 && first.html.includes(`Showing ${PAGE} of ${total}`) && handlesIn(first.html)[0] === synthHandle(1)) break;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  check("storefront_page1_shows_first_12_synthetic", first.status === 200 && handlesIn(first.html).filter((h) => h.startsWith(PREFIX)).join() === Array.from({ length: PAGE }, (_, k) => synthHandle(k + 1)).join(), `status=${first.status}`);

  const lastStorefrontPage = Math.ceil(total / PAGE);
  let prev = [];
  let pagesOk = true;
  const pageNotes = [];
  for (let p = 1; p <= lastStorefrontPage; p++) {
    const { status, html } = await get(`/collections/all?sort=price-asc${p > 1 ? `&page=${p}` : ""}`);
    const hs = handlesIn(html);
    const expectedLen = Math.min(p * PAGE, total);
    const prefixKept = prev.every((h, i) => hs[i] === h); // earlier products stay, in the same order
    const unique = new Set(hs).size === hs.length;
    const hasMore = html.includes(">Load more<");
    const ok = status === 200 && hs.length === expectedLen && prefixKept && unique && hasMore === p < lastStorefrontPage && !hs.includes(DRAFT);
    if (!ok) pagesOk = false;
    pageNotes.push(`p${p}:${status}/${hs.length}${hasMore ? "+more" : ""}`);
    prev = hs;
  }
  check("storefront_load_more_reaches_every_product", pagesOk && prev.length === total, `${lastStorefrontPage} pages, ${pageNotes.join(" ")}`);
  const synthOrder = prev.filter((h) => h.startsWith(PREFIX));
  check("storefront_final_page_has_all_synthetic_in_order", synthOrder.length === N && synthOrder.every((h, i) => h === synthHandle(i + 1)), `synthetic=${synthOrder.length}`);

  const draftPdp = await get(`/products/${DRAFT}`);
  check("draft_pdp_is_404", draftPdp.status === 404, `status=${draftPdp.status}`);

  fs.writeFileSync(path.join(root, "docs", "CATALOG_PAGINATION_RESULTS.json"), JSON.stringify({ at: new Date().toISOString(), app: APP, synthetic: N, total, pageSize: PAGE, results }, null, 2));
} catch (e) {
  failure = e;
  check("script_completed", false, e.message);
} finally {
  try {
    await cleanup();
  } catch (e) {
    check("cleanup", false, e.message);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
// Close fetch's keep-alive sockets before Node exits: on Windows, exiting with live undici handles can trip the libuv
// assertion "!(handle->flags & UV_HANDLE_CLOSING)" (async.c:94) and turn a finished run into exit code 127.
await globalThis[Symbol.for("undici.globalDispatcher.1")]?.close?.().catch(() => {});
process.exitCode = failed.length || failure ? 1 : 0;
