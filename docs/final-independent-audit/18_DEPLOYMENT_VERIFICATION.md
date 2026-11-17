# 18 — Deployment verification

**Date:** 2026-11-17 (reconciled)  
**Production deployment:** `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N`  
**Commit:** `585c8e9` (Merge PR #13)  
**Branch:** `main`

## Production deployment state

| Check | Result |
|---|---|
| Deployment state | READY |
| Target | Production |
| Rollback candidate | Yes (`dpl_2gJc3wmKpE5hxJrQywnCrLRBrcay` / PR #12 also available) |
| Node.js | 24.x |
| Framework | Next.js 16.4.5 |
| Region | `sin1` (Singapore) |
| DB migrations | **29/29 applied** — unchanged by this PR |

## Domain resolution

| Domain | Status | Redirect |
|---|---|---|
| `www.laptopshub.pk` | Verified | Primary |
| `laptopshub.pk` | Verified | 308 → `www.laptopshub.pk` |
| `laptopshubpk.vercel.app` | Verified | 308 → `www.laptopshub.pk` |
| `app.laptopshub.pk` | CRM (Hostinger) | Do not modify |

## Live verification (production)

| Check | HTTP | Assessment |
|---|---|---|
| Homepage | 200 | PASS |
| Cart | 200 | PASS |
| Admin login / session | 200 | PASS (owner session used in audit) |
| COD API | 403 | PASS (gate) |
| Sitemap / robots | 200 | PASS |

## PR #14 Preview (not production)

| Item | Value |
|---|---|
| Branch | `audit/final-independent-certification` |
| Commits | `d29cc90` (code) → `c59b1f9` (docs) |
| Latest Preview | `dpl_FYurRSfAy5JD6nUMxJuuvUzExpx2` READY |
| Contains | DEF-016 inventory counts · DEF-017 shortcuts · audit docs |
| Must not | Enable COD · set `THEME_PUBLISHED_ENABLED` · reapply migrations |

## Corrected note on merchant-operating-system

PR #10–#13 already merged merchant OS / migrations / theme work into `main`.  
Do **not** treat `feat/merchant-operating-system` as an undeployed migration source for production. Remaining PR #14 delta is inventory/shortcuts + audit documentation.

## Verdict

**PASS** — production healthy and gated.  
**PR #14** — Preview READY; production promotion pending acceptance gates.
