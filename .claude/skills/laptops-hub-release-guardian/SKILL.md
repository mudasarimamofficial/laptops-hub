---
name: laptops-hub-release-guardian
description: Release gate for Laptops HUB. Use before claiming any Laptops HUB work is done, before committing, opening a PR, proposing a merge/deploy/migration, or touching checkout, shipping fees, COD, store_settings, Supabase migrations, theme publishing or storefront copy. Enforces evidence-based PASS/FAIL/BLOCKED/NOT TESTED reporting and the owner-approval boundaries.
---

# Laptops HUB Release Guardian

## 1. Hard boundaries (never cross without explicit owner approval in chat)

- No merge to `main`, deploy or promotion. No Vercel env change.
- No production Supabase DDL/DML (`xvmmjkrkgznnakcobmww`). Never run `supabase db reset`, `db push` or `scripts/test-fixtures/*` while linked to production.
- Do not turn on COD (`NEXT_PUBLIC_COD_CHECKOUT_ENABLED`, `COD_CHECKOUT_ENABLED`, `store_settings.cod_checkout.enabled`).
- Send no real notifications. Change no real orders, shipping fees, staff, policies or media rights.
- Never invent products, specs, prices, stock, reviews, sales, badges, policies, warranty, delivery times or company facts. Use pending blocks in `data/lh-content.js`.
- Never publish or hotlink reference assets you do not own (e.g. ronin.pk reels).
- Never print secrets, whether in logs, screenshots, docs, commits or replies.
- The V5 design system is frozen: fix things, do not redesign.

## 2. Before you change anything

1. Read `docs/RESUME.md`, `docs/FINAL_COMPLETION_REPORT.md` and `docs/LAPTOPS_HUB_CLIENT_REQUESTS_ACCEPTANCE_MATRIX.md`.
2. Run `git status`. If tracked files look reverted, stash them; never run `restore .`, `reset --hard` or `clean`.

## 3. Evidence ladder (run what the change touches)

| Change touches | Required evidence |
|---|---|
| Any TS | `npx tsc --noEmit -p .` and `npx eslint src tests --quiet` with 0 errors |
| Logic | `npm run test:unit` (add the new test file to the script) |
| UI / routes | `npx next build`, then `npx next start -p 3001 -H 127.0.0.1` and `npx playwright test --config=playwright.isolated.config.ts` (load `.env.local` first: `set -a; . ./.env.local; set +a`) |
| SQL / RPC / fees / reels / reviews | `scripts/db-tests/shipping-cod-matrix.sql` and `scripts/db-tests/reels-reviews-matrix.sql` on the **local** DB (both ROLLBACK) |
| Layout | 360/390/768/1280/1440 with no horizontal overflow (p0 spec pattern) |

Isolated reruns can hit the deliberate rate limits (recover: 3 per hour per email). Clear them **locally only** with:

```bash
docker exec supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -c "delete from public.rate_limit_buckets;"
```

After a build, run `git checkout -- tsconfig.json` if Next reformatted it.

## 4. Reporting

- Mark every requirement **PASS** (cite the command/spec and its count), **FAIL**, **BLOCKED** (name the owner decision) or **NOT TESTED**. Never write "done" without evidence.
- Label: `READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED` until the owner has approved migrations, merge, deploy and COD, and a real test order has been verified.
- Update the acceptance matrix, `docs/LAPTOPS_HUB_E2E_TEST_REPORT.md` and `docs/RESUME.md`.
- End commit messages with the session's attribution line.
