# Laptops HUB — Merchant OS final QA & release report

**Date:** 2026-11-18  
**Branch:** `feat/merchant-os-enhancements`  
**Feature commits:** `d167c6e` → QA/fix follow-ups (this report)  
**Production baseline before release:** `951b95a` / `dpl_B9bykg3S…`  
**Verified Preview (pre-fix):** `dpl_CTUJEYsN…` @ `db051f8`  
**Rollback app:** tag `checkpoint/pre-merchant-os-951b95a`

## Migration reconciliation

Production ledger (MCP timestamps) aligned to local filenames:

| Remote version | Name |
|---|---|
| `20261118074859` | inventory_tracking_and_pdp_cta |
| `20261118075155` | create_cod_order_respect_inventory_tracking |
| `20261118075220` | merchant_snapshots_and_blog_revisions |
| `20261118081618` | merchant_cms_snapshot_restore_rpc |

See `docs/MIGRATION_LEDGER_RECONCILIATION_2026-11-18.md`.

## Backup & restore (release-critical fix)

**Scope (explicit):** store settings, blog articles, reels, store testimonials, shipping zones.  
**Not included:** products, variants, collections, orders, customers, staff, secrets.

- Atomic restore via `restore_merchant_cms_snapshot` (single Postgres transaction).
- Pre-restore checkpoint required; checksum verification; legacy catalog payloads rejected.
- Retention: newest **4** valid snapshots.
- UI copy states this is **not** a full PostgreSQL backup.
- Dry-run on production DB: `BEGIN; restore…; ROLLBACK;` → `ok: true` (settings+zones restored counts); incomplete payload refused; tracking left **OFF**.

## Inventory switch

Default **OFF**. Behavior = global gate ∧ per-variant `inventory_mode`:

| Global | Variant mode | Zero stock | Available? |
|--------|--------------|------------|------------|
| OFF | tracked | 0 | yes |
| ON | tracked | 0 | no |
| ON | tracked + stock | >0 | yes |
| ON | tracked + oversell | 0 | yes |
| ON | untracked | 0 | yes |

SQL matrix probe passed; production default restored OFF. Current catalog largely uses untracked variants — enabling global tracking alone does not sell-out the catalog.

## PDP Buy now

PDP-only; cards unchanged; `sessionStorage` `lh-buynow-v1`; cart `lh-cart-v1` preserved. Playwright isolated storage specs added.

## Blog

Visual editor + SEO + revisions APIs. Existing UUID edit path retained. contentEditable noted as pragmatic; XSS still sanitised on save.

## Reviews / reels

Card-only hover pause. Reels presets = draft placeholders; ronin.pk blocked; missing HTML not a release blocker.

## Distinctions

| Item | Status |
|------|--------|
| Inventory / Buy now / Reviews / Blog / Backups implemented | Yes |
| Migration applied on production Supabase | Yes |
| Atomic restore dry-run (rolled back) | Yes |
| Preview app deploy | Yes (`dpl_CTUJEYsN…` and successors) |
| Isolated COD full order (local Supabase) | Pending local stack |
| Live production COD with owner PII | **Not tested** |
| Reels third-party media | Pending content / rights |

## Production smoke checklist (post-promote)

- [ ] Domain resolves to new deployment
- [ ] COD checkout still enabled
- [ ] Shipping Rs 360 + COD Rs 50
- [ ] Catalog intact
- [ ] Admin settings inventory toggle OFF
- [ ] Hostinger CRM unaffected
