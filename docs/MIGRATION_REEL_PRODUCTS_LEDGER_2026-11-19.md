# Migration ledger reconciliation — `reel_products` (2026-11-19)

## Observation

| Side | Version | File |
|---|---|---|
| Hosted Supabase (`xvmmjkrkgznnakcobmww`) | `20261118162150` | Applied at ~16:21 UTC on 2026-11-18 (CLI apply timestamp) |
| Repository (PR #41) | `20261118220000_reel_products.sql` | Authoring timestamp in the filename |

Both refer to the **same idempotent DDL** (table, indexes, RLS, grants, legacy `product_id` backfill). Schema on production matches: PK `(reel_id, product_id)`, FKs to `reels`/`products`, `sort_order` check, policies `reel_products_public_select` + `reel_products_staff_all`.

## Why the versions differ

The SQL was applied to the hosted database through an operator/CLI path that recorded **`20261118162150`** (wall-clock apply id). The repository later committed the same contents under filename **`20261118220000`**. Supabase migration history keys on the numeric prefix only — so local and remote appeared divergent even though the table already existed.

## Safe path taken (no drop/reset)

1. Added `supabase/migrations/20261118162150_reel_products.sql` with the identical idempotent DDL so the remote version has a matching local file.
2. Replaced `20261118220000_reel_products.sql` with a **no-op assert** that only checks `to_regclass('public.reel_products')` is non-null (safe if re-run).
3. Ran `supabase migration repair --status applied 20261118220000` on the linked project so the hosted ledger includes both versions without re-executing destructive DDL.

## Future migrations

- New changes to `reel_products` must use a **new** timestamped file after `20261118220000`.
- Never rename applied versions on production.
- Prefer `create … if not exists` / `drop policy if exists` for additive content schema.
- Do not `db reset` production.
