# CURSOR MASTER EXECUTION STATE

**Updated:** 2026-10-25 (PKT) — post local migration smoke + CSV commit  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Branch:** `feat/merchant-operating-system`

---

## Verified baseline

| Item | Value |
|---|---|
| Branch HEAD | see `git log -1` |
| `main` cut | `2b43236` |
| Supabase Production | `xvmmjkrkgznnakcobmww` — **14 migrations only** (no 20261025\* applied) |
| Local Supabase | Docker up · `supabase db reset` applied **all 16** migrations incl. `20261025120000` + `20261025130000` |
| COD | OFF everywhere for Production |

---

## Local migration smoke (2026-10-25)

```
npx supabase db reset   # LOCAL ONLY — succeeded
npm run test:merchant:smoke   # 25/25
npm run test:merchant:csv     # dry-run + commit + idempotent reimport OK
npm run test:unit             # all green incl. collection-rule-eval + shopify csv/export
npm run build                 # green
```

Defects found & fixed during smoke:
1. PostgREST bulk insert nulls `health_status` (bypasses DEFAULT) → always set in API/smoke  
2. Media reorder unique `(product_id, position)` collisions → two-phase reorder  

---

## Completed capabilities

### Admin / catalog
- Premium admin shell + IA routes  
- Product create/edit/SEO/inventory/media/archive/soft-delete/restore/duplicate  
- Collections create + membership + **automated rule evaluator** wired into `resolveCollection` (`db-rule`)  
- Shopify CSV: client preview · **server dry-run** · **local commit** (Production host blocked) · modern export  
- Theme: draft editor · local publish API · `THEME_PUBLISHED_ENABLED=1` gate for storefront read (default off = V5 code path)

### Migrations (local only — NOT Production)
- `20261025120000_merchant_catalog_extensions.sql`  
- `20261025130000_site_builder_sections.sql`

### Docs
- Execution matrix, media policy, data model, CSV matrix, site builder schema, this file  

---

## NOT done / next

1. Bulk editor grid + hard-delete eligibility UI  
2. Full variant options matrix builder  
3. Legacy + LH sidecar CSV exports  
4. Wire homepage `page.tsx` to published sections behind env flag (code helper ready)  
5. Accurate iframe preview + rollback UI  
6. Orders/settings enterprise redesign  
7. Playwright admin E2E against local stack  
8. Protected Preview after push (mutating admin needs isolated DB — Production schema lacks new columns)

---

## Production boundaries (unchanged)

Never: Production migrate · Production CSV commit · theme publish to Prod · COD on · merge `main`

### Owner approval package (when ready)
1. Review SQL diffs for both 20261025 migrations  
2. Approve Preview with isolated DB or read-only Preview against Prod (limited)  
3. Later: Production migrate + controlled launch sequence  

---

## Resume commands

```bash
git checkout feat/merchant-operating-system
# Docker Desktop running:
npx supabase start
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
# + local ANON + SERVICE_ROLE from `npx supabase status`
npm run test:merchant:smoke
npm run test:merchant:csv
npm run test:unit
npm run build
git push -u origin feat/merchant-operating-system   # Preview
```

## NEXT ACTION

1. Push feature branch for Vercel Preview (read-only/smoke safe; mutating admin against Prod schema incomplete)  
2. Continue bulk editor + variant matrix + storefront theme wire behind flag  
3. Playwright local admin journeys
