# Architecture decisions

## 2026-10-21

1. **Independent platform, not Shopify** — Owner-mandated Next.js + Supabase + Vercel COD store. Shopify CSV is import-only.
2. **Checkout gated OFF** — `COD_CHECKOUT_ENABLED=false` until shipping zones + owner policies exist. No fake successful orders.
3. **Integer paisa** — All money stored as `bigint` paisa; CSV major PKR × 100.
4. **Public git hygiene** — CSV, `lh-catalog.js`, secrets, prototype ZIP/HTML stay local/gitignored.
5. **Service-role COD RPC** — `create_cod_order` is SECURITY DEFINER; anon cannot INSERT orders via Data API.
6. **No production promote** — Preview only until release gates + explicit go-live.

## 2026-10-22 — V5 reconstruction

7. **Port, don't reinterpret** — Storefront templates are near-verbatim React ports of `Laptops Hub Storefront v5.dc.html` / `ProductCard v5.dc.html` (inline styles copied from the source). V5's JS breakpoints (`w < 760` mobile, `< 1000` tablet, `≥ 1180` wide nav, `< 900` PDP/cart single column) are expressed as media queries in `src/styles/v5.css` so server HTML matches without a hydration jump.
8. **V5 data adapter** — `src/lib/catalog/v5-model.ts` maps live Supabase rows to the V5 product shape (chips, badge, model/config, catalog order = `products.created_at`). V5's sub-type taxonomy (Charger / Workstation / 2-in-1 …) is not in the DB yet; it ships as a generated handle map (`v5-taxonomy.ts`, `scripts/gen-v5-taxonomy.mjs`). Parity verified by `scripts/visual/verify-v5-data.mts` (226/226, 0 mismatches). Follow-up: move `sub` into `products.specs` with a reviewed migration.
9. **Server-side collections** — Filters/sort/paging are URL parameters evaluated on the server (V5 `match`/`sorted`), not a client-side catalog. Filtered URLs are `noindex, follow`.
10. **Fonts self-hosted, literal family names** — `next/font` loads V5's exact weights; tokens name the real families because the generated variable appends a metric-adjusted Arial that would render glyphs missing from the fonts (e.g. "→") differently from V5's `system-ui` fallback.
11. **Cutout media gate** — V5 hero/story cutouts load only from `V5_CUTOUT_BASE` (unset in Preview/Production until media rights are approved); otherwise catalog photos are shown. `stage.png` ("generated in project") is published as `public/v5/stage.webp`.
12. **Truthful copy over prototype copy** — Where V5 text describes the prototype ("Catalog snapshot from Shopify export", "Prototype cart…", "removed from the export"), the live site states the real situation; each case is listed in `docs/V5_PIXEL_DIFF_REPORT.md`.
