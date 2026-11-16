# Laptops HUB — Migration Compatibility Matrix (updated 2026-11-16)

Production (`xvmmjkrkgznnakcobmww`) has migrations **1–14** applied (last recorded read: `20261024100000_notification_outbox_lease`).
This branch adds **14** (15–28). None has been applied to production. Applying them needs the owner's written approval
and a fresh backup (runbook §2).

**Rehearsed locally (2026-11-15, `scripts/rehearsal/migration-upgrade.sh`):**
- A clean database with all 26 migrations.
- 14 migrations, then seed data, then the 12 pending ones (upgrade path).
- The running local stack.

All three produce a byte-identical public schema (sha256 `d41a663a…`) and identical grants, and data survives the upgrade.
`scripts/rehearsal/backup-restore.sh` restores public+auth into a scratch database. Per-table row counts and content md5 are
identical (29 tables, 663 rows), as are policies, triggers, constraints and indexes. Evidence: `docs/evidence/migrations/`.

## Pending migrations

| # | File | Objects changed | Data impact | Old production app (commit `cb638b7`) after apply | Rollback |
|---|---|---|---|---|---|
| 15 | `20261025120000_merchant_catalog_extensions` | `products`, `product_variants`, `product_media`, `collections`, `import_jobs` (new nullable/defaulted columns); `inventory_ledger` table + staff-read policy | None (defaults only) | Unaffected: it selects named columns only | Drop added columns/table (only if no new data depends on them) |
| 16 | `20261025130000_site_builder_sections` | `theme_templates`, `theme_versions`, `theme_publications` + staff-select policies | New empty tables | Unaffected: the old app does not read them | Drop tables |
| 17 | `20261025140000_theme_publish_variant_rpc` | `get_published_homepage_sections`, `publish_homepage_theme`, `rollback_homepage_theme`, `sync_product_variants` | None | Unaffected | Drop functions |
| 18 | `20261025150000_theme_rls_inventory_hardening` | Theme RPCs re-created with actor checks; draft-edit helper; immutability guards; revoked direct theme writes | None | Unaffected | Re-create the 17 bodies |
| 19 | `20261025160000_theme_immutability_service_role` | Guards also bind the service role (published snapshots immutable) | None | Unaffected | Re-create the 18 guard bodies |
| 20 | `20261114100000_function_search_path_hardening` | `SET search_path` on 3 functions | None | Unaffected | `ALTER FUNCTION … RESET search_path` |
| 21 | `20261115100000_reels_and_product_reviews` | `reels`, `product_reviews` + public-select (published / approved only) and staff policies; DB check refuses publishing without rights | New empty tables | Unaffected | Drop tables |
| 22 | `20261116100000_merchandising_badges_and_reel_details` | `product_badges` (editorial only; `top_seller` cannot be stored); extra reel columns | New empty table | Unaffected | Drop table / columns |
| 23 | `20261117100000_order_inventory_integrity` | **Replaces `create_cod_order`** (same `jsonb` signature; honours `allow_oversell`); ledger trigger on `order_items`; restock-on-cancel trigger on `orders` | None at apply; afterwards every tracked order line writes one ledger row, and cancelling before shipment restocks once | Compatible: same RPC name/arguments/return shape. COD is off in production, so no order runs through it until launch | Drop both triggers and functions; re-apply the `create_cod_order` body from `20261023160000` |
| 24 | `20261117110000_anon_write_revoke_and_fk_indexes` | Revokes residual anon INSERT/UPDATE/DELETE/TRUNCATE on public tables (keeps `contact_inquiries` INSERT); 16 FK indexes | None (RLS already denied these writes) | Compatible: the contact form keeps INSERT; every other anon write was already refused by RLS | Re-grant / `DROP INDEX` |
| 25 | `20261117120000_shipping_zone_rules` | `shipping_zones.excluded_cities text[] default '{}'`, `free_shipping_min_paisa bigint` (≥0, nullable); **replaces** `zone_serves_address`, `quote_cod_shipping` (adds one field), `create_cod_order` (adds the free-delivery block) | Existing zones unchanged: no exclusions, no threshold; "All Over PK" stays Rs 360 + Rs 50 | Compatible: the quote returns a superset `jsonb`; the old app ignores the new key | Re-create the 23/earlier bodies; drop the 2 columns |
| 26 | `20261117130000_inventory_adjustments` | `adjust_inventory(jsonb)`, service_role only | None | Unaffected | `DROP FUNCTION public.adjust_inventory(jsonb)` |
| 27 | `20261117140000_catalog_column_security_grants` | Re-states column-level SELECT on `products` / `product_variants` for anon/authenticated (adds `option_names`, `position`, `media_id` needed by the variant picker; internal columns stay hidden). Replaces a manual broad `GRANT SELECT` that an earlier session ran on the local DB only | None | Compatible: the old app selects a subset of the granted columns | Re-run the 20261021130000 column grants |
| 28 | `20261117150000_staff_direct_access_least_privilege` | **Security fix.** Revokes direct INSERT/UPDATE/DELETE on 21 merchant tables and SELECT on 11 PII/operational tables from anon/authenticated (closes a pre-existing hole: any active staff token — e.g. fulfillment/editor — could change prices, stock, fees, COD setting, legal approval or read every order through the Data API, bypassing the app's role checks). Hides `product_media` rights metadata from the public. Grants `products.deleted_at` so `catalog_products_public` works for anon. Adds `storefront_variant_availability(uuid[])` (boolean stock signal, SECURITY DEFINER, `search_path=''`) | None | Compatible: the app writes and reads private data with the service role after `requireStaff(roles)`; no code path uses direct staff table writes. Verified 193/193 by `scripts/security-direct-staff-access.mjs` | Re-grant the revoked privileges (statements listed in the file header) and `DROP FUNCTION public.storefront_variant_availability(uuid[])` |

**Dependencies:** apply in file order:
- 23 must precede 25: both replace `create_cod_order`, and 25 contains 23's stock logic.
- 26 depends on `inventory_ledger` (15).
- 18 and 19 depend on 16 and 17.
- 28 must follow 27 (27 re-grants authenticated table writes on the catalog that 28 revokes again).

## Functions exposed to `anon` after all 28

| Function | Why public | Returns |
|---|---|---|
| `quote_cod_shipping` | Checkout quote before ordering | Fees and zone options only |
| `get_order_confirmation_by_token` | Order success/tracking page via unguessable UUID token | 4 non-PII fields |
| `get_published_homepage_sections` | Storefront homepage | Published theme payload only |
| `is_staff`, `has_staff_role` | Used inside RLS policies | Caller's own state only |
| `storefront_variant_availability` | PDP shows which options can be bought now | `(product_id, variant_id, available boolean)` for purchasable variants of active products; never quantities; max 200 products per call |

Order creation (`create_cod_order`) and stock changes (`adjust_inventory`) are executable by `service_role` only and are
called from server routes after validation.

## Code ↔ schema expectations

| Feature in this branch | Needs migration | Behaviour if the code ships before the migration |
|---|---|---|
| Theme publishing (`THEME_PUBLISHED_ENABLED=1`) | 16–19 | Leave the flag unset: the storefront renders the built-in V5 homepage |
| Reels / reviews | 21, 22 | The loaders fail closed: no reels row, and "No reviews yet" |
| Badges / social proof | 22 | No badges, no notices |
| Inventory ledger on orders, oversell | 15, 23 | Older `create_cod_order` decrements stock without a ledger row |
| Shipping exclusions / free-delivery minimum | 25 | Admin save of the new fields fails (unknown column). **Ship the code and 25 together** |
| Inventory desk adjustments | 26 | The adjust route errors. **Ship with 26** |
| Merchant collections on the storefront | none (uses existing `collections`) | Works |
| Variant picker (option names, position, variant media) | 27 | Production's existing column grants do not include `option_names`/`position`/`media_id`; the catalog query detects 42501/42703 and falls back to the legacy column list (single-variant behaviour, logged as a warning). **Ship with 27** |
| Per-variant availability on the PDP | 28 | The availability call fails; the code treats every variant as buyable (previous behaviour) and the order RPC still refuses out-of-stock lines with a clear message |
| Staff direct-table lock-down | 28 | No code dependency. Without 28 the Data API hole above stays open — **apply 28 even if nothing else ships** |

**Recommendation:** apply 15–26 in one approved window before deploying this branch to production. The runbook gives the
exact order, checks and stop conditions.
