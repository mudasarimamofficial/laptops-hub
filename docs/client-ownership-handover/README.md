# Client ownership handover — index

Started 2026-11-24 by an independent audit. Files are added as each topic is verified; a topic that is not yet
written is listed as **TODO** rather than covered by an older document that was not re-checked.

| # | Topic requested in the owner's brief | File | Status |
|---|---|---|---|
| 00 | Executive status | `00_EXECUTIVE_STATUS.md` | written |
| 01 | Current project inventory | `00_EXECUTIVE_STATUS.md` (production + DB counts), `09`, `11` (infrastructure) | partial — no file-level manifest yet |
| 02 | Requirements traceability | — | TODO (historical: `docs/FINAL_REQUIREMENTS_MATRIX.md`, not re-verified) |
| 03/04 | Admin completeness / Shopify parity | `02_DEFECT_REGISTER_AND_GAPS.md` | partial — homepage editor verified; other modules rely on earlier evidence |
| 05 | Theme editor spec and acceptance | `05_THEME_EDITOR_SPEC_AND_ACCEPTANCE.md` | written |
| 06 | Security | `02_DEFECT_REGISTER_AND_GAPS.md` (LH-006/007/013/015/016) | partial |
| 07 | Database and data integrity | `00_EXECUTIVE_STATUS.md` counts | partial |
| 08 | Performance and accessibility | — | TODO (NO_LCP not re-measured) |
| 09 | Free tier / cost risk | `09_FREE_TIER_COST_RISK.md` | written |
| 10 | Backup and restore | existing `docs/LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md` | restore drill NOT run this pass |
| 11–13 | GitHub / Supabase / Vercel + domain transfer | `11_OWNERSHIP_TRANSFER_PLAN.md` | written (not executed) |
| 14 | Environment and integration inventory | `11_OWNERSHIP_TRANSFER_PLAN.md` (env names), `09` | partial |
| 15 | Merchant admin manual | `15_MERCHANT_GUIDE_HOMEPAGE_EDITING.md` + existing `docs/LAPTOPS_HUB_ADMIN_MERCHANT_HANDBOOK.md` | homepage section new |
| 16–20 | Operations guide, acceptance checklist, production evidence, open decisions, signed checklist | `18_FINAL_PRODUCTION_EVIDENCE.md`; decisions in `00` | partial |
| 21 | Migration ledger reconciliation (LH-025) | `21_MIGRATION_LEDGER_RECONCILIATION.md` | written — **awaiting owner approval, not executed** |
| 22 | Admin self-service matrix (G01–G49) | `22_ADMIN_SELF_SERVICE_MATRIX.md` | written; §0 tracks fixes (updated 2026-11-25) |
| 23 | Owner decisions, risks and owner tasks | `23_OWNER_DECISIONS_AND_RISK_REGISTER.md` | written 2026-11-25 |
| 24 | LH-025 Option A: proven repair plan (export, restore, rehearsal, exact sequence) | `24_LH025_OPTION_A_EXECUTION_PLAN.md` | **executed 2026-11-26 with owner approval** (§10) |
| SEO | Search, AEO and Search Console | `seo-search/` (start at `00`; dated checks in `17`) | engineering implemented; Google indexing pending |
