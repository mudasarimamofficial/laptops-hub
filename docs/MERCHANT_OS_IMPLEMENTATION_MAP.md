# Merchant OS enhancement — implementation map

**Branch:** `feat/merchant-os-enhancements`  
**Feature base:** `d167c6e` / preview pin `db051f8`  
**Baseline:** `951b95a` / tag `checkpoint/pre-merchant-os-951b95a`  
**Release report:** `docs/FINAL_MERCHANT_OS_RELEASE_REPORT.md`  
**Migration reconciliation:** `docs/MIGRATION_LEDGER_RECONCILIATION_2026-11-18.md`

## Done

| Feature | Default | UI | Persistence | Notes |
|--------|---------|----|-------------|-------|
| Global inventory tracking | **OFF** | Admin → Settings → Products & Inventory | `store_settings.inventory_tracking` | Gate ∧ per-variant `inventory_mode`. Stock not decremented while OFF. |
| PDP checkout CTA | **Add to cart** | Admin → Settings → Storefront & Checkout | `store_settings.storefront_checkout.pdp_cta` | PDP-only; buy-now uses `sessionStorage` `lh-buynow-v1` + `/checkout?mode=buy_now`. |
| Reviews hover pause | card-only | Storefront reviews carousel | CSS `:has(.card:hover/:focus-within)` | Heading/padding no longer pause autoplay. |
| Blog visual editor | — | Admin → Blog | `articles` + `article_revisions` | Rich toolbar, SEO, revisions. contentEditable + sanitise-on-save. |
| CMS backups (4 valid) | — | Admin → Settings → Backups & Recovery | `merchant_snapshots` + `restore_merchant_cms_snapshot` | **CMS only** (settings, articles, reels, testimonials, zones). Atomic RPC restore. Not a Postgres dump. |
| Reels presets | draft | Admin → Reels → Restore 6 presets | `data/reels-presets-manifest.json` | Placeholders; **awaiting HTML paste**. ronin.pk blocked. |

## Migrations on production Supabase (aligned filenames)

- `20261118074859_inventory_tracking_and_pdp_cta`
- `20261118075155_create_cod_order_respect_inventory_tracking`
- `20261118075220_merchant_snapshots_and_blog_revisions`
- `20261118081618_merchant_cms_snapshot_restore_rpc`

## Blocked / pending (non-blocking for Merchant OS app release)

1. **Reels HTML paste** — draft placeholders only; rights-gate before publish.
2. **Live production COD with owner PII** — not claimed tested until done.
3. **Isolated full COD concurrency suite** — prefer local Supabase stack (Preview shares prod DB).

## Rollback

- App: tag `checkpoint/pre-merchant-os-951b95a`.
- Schema: settings defaults remain safe OFF / add_to_cart. Snapshot tables additive.
