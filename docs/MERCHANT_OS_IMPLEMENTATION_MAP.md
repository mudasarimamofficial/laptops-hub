# Merchant OS enhancement — implementation map

**Branch:** `feat/merchant-os-enhancements`  
**Baseline:** `951b95a` / tag `checkpoint/pre-merchant-os-951b95a`  
**Production pin (pre-change):** `dpl_B9bykg3S…` @ `951b95a`

## Done in this pass

| Feature | Default | UI | Persistence | Notes |
|--------|---------|----|-------------|-------|
| Global inventory tracking | **OFF** | Admin → Settings → Products & Inventory | `store_settings.inventory_tracking` | RPC `inventory_tracking_enabled()`; `storefront_variant_availability` + `create_cod_order` + quote API honor it. Stock not decremented while OFF. |
| PDP checkout CTA | **Add to cart** | Admin → Settings → Storefront & Checkout | `store_settings.storefront_checkout.pdp_cta` | PDP-only; cards unchanged. Buy now uses `sessionStorage` (`lh-buynow-v1`) + `/checkout?mode=buy_now` without clearing the main cart. |
| Reviews hover pause | card-only | Storefront reviews carousel | CSS `:has(.card:hover/:focus-within)` | Heading/padding no longer pause autoplay. |
| Blog visual editor | — | Admin → Blog | `articles` + `article_revisions` | Rich toolbar, templates, SEO panel, revision on save/restore API. Existing posts remain editable by UUID. |
| Backups (4 valid) | — | Admin → Settings → Backups & Recovery | `merchant_snapshots` | Owner/admin create; owner restore; coalesced auto-backup on key settings saves. |
| Reels presets | draft | Admin → Reels → Restore 6 presets | `data/reels-presets-manifest.json` | Titles reserved; **awaiting HTML paste for URLs**. ronin.pk stays blocked. |

## Migrations applied to production Supabase

- `20261118160000_inventory_tracking_and_pdp_cta` (+ `create_cod_order_respect_inventory_tracking`)
- `20261118170000_merchant_snapshots_and_blog_revisions`

## Blocked / pending

1. **Reels HTML paste** — six titles seeded as draft placeholders; extract real video/poster/avatar/tag URLs when HTML arrives; rights-gate before publish.
2. **Production COD submit** — requires owner-controlled private PII; isolated/staging certification first.
3. **Preview deploy + full Playwright matrix** — run before promotion.
4. **Tiptap** — deferred; contentEditable visual editor shipped without a new paid/SaaS dependency. Can upgrade later if needed.

## Rollback

- App: return to tag `checkpoint/pre-merchant-os-951b95a`.
- Schema: settings keys can remain (defaults safe). Function bodies can be restored from `20261117120000` / `20261117150000`. Snapshot/revision tables are additive.
