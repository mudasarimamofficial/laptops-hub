# Laptops HUB — Migration and Release Runbook

**Date:** 2026-11-15 (final engineering pass) · **Branch:** `feat/merchant-operating-system` (ahead of `main`; see `git rev-list --count main..HEAD`)
**Every step below needs explicit owner approval. Nothing in this document has been run against production.**

## Preflight checklist (all must be true before step 2)

| Item | Where it is / how to check |
|---|---|
| Release commit | The HEAD of `feat/merchant-operating-system` named in `docs/LAPTOPS_HUB_FINAL_RELEASE_MANIFEST.md`; `git status` clean |
| Tested deployment | **No staging deployment exists yet.** The release candidate is certified on the local isolated stack only (`docs/LAPTOPS_HUB_STAGING_CERTIFICATION_REPORT.md`). A staging Supabase project + protected Preview is the next step and needs owner approval |
| Source integrity | `.env*`, dumps and ZIPs are git-ignored; secret scan in `docs/LAPTOPS_HUB_STAGING_SECURITY_REPORT.md` |
| Environment variable **names** (values live in Vercel only) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` / `SITE_URL`, `SITE_PRELAUNCH`, `COD_CHECKOUT_ENABLED`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED`, `THEME_PUBLISHED_ENABLED` (new, needs migrations 16–19), `THEME_PUBLISH_DISABLED` (optional kill switch), `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `NOTIFY_CUSTOMER_EMAIL`, `NOTIFY_TIMEOUT_MS` (optional), `CRON_SECRET`, `MERCHANT_MUTATIONS_DISABLED` (Preview only). Never set `RESEND_API_URL` in production (test stand-in only) |
| Database compatibility | `docs/LAPTOPS_HUB_MIGRATION_COMPATIBILITY_MATRIX.md` |
| Migration files and dependencies | §2 below: 12 files, 15–26, file order; 23 before 25 |
| Verified backup | Supabase → Database → Backups shows one newer than 1 hour, **and** a manual `pg_dump` of `public` + `auth` stored off-repo |
| Restore rehearsal | Done locally on 2026-11-15 (`scripts/rehearsal/backup-restore.sh`, identical checksums). Repeat against a staging copy when staging exists |
| Monitoring | Vercel → Logs / runtime errors for the production project; Admin → Orders (notification status column); Admin → Overview readiness matrix |
| Rollback plan | §7 below |
| Owner configuration | `docs/LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md` §B: fees, policies, stock counts, media rights, staff, email sender |

## 0. Before you start

- Production Supabase ref: `xvmmjkrkgznnakcobmww`. On 2026-10-23 it had 14 migrations applied, through `20261024100000_notification_outbox_lease.sql`. This pass could **not** re-verify that (Supabase MCP access was denied again on 2026-11-14 and the CLI is not linked on this machine), so run step 1 first. Vercel was re-verified read-only on 2026-11-14: Production is still `dpl_6cDJvMYH3FJvc8FgW9LrEpWWDotu` at `cb638b7`, aliased to `www.laptopshub.pk`.
- Never run `supabase db reset`, `db push`, or any `scripts/test-fixtures/*` script while the CLI is linked to production. Isolated scripts call `assertLocalOnly`, but do not rely on that alone.
- Baseline note: at the start of this pass the working tree held uncommitted edits identical to `main`. They are kept in `git stash@{0}` and nothing was discarded. Drop the stash only after the owner confirms.

## 1. Verify production state (read-only)

```bash
supabase migration list --linked
```

Expected: the 14 migrations above are remote, and the 12 below are local-only.

## 2. Pending migrations (apply in this order)

| # | File | Effect | Risk |
|---|---|---|---|
| 15 | `20261025120000_merchant_catalog_extensions.sql` | Additive columns (soft delete, options, SEO, barcode, inventory mode, media rights), `inventory_ledger`, import tracking | Low: additive, defaults/nullable |
| 16 | `20261025130000_site_builder_sections.sql` | Theme tables plus the V5 default seed; anon/authenticated revoked | Low |
| 17 | `20261025140000_theme_publish_variant_rpc.sql` | Public published-sections RPC, publish/rollback, `sync_product_variants` | Medium: SECURITY DEFINER; role checks reviewed |
| 18 | `20261025150000_theme_rls_inventory_hardening.sql` | Theme RLS select-only; draft RPC | Low |
| 19 | `20261025160000_theme_immutability_service_role.sql` | Published/draft rows immutable without the mutation flag | Low |
| 20 | `20261114100000_function_search_path_hardening.sql` | `SET search_path = ''` on `norm_place`, `zone_serves_address`, `set_updated_at` | Low: those functions already use qualified names; verified locally by the SQL matrix |
| 21 | `20261115100000_reels_and_product_reviews.sql` | New `reels` and `product_reviews` tables with RLS (public: published + rights-cleared reels, approved reviews), column grants hiding reviewer email and IP hash, no anon write path, publish-requires-rights and ronin.pk-ban constraints | Low: additive, new tables only; `scripts/db-tests/reels-reviews-matrix.sql` 17/17 |
| 22 | `20261116100000_merchandising_badges_and_reel_details.sql` | New `product_badges` table (editorial kinds only: featured / popular_pick / staff_pick; schedule window; public sees in-window rows, never the note); `reels.creator_name` / `creator_consent` / `tag` with “name requires consent” and tag-format checks | Low: additive (new table; new columns have defaults); `scripts/db-tests/merchandising-matrix.sql` 15/15. Depends on 21 |
| 23 | `20261117100000_order_inventory_integrity.sql` | `create_cod_order` honours the owner-set "continue selling when out of stock" (`allow_oversell`); every tracked order line writes an `inventory_ledger` row (trigger); cancelling before shipment restocks exactly once (trigger) | Medium: replaces `create_cod_order` (only the stock check changed) and adds two triggers; `scripts/test-inventory-orders.mjs` covers race/duplicate/rollback/cancel. Rollback: drop the two triggers/functions and re-apply the `create_cod_order` body from 20261023160000 |
| 24 | `20261117110000_anon_write_revoke_and_fk_indexes.sql` | Revokes residual table INSERT/UPDATE/DELETE grants from `anon` (keeps `contact_inquiries` INSERT for the contact form); 16 foreign-key indexes | Low: RLS already denied these writes; indexes are small (`CREATE INDEX IF NOT EXISTS`, brief lock). Rollback: re-grant / drop index |
| 25 | `20261117120000_shipping_zone_rules.sql` | `shipping_zones.excluded_cities`, `free_shipping_min_paisa`; `zone_serves_address` honours exclusions; `create_cod_order` applies the free-delivery minimum to the server-priced subtotal; quote returns the minimum | Medium: replaces `create_cod_order` (adds one block) and `quote_cod_shipping`/`zone_serves_address`; existing zones unchanged (defaults). SQL matrix 37/37. Depends on 23 |
| 26 | `20261117130000_inventory_adjustments.sql` | `adjust_inventory(jsonb)` (service_role only): manual stock changes with reason, row lock, never below 0, stale-count protection, ledger row | Low: new function only. Rollback: `drop function public.adjust_inventory(jsonb);` |

Apply one at a time through the reviewed migration path (`docs/MIGRATION_PRODUCTION_APPROVAL.md`). After each one, re-run step 1 and the read-only advisors.

**Rehearsed locally (2026-11-15):** `bash scripts/rehearsal/migration-upgrade.sh` applies all 26 to an empty database and,
separately, the 14 production migrations + data and then the 12 pending ones; the resulting public schemas and
grants are byte-identical to each other and to the local stack, and data survives (`docs/evidence/migrations/`).
`bash scripts/rehearsal/backup-restore.sh` dumps public+auth, restores into a scratch database and compares
per-table row counts and content checksums (identical) plus policy/trigger/constraint/index counts.

**Production backup before step 2:** Supabase Dashboard → Database → Backups: confirm a backup newer than one hour
exists (or take a manual `pg_dump` of `public` and `auth` with the owner's database password, stored off-repo).

**Rollback:** 15–19, 21, 22, 24 and 26 are additive; 23 and 25 replace function bodies (keep the previous bodies from the migration files to re-apply) (22: `drop table public.product_badges; alter table public.reels drop column creator_name, drop column creator_consent, drop column tag;` — run before 21's rollback; 21: export, then `drop table public.product_reviews, public.reels;`). `DATA_MODEL_AND_MIGRATIONS.md` → “Rollback sketch” is an outline, not tested scripts; prefer leaving new columns nullable and unused over dropping them. Writing and testing down-scripts is still to do before production. For 20, run `ALTER FUNCTION … RESET search_path`.

**Stop conditions (abort, do not continue to the next file):** any migration errors; `supabase migration list` does
not show it as applied; the read-only advisors report a new ERROR; `select count(*)` on `orders`, `order_items`,
`products`, `product_variants` differs from the pre-migration count; the storefront home or a product page returns 5xx.
Pre-check before each file: row counts of those four tables. Post-check: same counts + advisors + one storefront page.
No migration in 15–26 deletes or rewrites existing rows.

## 3. Owner dashboard actions (no code)

- Supabase Auth: turn on leaked-password protection.
- Review the 964 media rows (`MEDIA_RIGHTS_CUTOUTS.md`). Do not bulk-approve them.

## 4. Merge and deploy

1. Open a PR from `feat/merchant-operating-system` to `main`. CI must pass: `npm run build`, `npm run test:unit`, lint.
2. Deploy a Preview, then smoke-test it.
   **Read-only Preview gate (verified 2026-11-15).** The project's Preview `NEXT_PUBLIC_SUPABASE_URL` points at the
   **Production** Supabase project, and there is no staging project. Every Preview therefore runs read-only:
   - `evaluateMerchantWritePolicy` refuses Preview + Production ref.
   - `MERCHANT_MUTATIONS_DISABLED=1` is passed per deployment (`--env`), not added to project env.
   - Refused routes return `503 {error:"preview_read_only"}` before any network call:
     - all staff writes
     - contact, reviews, COD order creation
     - staff recovery email and password change
     - the cron notification sweep
   - Export audit rows are skipped.
   - Rate limiting stays in memory, so no `consume_rate_limit` rows are written.
   - Proof: `tests/unit/preview-read-only.test.ts`, which runs the real handlers with all outbound network trapped.
   - Functional admin writes on a hosted stack need a separate staging Supabase project (owner decision).
   ```bash
   node scripts/visual/check-routes.mjs --base <preview>
   ```
   Then run `PLAYWRIGHT_BASE_URL=<preview> npx playwright test tests/e2e`.
3. Font change: fonts are now self-hosted (`src/fonts/*.woff2`), so the build no longer fetches Google Fonts. Confirm the Preview renders Hanken Grotesk, Sora and JetBrains Mono.
4. Promote to production only after owner sign-off.

**Production-target safety (before any production build):**
- Vercel → Project → Git: confirm the Production Branch is `main`, so pushing a feature branch only makes a Preview.
- Merge to `main` only after the owner approves the PR; that merge is what deploys production.
- Where possible, build the approved commit as a production-target deployment **without** assigning the domain:
  `vercel deploy --prod --skip-domain`, run only with the owner's approval. Smoke-test it on its own URL, then
  promote with `vercel promote <url>` (approval again).
- Afterwards, check `www.laptopshub.pk` serves the expected deployment id and commit SHA (Vercel → Deployments).
- Set `THEME_PUBLISHED_ENABLED=1` in Production only after migrations 16–19 are applied.

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
3. Place one real low-value test order (owner approval; the owner's own phone/address). Verify:
   - confirmation page and both emails delivered
   - order desk shows it
   - stock decrement and ledger row
   - confirm → pack → ship transitions
   - the cash collection is recorded only when cash is actually received
   Then cancel it before shipment and check the restock.

**Controlled launch order:** verify the following, then turn on COD in Admin as the very last step:
- policies public
- inventory counts entered
- courier coverage and fees confirmed in Admin → Settings → Shipping
- the client's own administrator account invited and signed in (Admin → Staff)
- the one approved test order

Watch Vercel runtime errors, Admin → Orders and the notification column for the first 48 hours.

**Kill switch:** turn off the DB setting in Admin. Ordering closes within the settings cache window (60 s) and immediately after a save, because the save revalidates the cache tag.

## 6. Known gaps to schedule

- The V5 product page sells a product's first purchasable variant; there is no option picker in the frozen V5 design. Products with several variants need a design decision (owner) before they are sold as one listing.
- Mobile Lighthouse performance is 59–74 (lab), driven by one large client chunk and the cinematic hero (`docs/evidence/lighthouse/summary.json`).
- `notFound()` thrown inside dynamic product pages renders the Next error shell instead of the styled 404. This already happens in production; it is not a regression.
- Social proof (built 2026-11-14, third pass) is OFF by default in `store_settings.social_proof`. After COD goes live, turn on recent-order notices / the “Top seller” badge in Admin → Badges & social proof only when the privacy policy covers it; with zero confirmed orders they show nothing.

## 7. Rollback strategy

- **Application:** roll back by promoting the previous production deployment in Vercel (`dpl_6cDJvMYH3FJvc8FgW9LrEpWWDotu`,
  commit `cb638b7`, or whatever is current at release). The pending migrations are backward compatible with that
  build (compatibility matrix), so an application rollback does not need a database rollback.
- **Ordering:** the fastest safe action is the COD kill switch (Admin → Settings → COD off), which closes checkout
  without a deploy.
- **Database:** prefer forward fixes. Function bodies replaced by 23 and 25 can be re-created from the earlier
  migration files; new tables and columns can stay in place unused.
- **Never restore an old database backup over production after live orders exist.** It would erase real orders,
  cash records, stock movements and staff changes. Use a restore only into a separate project to recover specific
  rows, and only with the owner's approval.
- Down-scripts for 15–26 are outlines (§2 "Rollback"), not tested scripts.
