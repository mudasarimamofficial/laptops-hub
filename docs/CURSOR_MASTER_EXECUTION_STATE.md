# CURSOR MASTER EXECUTION STATE

**Updated:** 2026-10-25 (PKT) — write guard · homepage presets · variant matrix · rule builder  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Branch:** `feat/merchant-operating-system`

---

## Verified baseline

| Item | Value |
|---|---|
| Branch HEAD | `ff408a3` |
| `main` cut | `2b43236` |
| Supabase Production | `xvmmjkrkgznnakcobmww` — **14 migrations only** (no 20261025\* applied) |
| Local Supabase | Docker · **16** migrations incl. `20261025120000` + `20261025130000` |
| COD | OFF everywhere for Production |

---

## Session deliverables (this checkpoint)

### P0 — Preview → Production write guard
- `src/lib/security/merchant-write-guard.ts` — fail-closed policy
- `createAuthorizedStaffWriter()` — all merchant mutating admin APIs
- CSV import dry-run on Preview **does not** insert `import_jobs` / `audit_logs` when writes blocked
- Local Supabase + Vercel Production still allowed for writes; Preview+Prod ref blocked

### Homepage presentation images (7 approved CDN WebPs)
- `src/lib/content/homepage-image-presets.ts` — defaults + resolve priority:  
  **merchant override → approved preset (handle match) → catalog fallback**
- `src/app/page.tsx` — no longer prefers `cutoutUrl` over approved presets
- Schema + Customize editor: per-slot image URL, alt, reset, draft save, local publish
- **Does not** mutate `product_media` / PDP galleries / CSV mappings

| Slot | Before | After |
|---|---|---|
| Hero HP | `01-main_70e4489b-…jpg` | `laptop-hub-hero-hp-lap.webp?v=1792934111` |
| Hero Dell | `01-main_c562a7e7-…jpg` | `laptop-hub-hero-dell-lap.webp?v=1792934111` |
| Hero Lenovo | `01-main_1f07e66c-…jpg` | `laptop-hub-hero-lenovo-lap.webp?v=1792934111` |
| Story front | `01-main_c562a7e7-…jpg` | `dell-second_-home-sec-front.webp?v=1792935242` |
| Story left | `02-alt02_11a68162-…jpg` | `dell-second_-home-sec-left.webp?v=1792935243` |
| Story right | `03-alt03_df3f7a78-…jpg` | `dell-second_-home-sec-right.webp?v=1792935242` |
| Story rear | `04-alt04_328bc2fc-…jpg` | `dell-second_-home-sec-rear.webp?v=1792935243` |

CDN HEAD checks: all seven return **200**.

### Tests
- `tests/unit/merchant-write-guard.test.ts`
- `tests/unit/homepage-image-presets.test.ts`

---

## Completed capabilities (cumulative)

### Admin / catalog
- Premium admin shell + IA routes  
- Product create/edit/SEO/inventory/media/archive/soft-delete/restore/duplicate  
- Collections create + membership + automated rule evaluator  
- Shopify CSV: preview · dry-run (no Prod side-effects from Preview) · local commit · modern export  
- Theme: draft editor with image controls · local publish API · `THEME_PUBLISHED_ENABLED=1` gate  

### Migrations (local only — NOT Production)
- `20261025120000_merchant_catalog_extensions.sql`  
- `20261025130000_site_builder_sections.sql`

---

## Also shipped after e61a011

- Product **variant options matrix** (`ProductVariantMatrix` + `/api/admin/products/[handle]/variants`) — cartesian generate, SKU/price/inventory edit, ordered-variant safe removal  
- Collections **visual rule builder** (AND/OR conditions) — replaces raw JSON as the only editor  

## NOT done / next

1. Legacy + LH sidecar CSV exports + durable import retry UX  
2. Accurate iframe preview + rollback UI in Customize  
3. Orders/settings enterprise redesign  
4. Playwright admin E2E against local stack  
5. Owner-approved Production migration package  

---

## Production boundaries (unchanged)

Never: Production migrate · Production CSV commit · theme publish to Prod · COD on · merge `main`

---

## Resume commands

```bash
git checkout feat/merchant-operating-system
npx supabase start
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
npm run test:unit
npm run test:merchant:smoke
npm run build
git push -u origin feat/merchant-operating-system
```

## Preview notes

- Mutating admin against Production Supabase from Preview is **server-blocked**.
- Theme draft/publish tables missing on Prod until migrations approved — Customize falls back to code defaults.
- Homepage hero/story images render approved CDN presets from code without requiring theme publish.

## NEXT ACTION

1. Push feature branch → verify Vercel Preview Ready  
2. Playwright: Customize image edit → draft → (local) publish → storefront  
3. Variant options matrix + inventory defaults UI  
4. Owner package for Production migrations  
