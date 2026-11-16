# Data model & migrations

## Production ledger (verified 2026-10-25)

14 migrations applied remotely through `20261024100000_notification_outbox_lease`.  
**Do not apply new migrations to Production without owner approval.**

## Additive draft (this branch)

`supabase/migrations/20261025120000_merchant_catalog_extensions.sql`

| Change | Purpose |
|---|---|
| `products.deleted_at/by`, `summary`, `option_names`, `template_key`, `updated_by` | Soft-delete, SEO/summary, Shopify options |
| `product_variants` barcode, cost, low stock, oversell, weight, position | CSV + inventory parity |
| `product_media` origin, provider, variant_id, primary, health | External CDN metadata |
| `collections.collection_type`, image, SEO, deleted_at | Manual vs automated |
| `inventory_ledger` | Audited stock adjustments |
| `store_settings.inventory_policy` | Global default mode |
| `import_jobs` profile/strategy/fingerprint/progress | CSV jobs |
| `catalog_products_public` | Exclude `deleted_at IS NOT NULL` |

## Backwards compatibility

- Existing columns and FKs preserved.
- App APIs degrade gracefully when new columns are absent (pre-migration environments).
- Soft-delete falls back to `status=archived` if columns missing.
- Orders / `order_items` never cascade-delete when products are soft-deleted.

## Rollback sketch

1. Stop writing new columns.
2. `CREATE OR REPLACE VIEW catalog_products_public` to prior definition (from `20261021120000`).
3. Drop `inventory_ledger` if unused.
4. Column drops only after confirming no Production dependency — prefer leave columns nullable.

## Local apply

```bash
npx supabase start
npx supabase db reset   # isolated local only
```
