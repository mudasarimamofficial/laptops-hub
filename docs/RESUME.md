# Resume here

State: **RC hardening on `feat/v5-storefront-admin`** (2026-10-21).

## Baseline
- Prior: `28e2450` V5 + admin mutations
- Migrations through `20261021160000_atomic_ops_catalog_cms`
- Catalog: **232 / 226 / 6 / 964** (pagination view confirms 226 public)
- **COD off** · **no `--prod`**

## Hardening completed this session
- Atomic `record_cod_collection` + concurrent same-key / over-collection proofs (**6/6**)
- Atomic `transition_order_status` with stale-status guard
- DOMPurify allowlist CMS sanitizer + legal approval ≠ editorial publish
- Variant-scoped product price PATCH
- DB `public_catalog_listing` + paginated search/collections (no 200/226 hard truncate)
- Role matrix fixtures (**15/15**) — non-staff, inactive, editor deny COD, fulfillment/owner allowed RPC path
- Cutouts removed from `public/` (rights uncleared); story uses catalog CDN images
- P0 still **9/9**; catalog pagination **5/5**; unit + sanitize pass; build pass

## Still open / owner
- Playwright visual evidence (Chromium install in progress / network flaky) — see `docs/VISUAL_QA_NOTES.md`
- Controlled owner bootstrap of real `admin_memberships` (ephemeral fixtures deleted after role tests)
- Shipping fees, policy legal approval, media rights, launch approval
- Draft PR into `main` (do not merge / do not enable COD)

## Do not
- Enable public COD / `vercel --prod`
- Invent policies, fees, or specs
- Treat `approved-assets` folder names as license proof
