# CURSOR MASTER EXECUTION STATE

**Updated:** 2026-10-25 (PKT)  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Bible:** session-ingested `LAPTOPS_HUB_CURSOR_ULTIMATE_ENTERPRISE_ADMIN_COD_MASTER_BIBLE_2026-10-25` (authoritative brief)

---

## Verified baseline (read-only)

| Item | Value |
|---|---|
| Git branch | `feat/merchant-operating-system` (from `main`) |
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

## NOT done (continue next)

1. Apply `20261025120000` on **local** Supabase; regenerate types if used; never `db push --linked` without owner approval  
2. Full product edit: options matrix, multi-variant create, SEO fields, inventory mode on form  
3. Collections create/edit API + smart rules + drag membership  
4. CSV dry-run/commit job runner on isolated DB + export endpoints  
5. Site builder schema + customize UI (Phase 5)  
6. Orders/settings modular redesign (Phase 6)  
7. E2E Playwright for admin shell + product create + media  
8. Docs: design system, data model, CSV matrix, media policy, handbook (stubs → fill)  
9. Protected Preview on feature branch (no Production merge)

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
# local migration only, when local stack is up:
npx supabase start
npx supabase db reset   # isolated — NEVER against linked Production
# or: npx supabase migration up --local
npm run build
npm run dev
```

## NEXT ACTION

1. Run unit tests + `next build` to catch type/route errors  
2. Start/apply migration on local Supabase  
3. Extend `ProductEditForm` with inventory mode, SEO, compare-at  
4. Implement `POST /api/admin/collections` + membership editor  
5. Server-side CSV dry-run against local DB
