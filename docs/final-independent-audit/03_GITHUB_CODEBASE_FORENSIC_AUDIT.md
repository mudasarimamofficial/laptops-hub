# 03 — GitHub / codebase forensic audit

**Date:** 2026-11-17  
**Repo:** `mudasarimamofficial/laptops-hub` (public) · default `main`  
**Tip:** `585c8e96a3b3b6dfb9fa97e9e1c72a55c90902a4` = Merge PR #13

## PR / release history (verified via `gh`)

| PR | State | Title |
|---|---|---|
| #13 | MERGED | Theme editor overflow 1024–1279 |
| #12 | MERGED | Next 16.4.5 + theme ordering/preview + crash-safe tests |
| #11 | MERGED | Map keyboard focus a11y |
| #10 | MERGED | Merchant OS + reviews/map + admin latency (migrations 15–29) |
| #1–#9 | MERGED (except #7 CLOSED) | Prior RC / security / COD / CMS work |

Open PRs: **none**.

## Branch protection

**FAIL / P2:** `main` has **no** GitHub branch protection (`HTTP 404`). Force-push and unreviewed merges are possible. Recommend required PR reviews + no force-push for owners.

## Stack versions

| Package | Verified |
|---|---|
| `next` | **16.4.5** |
| `eslint-config-next` | **16.4.5** |

## Architecture map (high level)

- App Router route groups: `(storefront)` / `(admin)`
- Commerce: server COD checkout + quote APIs; atomic DB functions
- Admin: Shopify-inspired IA in `src/components/admin/shell/nav.ts`
- Content: pages, blog, reels, testimonials, theme versions/publications
- Tests: unit, SQL matrices, security matrices, Playwright isolated + e2e

## Suspicious patterns scan

Grep for TODO/FIXME/placeholder in `src/**/*.ts(x)`: mostly **form placeholders** and intentional empty-state comments (testimonials/reviews hide when empty). No production “coming soon” handlers flagged as fake success in this pass.

## Closeout commits on main

`4ab0708` (variants + staff write escalation) and `35da4b7` (sign-out, CDN card photos) **are ancestors of `origin/main`** — prior “unpushed only” narrative is obsolete for those commits.

## Hygiene

- Untracked local noise (not for commit): `.agents/`, prompt/audit markdowns, `skills-lock.json`, reviews HTML source
- Stash `stash@{0}` preserved
- Backup refs: `baseline/2026-11-14-pre-guardian`, `checkpoint/2026-11-15-pre-closeout`, `refs/backup/2026-11-16-session-start`

## Verdict

**PASS** for identity, merge history, stack versions, and presence of merchant OS on production SHA.  
**PARTIAL** for repo hygiene (no branch protection; optional screenshot bulk in historical PRs not re-audited this pass).
