# CURSOR MASTER EXECUTION STATE

**Updated:** 2026-10-25 (PKT)  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Bible:** session-ingested `LAPTOPS_HUB_CURSOR_ULTIMATE_ENTERPRISE_ADMIN_COD_MASTER_BIBLE_2026-10-25` (authoritative brief)

---

## Verified baseline (read-only)

| Item | Value |
|---|---|
| Git branch | `feat/merchant-operating-system` (from `main`) |
| Branch HEAD | see `git log -1` (includes admin shell + catalog ops commits) |
| `main` HEAD at branch cut | `2b43236671983f22ed8766fc765addf4ea44a7d3` (PR #9) |
| Supabase ref | `xvmmjkrkgznnakcobmww` |
| Migration ledger (remote) | **14/14** applied through `20261024100000` — **no Production push of new migration yet** |
| Catalog | 232 products · 226 active · 6 draft · 964 media · 16 collections · **0** shipping zones |
| COD | DB `cod_checkout.enabled=false` · keep env gate OFF |
| Production | Vercel project `laptops-hub` Ready; do not merge/deploy without owner approval |

---

## Completed this session

### Phase 0
- [x] Confirm GitHub `main` HEAD matches Bible baseline
- [x] Read-only Supabase migration list + catalog counts
- [x] Capability gap matrix started (`docs/ENTERPRISE_ADMIN_EXECUTION_MATRIX.md`)
- [x] Feature branch created

### Phase 1 — Admin shell
- [x] Premium sidebar + mobile nav (`src/components/admin/shell/*`)
- [x] Admin design tokens (`src/styles/admin.css`) — storefront V5 tokens untouched
- [x] Shared UI: page header, status badge, empty state, module status panel
- [x] Overview dashboard with live operational counts + COD readiness strip
- [x] Nav IA wired for all merchant sections

### Phase 2 — Product / media foundations
- [x] Additive migration draft `supabase/migrations/20261025120000_merchant_catalog_extensions.sql` (**local only**)
- [x] Product list: thumbnails, inventory badge, media counts, rights pending
- [x] Create product UI + `POST /api/admin/products`
- [x] Soft-delete / archive / restore via `DELETE`/`PATCH` on `/api/admin/products/[handle]`
- [x] Media URL add / reorder / remove API + product media manager (external HTTPS; rights stay pending)
- [x] Shopify CSV detect/stage helpers + import **preview** wizard (commit gated)
- [x] Unit test `tests/unit/shopify-csv.test.ts`

### Scaffolded with real reads (honest incomplete UX)
- Collections list + detail read
- Inventory counts by mode
- Customers from orders
- Media library grid
- Analytics (orders / COD collected / inquiries)
- Activity log
- Online store / navigation / SEO / bulk / export status panels

---

### Phase 3 / 4 progress (continued)

- [x] Collections create API + form (manual / automated rule JSON)
- [x] Collection membership add/remove/reorder + product search API
- [x] Shopify modern CSV **export** endpoint + Admin download links
- [x] Inventory mode controls on product edit form
- [x] `docs/SHOPIFY_CSV_COMPATIBILITY_MATRIX.md`

### Phase 5 start

- [x] `theme_templates` / `theme_versions` / `theme_publications` migration draft (`20261025130000`)
- [x] Section registry + V5 homepage defaults (`site-builder-schema.ts`)
- [x] Admin Customize UI (draft tree / inspector) + `GET/PUT /api/admin/theme/homepage`
- [x] `docs/SITE_BUILDER_SCHEMA.md`
- [ ] Storefront read of published pointer (not wired — V5 code path preserved)
- [ ] Publish / rollback / accurate iframe preview

## NOT done (continue next)

1. Apply `20261025120000` on **local** Supabase only; never `db push --linked` without owner approval  
2. Options/variant matrix UI; SEO fields on product form; compare-at  
3. Smart-collection rule evaluator for storefront counts  
4. CSV dry-run/commit job runner on isolated DB (import commit still gated)  
5. Legacy CSV export + LH extended / inventory / membership sidecars  
6. Site builder schema + customize UI (Phase 5)  
7. Orders/settings modular redesign (Phase 6)  
8. E2E Playwright for admin shell + product create + media + export  
9. Push branch for protected Preview (owner/agent may push when ready)  
10. Merchant handbook screenshots from real Admin

---

## COD / Production guards

- Keep `COD_CHECKOUT_ENABLED` off and DB `cod_checkout.enabled=false`
- No Production schema mutation, catalog import commit, content publish, or live COD
- Do not run `scripts/import-catalog.mjs` against Production

---

## Resume commands

```bash
git checkout feat/merchant-operating-system
git status
npm run test:unit
npm run build
npm run dev
# local migration only:
npx supabase start
npx supabase db reset   # isolated — NEVER against linked Production
```

## NEXT ACTION

1. Local Supabase: apply `20261025120000` and smoke product soft-delete columns  
2. CSV dry-run API writing to `import_jobs` on isolated DB  
3. Phase 5: seed V5 homepage section schema (draft only, no Production publish)  
4. Optional: `git push -u origin feat/merchant-operating-system` for Vercel Preview
