# Laptops HUB — Merchant OS final QA & release report

**Date:** 2026-11-18  
**PR:** https://github.com/mudasarimamofficial/laptops-hub/pull/23 (MERGED)  
**Production GitHub SHA:** `43368e31d8282a413871a8c1a61af7ad722a7fc3`  
**Feature tip SHA:** `e1db50ab79219017688c4090384b431e2e4433bf`  
**Production Vercel deployment:** `dpl_AZdpHMdwRjNe2uf2RGLH8kFbxZUw` (READY)  
**Aliases:** `www.laptopshub.pk`, `laptopshub.pk`  
**Verified Preview (pre-merge):** `dpl_CVSsS2QGtPhVr1HrX4ZiVepzdkv5` @ `e1db50a`  
**Previous production baseline:** `951b95a` / `dpl_B9bykg3S…`  
**Rollback app:** tag `checkpoint/pre-merchant-os-951b95a`

## Distinctions

| Item | Status |
|------|--------|
| Inventory / Buy now / Reviews / Blog / CMS backups **implemented** | Yes |
| Migrations applied on production Supabase | Yes |
| Atomic restore dry-run (BEGIN/ROLLBACK) | Yes — tested in isolation on prod DB |
| Unit + TypeScript + quality CI | Yes — `quality` passed on PR #23 |
| Preview app deploy | Yes |
| **Deployed** to production | Yes — `dpl_AZdpHMdw…` READY |
| **Verified on production** storefront | Yes — home, catalog, PDP Add to cart, COD checkout form |
| Shipping quote Rs 360 + COD Rs 50 | Yes — live `/api/checkout/quote` |
| Inventory switch left **OFF** | Yes |
| Isolated COD full order (local Supabase) | Pending local stack |
| Live production COD with owner PII | **Not tested** — do not claim |
| Reels third-party media HTML | **Pending content** — non-blocking |

## Migration reconciliation

| Remote version | Name |
|---|---|
| `20261118074859` | inventory_tracking_and_pdp_cta |
| `20261118075155` | create_cod_order_respect_inventory_tracking |
| `20261118075220` | merchant_snapshots_and_blog_revisions |
| `20261118081618` | merchant_cms_snapshot_restore_rpc |

See `docs/MIGRATION_LEDGER_RECONCILIATION_2026-11-18.md`.

## Backup & restore

**Scope:** store settings, blog articles, reels, store testimonials, shipping zones.  
**Not included:** products, variants, collections, orders, customers, staff, secrets.

- Atomic restore via `restore_merchant_cms_snapshot`.
- Pre-restore checkpoint; checksum verification; legacy catalog payloads rejected.
- Retention: newest **4** valid snapshots.
- UI states this is **not** a full PostgreSQL backup.
- Production snapshot count at release: **0** (none created yet by merchant).

## Inventory switch

Default **OFF**. Behavior = global gate ∧ per-variant `inventory_mode`. SQL matrix probed; production left OFF. Enabling global alone does not sell-out untracked catalog variants.

## PDP Buy now

Default CTA remains **Add to cart** (verified on live Dell 5400 PDP). Buy now is settings-gated; storage key `lh-buynow-v1`; cart `lh-cart-v1` preserved.

## Reviews / reels

Card-only hover pause shipped. Reels presets remain draft placeholders; ronin.pk blocked; missing HTML is **not** a release blocker.

## Production smoke (2026-11-18)

- [x] Domain resolves to `dpl_AZdpHMdw…`
- [x] COD checkout page live (“Place COD order”)
- [x] Quote API: delivery 36000 paisa + COD 5000 paisa
- [x] Catalog listing intact (Dell/HP/Lenovo filters populated)
- [x] PDP primary CTA: Add to cart
- [x] Inventory tracking setting: `enabled: false`
- [ ] Live COD submit with owner PII
- [ ] Authenticated admin settings write (owner session required)

## Remaining blockers / follow-ups

1. Owner-controlled live COD acceptance order.
2. Reels HTML paste + rights before public publish.
3. Optional isolated-stack concurrency COD suite.
4. Create first CMS snapshot from Admin → Backups when ready.
