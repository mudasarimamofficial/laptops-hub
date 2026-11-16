# Migration verification (2026-11-16)

## State

- Repository: **29** migrations (`supabase/migrations`, applied in filename/timestamp order).
- Production (`xvmmjkrkgznnakcobmww`, ap-southeast-1): **14 applied** (through `20261024100000_notification_outbox_lease`),
  per `supabase migration list --linked` (read-only), 2026-11-16.
- Pending for production, in this exact order (15 → 29):

| # | File | Purpose |
|---|---|---|
| 15 | 20261025120000_merchant_catalog_extensions | collections, inventory policy (adds `store_settings.inventory_policy` default: untracked / confirm first) |
| 16 | 20261025130000_site_builder_sections | theme draft/publish tables |
| 17 | 20261025140000_theme_publish_variant_rpc | theme publish RPCs |
| 18 | 20261025150000_theme_rls_inventory_hardening | RLS hardening |
| 19 | 20261025160000_theme_immutability_service_role | theme version immutability |
| 20 | 20261114100000_function_search_path_hardening | `search_path` pinned on functions |
| 21 | 20261115100000_reels_and_product_reviews | reels, product reviews |
| 22 | 20261116100000_merchandising_badges_and_reel_details | badges |
| 23 | 20261117100000_order_inventory_integrity | stock ledger, oversell protection |
| 24 | 20261117110000_anon_write_revoke_and_fk_indexes | revoke anon writes, FK indexes |
| 25 | 20261117120000_shipping_zone_rules | zone rules (PKR fees / free-shipping thresholds) |
| 26 | 20261117130000_inventory_adjustments | stock adjustments |
| 27 | 20261117140000_catalog_column_security_grants | column grants |
| 28 | 20261117150000_staff_direct_access_least_privilege | staff least privilege (needs 15–27 first) |
| 29 | 20261118100000_store_testimonials_and_home_sections | store testimonials; theme whitelist; fixes `RAISE … MESSAGE` defect |

Migration 28 depends on objects created by 15–27 (theme tables, inventory ledger, reviews/reels, zone rules) and
must not run before them; the rehearsals below apply them in order only.

## Gates

| Gate | Result | Evidence |
|---|---|---|
| Real production backup | **Done** — `supabase db dump --linked` schema, data (`--data-only --use-copy`, incl. `auth`), roles; stored **off-repo** at `D:\LaptopsHub-Backups\2026-11-16-pre-m15-29\` with `SHA256SUMS` (schema `94077155…`, data `100be2a9…`). Contains customer/auth data: never commit or share. | this doc |
| Restore rehearsal of that backup | **PASS** — restored into a scratch database in the local container: schema OK; 22 public tables, 1 476 rows, 0 public-table load errors (only storage platform tables absent in the scratch base); `auth.users` = 2 | `docs/evidence/migrations/prod_restore_upgrade_run.txt`, `prod_restore_counts_before.txt` |
| 14 → 29 on real data | **PASS** — all 15 applied in order; key figures unchanged (232 products / 232 variants / stock 0 / 0 orders / 0 items); only change to existing rows: +1 `store_settings` (`inventory_policy` default); 0 not-validated constraints | same run, `prod_restore_counts_after.txt` |
| Compatibility | **PASS** — public schema after upgrading the real backup is **identical** (0 differing lines) to a clean build of all 29 | `schema_prod_upgrade.sql` vs `schema_clean.sql` |
| Clean build + synthetic upgrade + idempotence | **PASS** — clean 29; 14→29 with synthetic data (counts/stock preserved); migration 29 re-applied without error; schema and grants clean == upgrade == local stack | `scripts/rehearsal/migration-upgrade.sh`, `schema_*.sql`, `grants_*.txt` |
| Destructive statements | None that drop or rewrite existing customer data in 15–29 (reviewed; the rehearsal confirms counts unchanged) | — |

## Applying to production (runbook excerpt)

Never `npm run db:push` blindly. Apply with the CLI linked to production **after** taking a fresh backup the same day:

```bash
npx supabase db dump --linked -f <backup>/schema.sql
npx supabase db dump --linked --data-only --use-copy -f <backup>/data.sql
npx supabase migration list --linked          # expect 14 applied, 15 pending
npx supabase db push --linked --dry-run       # must list exactly 15 files, 15..29 in order
npx supabase db push --linked                 # applies them in order, records history
npx supabase migration list --linked          # expect 29 applied
```

Then run the post-migration checks in `PRODUCTION_RELEASE_RUNBOOK.md` (anon cannot write, published theme intact,
COD still off, storefront renders). Rollback: restore from the backup (`supabase/rollback/` holds the reverse notes
for earlier migrations); data written after the migration would need re-entry, which is why it is applied before
the code deploy and while there are no orders (0 today).
