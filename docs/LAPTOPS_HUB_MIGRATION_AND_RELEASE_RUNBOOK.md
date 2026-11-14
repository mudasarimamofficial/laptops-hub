# Laptops HUB — Migration and Release Runbook

**Date:** 2026-11-14 · **Branch:** `feat/merchant-operating-system` (17 commits ahead of `main`)
**Every step below needs explicit owner approval. Nothing in this document has been run against production.**

## 0. Before you start

- Production Supabase ref: `xvmmjkrkgznnakcobmww`. On 2026-10-23 it had 14 migrations applied, through `20261024100000_notification_outbox_lease.sql`. This pass could **not** re-verify that (Supabase MCP access was denied), so run step 1 first.
- Never run `supabase db reset`, `db push`, or any `scripts/test-fixtures/*` script while the CLI is linked to production. Isolated scripts call `assertLocalOnly`, but do not rely on that alone.
- Baseline note: at the start of this pass the working tree held uncommitted edits identical to `main`. They are kept in `git stash@{0}` and nothing was discarded. Drop the stash only after the owner confirms.

## 1. Verify production state (read-only)

```bash
supabase migration list --linked
```

Expected: the 14 migrations above are remote, and the 6 below are local-only.

## 2. Pending migrations (apply in this order)

| # | File | Effect | Risk |
|---|---|---|---|
| 15 | `20261025120000_merchant_catalog_extensions.sql` | Additive columns (soft delete, options, SEO, barcode, inventory mode, media rights), `inventory_ledger`, import tracking | Low: additive, defaults/nullable |
| 16 | `20261025130000_site_builder_sections.sql` | Theme tables plus the V5 default seed; anon/authenticated revoked | Low |
| 17 | `20261025140000_theme_publish_variant_rpc.sql` | Public published-sections RPC, publish/rollback, `sync_product_variants` | Medium: SECURITY DEFINER; role checks reviewed |
| 18 | `20261025150000_theme_rls_inventory_hardening.sql` | Theme RLS select-only; draft RPC | Low |
| 19 | `20261025160000_theme_immutability_service_role.sql` | Published/draft rows immutable without the mutation flag | Low |
| 20 | `20261114100000_function_search_path_hardening.sql` | `SET search_path = ''` on `norm_place`, `zone_serves_address`, `set_updated_at` | Low: those functions already use qualified names; verified locally by the SQL matrix |

Apply one at a time through the reviewed migration path (`docs/MIGRATION_PRODUCTION_APPROVAL.md`). After each one, re-run step 1 and the read-only advisors.

**Rollback:** 15–19 are additive. `DATA_MODEL_AND_MIGRATIONS.md` → “Rollback sketch” is an outline, not tested scripts; prefer leaving new columns nullable and unused over dropping them. Writing and testing down-scripts is still to do before production. For 20, run `ALTER FUNCTION … RESET search_path`.

## 3. Owner dashboard actions (no code)

- Supabase Auth: turn on leaked-password protection.
- Review the 964 media rows (`MEDIA_RIGHTS_CUTOUTS.md`). Do not bulk-approve them.

## 4. Merge and deploy

1. Open a PR from `feat/merchant-operating-system` to `main`. CI must pass: `npm run build`, `npm run test:unit`, lint.
2. Deploy a Preview, then smoke-test it:
   ```bash
   node scripts/visual/check-routes.mjs --base <preview>
   ```
   Then run `PLAYWRIGHT_BASE_URL=<preview> npx playwright test tests/e2e`.
3. Font change: fonts are now self-hosted (`src/fonts/*.woff2`), so the build no longer fetches Google Fonts. Confirm the Preview renders Hanken Grotesk, Sora and JetBrains Mono.
4. Promote to production only after owner sign-off.

## 5. COD activation (last; separate approval)

Prerequisites, all shown in Admin → Overview → readiness matrix:
- Policies approved and public
- At least one active shipping zone with owner-confirmed fees
- Stock tracked for sellable variants
- A notifications provider configured
- A second staff member invited

Then:
1. Set `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true` and `COD_CHECKOUT_ENABLED=true` in Vercel Production, and redeploy.
2. Admin → Settings → turn on COD checkout. The readiness status must read “Ordering open”.
3. Place one real low-value test order. Verify the order desk, the email, and the stock decrement. Cancel it.

**Kill switch:** turn off the DB setting in Admin. Ordering closes within the settings cache window (60 s) and immediately after a save, because the save revalidates the cache tag.

## 6. Known gaps to schedule

- `create_cod_order` decrements tracked stock but writes no `inventory_ledger` row.
- `/api/admin/media` returns raw error messages, though only to staff.
- `notFound()` thrown inside dynamic product pages renders the Next error shell instead of the styled 404. This already happens in production; it is not a regression.
- Reels, moderated reviews, a blog editor and real-data badges are not built (see the acceptance matrix).
