# 18 — Deployment verification

**Date:** 2026-11-17  
**Production deployment:** `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N`  
**Commit:** `585c8e9` (Merge PR #13: theme editor overflow at 1024-1279px; release record)  
**Branch:** `main`

## Production deployment state

| Check | Result |
|---|---|
| Deployment state | READY |
| Target | Production |
| Rollback candidate | Yes (`dpl_2gJc3wmKpE5hxJrQywnCrLRBrcay` / PR #12 also available) |
| Node.js | 24.x |
| Framework | Next.js |
| Region | `sin1` (Singapore) |

## Domain resolution

| Domain | Status | Redirect |
|---|---|---|
| `www.laptopshub.pk` | Verified | Primary (no redirect) |
| `laptopshub.pk` | Verified | 308 → `www.laptopshub.pk` |
| `laptopshubpk.vercel.app` | Verified | 308 → `www.laptopshub.pk` |

## Live verification (2026-11-17)

| Check | HTTP | Console errors | Assessment |
|---|---|---|---|
| Homepage | 200 | None | PASS |
| Cart (empty) | 200 | None | PASS |
| PDP (Dell 7420) | 200 | None | PASS |
| Admin login | 200 (via 302) | None | PASS |
| COD API | 403 | — | PASS (gate working) |
| Sitemap | 200 | — | PASS |
| Robots.txt | 200 | — | PASS |

## Recent deployment history (all 10 READY)

No ERROR or CANCELED deployments in recent history. Production deployments correspond to merged PRs only (#11, #12, #13). Preview deployments build correctly from feature branches.

## What is NOT deployed

The `audit/final-independent-certification` branch (`d29cc90`) builds successfully as a preview deployment (`dpl_HpnVn5P…`, READY) but is NOT promoted to production. It contains:
- Inventory count fix (DEF-016)
- Shortcut help (DEF-017)
- All audit documentation

The `feat/merchant-operating-system` branch contains significant engineering work (variants, security migration 28, admin features, test suites) that is also NOT on production.

## Verdict

**PASS** — production deployment is healthy, all domains resolve correctly, all critical routes respond as expected, COD gate is enforced.
