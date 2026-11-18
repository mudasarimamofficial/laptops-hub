# Migration ledger reconciliation — 2026-11-18

## Problem

MCP `apply_migration` recorded production versions with wall-clock timestamps that differ from the local filenames originally committed:

| Production `schema_migrations` | Local filename (aligned) |
|---|---|
| `20261118074859_inventory_tracking_and_pdp_cta` | `supabase/migrations/20261118074859_inventory_tracking_and_pdp_cta.sql` |
| `20261118075155_create_cod_order_respect_inventory_tracking` | `supabase/migrations/20261118075155_create_cod_order_respect_inventory_tracking.sql` (stub — body already in inventory migration) |
| `20261118075220_merchant_snapshots_and_blog_revisions` | `supabase/migrations/20261118075220_merchant_snapshots_and_blog_revisions.sql` |
| `20261118081618_merchant_cms_snapshot_restore_rpc` | `supabase/migrations/20261118081618_merchant_cms_snapshot_restore_rpc.sql` |

Earlier local names `20261118160000` / `20261118170000` were renamed to match the remote ledger so `supabase db push` will not re-apply them.

## Rules

- Do **not** `supabase db reset` or blind `db push` against production.
- New migrations must use unused version prefixes after the latest remote version.
- Count on 2026-11-18 after reconciliation: **34** prior + restore RPC when applied.

## COD function check

`create_cod_order` includes `v_track_inventory := public.inventory_tracking_enabled()` and only decrements stock when tracking is ON **and** the variant is `tracked`.
