# 17 — Engineering remediation log

**Date:** 2026-11-17 (reconciled)  
**Branch:** `audit/final-independent-certification`

## Remediations on PR #14

| ID | Defect | Action | Commit | Verified |
|---|---|---|---|---|
| DEF-016 | Inventory desk counted soft-deleted variants | Counts use same live-product filter as list; checkout readiness excludes deleted | `d29cc90` | Isolated e2e + code review |
| DEF-017 | No keyboard shortcut help vs Shopify | `AdminShortcuts` (`?` + G-nav); later role-filter + modal guard | `d29cc90` + follow-up | Isolated e2e |
| Docs | False “apply migrations 15–28” / ENGINEERING COMPLETE | Corrected certification + risk + deployment docs | follow-up | Linked ledger 29/29 (MCP list_migrations = 29) |
| DEF-017 | `Shift+/` opened Search instead of shortcuts | Search ignores `shiftKey`; test presses `?`; role + modal guards | follow-up | `p0-admin-search` 5/5 |
| Generated | `.next-local` paths in `tsconfig` / `next-env` | Restored to `origin/main` standard `.next` references | follow-up | Clean-clone safe |
| Hygiene | `.next-local` paths in `next-env.d.ts` / `tsconfig.json` | Restored main’s standard `.next` references | follow-up | Diff vs `origin/main` |

## Not applied here (owner / careful follow-up)

| ID | Item | Why |
|---|---|---|
| DEF-001 | Branch protection | Owner GitHub settings |
| DEF-002 | Email env | Owner Resend + DNS |
| DEF-005 | Leaked-password protection | Owner Supabase Auth |
| DEF-009–011 / content 404s | Reels, testimonials, policies | Owner content — not software defects |
| DEF-018–023 | Security headers / CSP | Needs Maps/media/font compatibility test — separate PR preferred |
| Staging | Optional hosted staging | Paid/cloud decision |

## Explicit non-actions

- **Do not** reapply migrations 15–29 (already on production).
- **Do not** enable COD or `THEME_PUBLISHED_ENABLED` in this release.
- **Do not** delete soft-deleted QA product / ledger rows.

## Verdict

PR #14 is a correctness + merchant UX + documentation reconciliation release, not a migration release.
