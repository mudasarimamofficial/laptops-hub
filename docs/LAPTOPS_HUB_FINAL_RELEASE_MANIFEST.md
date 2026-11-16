# Laptops HUB — Release Manifest (candidate, 2026-11-16)

**Status: release candidate on a local branch — not pushed, not merged, not deployed, no production migration applied.**

| Item | Value |
|---|---|
| Repository / branch | `mudasarimamofficial/laptops-hub` · `feat/merchant-operating-system` |
| Candidate commit | the final checkpoint commit on this branch (see `git log -1`; previous checkpoint `35da4b7`) |
| Base | `main` (production currently runs `main`) |
| Preserved references | `stash@{0}`, tags `baseline/2026-11-14-pre-guardian`, `checkpoint/2026-11-15-pre-closeout`, `refs/backup/2026-11-16-session-start` |
| Verification | `docs/evidence/final-run/summary.json` + logs; `LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md` §C |

## Database migrations to apply (in order, after a fresh backup and the owner's written approval)

Production has migrations 1–14. The release needs **15–28**, applied in filename order (`supabase/migrations/`):

| # | File |
|---|---|
| 15 | `20261025120000_merchant_catalog_extensions.sql` |
| 16 | `20261025130000_site_builder_sections.sql` |
| 17 | `20261025140000_theme_publish_variant_rpc.sql` |
| 18 | `20261025150000_theme_rls_inventory_hardening.sql` |
| 19 | `20261025160000_theme_immutability_service_role.sql` |
| 20 | `20261114100000_function_search_path_hardening.sql` |
| 21 | `20261115100000_reels_and_product_reviews.sql` |
| 22 | `20261116100000_merchandising_badges_and_reel_details.sql` |
| 23 | `20261117100000_order_inventory_integrity.sql` |
| 24 | `20261117110000_anon_write_revoke_and_fk_indexes.sql` |
| 25 | `20261117120000_shipping_zone_rules.sql` |
| 26 | `20261117130000_inventory_adjustments.sql` |
| 27 | `20261117140000_catalog_column_security_grants.sql` |
| 28 | `20261117150000_staff_direct_access_least_privilege.sql` — must follow 27 |

Dependencies and code↔schema compatibility: `LAPTOPS_HUB_MIGRATION_COMPATIBILITY_MATRIX.md`. Procedure, preflight and
rollback: `LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md`, `LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md`. Never `npm run db:push`
from a developer machine.

## Environment variables read by the app (names only — values live in Vercel / `.env.local`, never in git)

Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ·
Site: `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `SITE_PRELAUNCH`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` ·
Checkout (keep off until the owner approves): `COD_CHECKOUT_ENABLED`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` ·
Email: `RESEND_API_KEY`, `RESEND_API_URL` (tests only), `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `NOTIFY_CUSTOMER_EMAIL`,
`NOTIFY_TIMEOUT_MS` · Theme: `THEME_PUBLISHED_ENABLED`, `THEME_PUBLISH_DISABLED` · Other: `CRON_SECRET`,
`V5_CONTENT_PREVIEW`, `V5_CUTOUT_BASE`.

## Not in this release / gated

- Cash on delivery stays **off** until the owner separately approves activation (and the §B items of
  `LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md` are done).
- Policies, fees, stock counts, media rights: owner inputs, not shipped content.
- Deliberately untracked (not part of the release): `.agents/`, `skills-lock.json`,
  `LAPTOPS_HUB_CURSOR_MASTER_PROMPT_2026-11-14.md`, `LAPTOPS_HUB_LIVE_AUDIT_2026-11-14.md`.
