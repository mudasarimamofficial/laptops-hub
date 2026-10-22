# Resume here

State (2026-10-22): **All V5 templates ported (storefront + content) on `fix/v5-correctness-parity` @ `568ce08`; Preview verified.** Not merged, no new PR, no Production change, COD off, all content pages gated (unpublished in CMS).

## Verified infrastructure
- GitHub `mudasarimamofficial/laptops-hub` · branch `fix/v5-correctness-parity` (stacked on PR #1's head `feat/v5-storefront-admin` @ `ea652f2`)
- Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` · Preview `dpl_CPF9iwcqGWj8C6k2FY9KFp5kyfTq` (https://laptops-p0o7svszl-mudasarimamofficial-gmailcoms-projects.vercel.app, SSO)
- Supabase `xvmmjkrkgznnakcobmww` (CLI access; MCP connector lacks permission) · 232 products / 226 active / 6 draft · 13 content rows, all `pending` · 0 inquiries, 0 orders
- **Production alias `laptops-hub.vercel.app` is public** and serves an older owner redeploy of `ea652f2` (COD 403). Owner decision pending.

## Git / PR strategy (recommended)
- PR #1: `feat/v5-storefront-admin → main`, 9 commits, draft, mergeable, checks green, no reviews.
- This branch = PR #1 head + 7 commits (clean stack; 107 files vs PR #1, 158 files vs `main`).
- **Open a stacked draft PR `fix/v5-correctness-parity → feat/v5-storefront-admin`.** It shows only the new work. Review/merge #1 into `main` first; GitHub then retargets the stacked PR to `main` (or retarget manually). Do **not** open `fix/... → main` while #1 is open (it would duplicate #1's whole diff), and do not merge either PR without owner review.

## Local setup (the working tree has been wiped twice — restore first)
1. `git status` — if tracked files show as deleted: `git restore .`
2. `vercel env pull .env.local --yes --environment=development`
3. Parity runs only: `V5_CUTOUT_BASE="http://127.0.0.1:4173/assets/cut"` in `.env.local`; build/start with `V5_CONTENT_PREVIEW=1` to compare content templates (never set either in Vercel before approval).
4. `npm ci && npm run build && npx next start -p 3000 -H 127.0.0.1` · reference: `npx http-server "Laptops Hub storefront" -p 4173 -a 127.0.0.1 -c-1`

## QA commands
- `npm run test:unit` · `npm run test:security:p0` · `npm run test:security:auth-matrix` · `npm run test:catalog:pagination`
- `npx playwright test tests/e2e` (Preview: `PLAYWRIGHT_BASE_URL=<url> PLAYWRIGHT_STORAGE_STATE=<state.json>` after opening a Vercel share link)
- `npx tsx scripts/visual/verify-v5-data.mts` · `node scripts/visual/check-routes.mjs [--base --share]`
- `node scripts/visual/capture.mjs --group=… [--only --vp --next --share --out --next-only=1]` → `node scripts/visual/report.mjs`
- `node scripts/visual/axe-sweep.mjs` · `node scripts/visual/console-sweep.mjs [base] [state.json]`
- `node scripts/gen-v5-content.mjs` regenerates `src/lib/content/v5-content.ts` + `docs/OWNER_CONTENT_NEEDS.md`
- Screenshots are gitignored (they may contain locally served, unapproved cutouts).

## Isolated tests
Done on a local Supabase (`docs/ISOLATED_TESTS.md`): role matrix 15/15 · COD concurrency 6/6 · checkout isolated 18/18 (incl. 8×6 concurrent HTTP submits) · staff role × admin API/page over HTTP 86/86 (incl. legal-approval separation) — all on a local Supabase built from `supabase/migrations`, never production (`docs/ISOLATED_TESTS.md`).

## Safest next step
Review `docs/proposals/EXPLICIT_GRANTS.md` and add an explicit-GRANT migration before 2026-10-30 (verify with `supabase db reset --local` without `auto_expose_new_tables`, then the isolated suite). Then the owner decisions below.

## Owner decisions
Content approval per page (`docs/OWNER_CONTENT_NEEDS.md`; publish in /admin/content, legal pages also need legal approval) · media rights (catalog photos + cutouts) · shipping zones/fees · contact facts · staff bootstrap · availability/inquiry and description-cleanup proposals · production alias · COD go-live · PR review.
