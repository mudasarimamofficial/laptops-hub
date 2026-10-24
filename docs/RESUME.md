# Resume here

## CHECKPOINT 2026-10-24 (read first)

Production: `main` `700524d` → `dpl_7W2x8QxLKqvcG1iw5WophtRJjhiP` · DB ledger 14 · COD **off** · 0 orders · 0 zones ·
**0 active staff** (test manager deactivated) · email not configured · retry workflow registered, inactive (no secret).

Open draft PRs to `main` (all green; each merge redeploys Production; owner approval required):
| PR | Branch | What | Evidence |
|---|---|---|---|
| #4 | `chore/test-production-guard` | fixture-writing suites can never write to production (`scripts/lib/local-only.mjs`) | 7 writers refuse with prod env; prod counts unchanged |
| #5 | `feat/admin-password-recovery` | staff password recovery (Supabase Auth) | 5/5 recovery journeys (Mailpit), Preview evidence comment |
| #6 | `fix/cms-cache-timing` | publish/withdraw visible on next request; PDP policy tags follow CMS state | role HTTP 115/115 ×10 after journeys |
Merge notes: #4 and #5 both edit the `test:unit` line in `package.json` (resolve by keeping both tests). #4 and #6 both edit
`scripts/security-role-http-isolated.mjs` (different hunks).

Blocked on the owner:
- **"ULTIMATE AUTONOMOUS FULL-LAUNCH PROJECT BIBLE" was referenced on 2026-10-24 but not attached** — needed for approved
  business facts/copy (removing every customer-visible "BEING FINALISED", policies, contact, homepage inquiry form spec).
- Owner account + public sign-up off (guide A) · shipping zones · Resend + Supabase SMTP · policy facts · prices ·
  photo rights · workflow 4.1. Single source: `docs/FINAL_LAUNCH_OWNER_INPUTS.md`; launch order `docs/FINAL_LAUNCH_SEQUENCE.md`.

Customer-visible placeholders today (all need owner facts): content pages with pending sections (gated pages show
"BEING FINALISED"), PDP policy tags (until policies are published — fixed in #6 to follow CMS), FAQ answers marked
pending, checkout "Online ordering opens soon" (correct while COD is off).

Local test stack: `supabase/config.toml` site URL `http://127.0.0.1:3001`; isolated env script pattern in
`docs/ISOLATED_TESTS.md`; product pages are prerendered — seed before build.

**Latest (2026-10-23, final launch closure):** outbox lease fix; migration `20261024100000` **applied to production 2026-10-23** (owner-approved, ledger 14;
`docs/MIGRATION_PRODUCTION_APPROVAL.md`). **Production web: `700524d` (`main`) deployed 2026-10-24 as `dpl_7W2x8QxLKqvcG1iw5WophtRJjhiP`**; PRs #1/#2/#3 merged. Next: owner configuration (sequence step 3) → email → controlled test order. Launch order:
`docs/FINAL_LAUNCH_SEQUENCE.md`; owner inputs and how-tos: `docs/FINAL_LAUNCH_OWNER_INPUTS.md`; policy skeletons:
`docs/POLICY_DRAFTS.md`. Release candidate `140bc31`, Preview `dpl_3YJhthM3LkiAE1rbSQn3oom7b2NX` (e2e 39/1 skipped).
Mode B not activated (not approved). Production unchanged.

State (2026-10-23): **Security & COD integrity pass done on `fix/v5-correctness-parity` (stacked draft PR #2 → `feat/v5-storefront-admin`); Preview `dpl_9nGNosyhPhPckFWpXLwnRWmjDkpv` verified. Production database: only Option A applied (owner-approved emergency revoke); Option B pending (`docs/MIGRATION_PRODUCTION_APPROVAL.md`).** Not merged, no Production deploy, COD off, all content pages gated.

## Current state (2026-10-23)
| Item | Value | Status |
|---|---|---|
| Branch / HEAD | `fix/v5-correctness-parity` (latest commit: `git log -1`) | verified |
| PR #1 | `feat/v5-storefront-admin → main`, draft, head `ea652f2` | verified |
| PR #2 | `fix/v5-correctness-parity → feat/v5-storefront-admin`, draft, checks 2/2 | verified |
| Supabase `xvmmjkrkgznnakcobmww` ledger | 13 applied (Option A + Option B, owner-approved 2026-10-23); nothing pending | verified |
| Staff RPC exposure | **closed** 2026-10-23 (Option A): anon/authenticated → 42501 on the three functions | verified |
| Future-object default privileges | fixed on production (`20261023140000`) | verified |
| RLS | enabled on all 22 public tables | verified read-only |
| Catalog | 226 public PDPs 200 · 6 drafts 404 · 39 collections | verified (route check) |
| Preview | `dpl_9nGNosyhPhPckFWpXLwnRWmjDkpv` (https://laptops-kg7kii4d0-mudasarimamofficial-gmailcoms-projects.vercel.app, SSO) | verified |
| Production alias `laptops-hub.vercel.app` | owner redeploy of `34f9839` (`dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH`); pages 200, COD 403, indexable; sitemap host wrong until next deploy | verified |
| Vercel env | `V5_CUTOUT_BASE`, `V5_CONTENT_PREVIEW` not defined; COD flags encrypted, Preview COD → 403 | verified |
| Content | 13 `content_pages` rows `pending` | reported (2026-10-22) |

## Verified infrastructure
- GitHub `mudasarimamofficial/laptops-hub`
- Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` (team `team_l7hth478q4bLcmoKR21X7uqm`), Git integration builds Preview per push
- Supabase CLI is logged in; `supabase link --project-ref xvmmjkrkgznnakcobmww` (local, gitignored) allows read-only `supabase db query --linked` / `migration list --linked`. Never run `db push`, `db reset` or fixture scripts against it without owner approval.

## Git / PR strategy
- Review/merge #1 into `main` first; GitHub then retargets #2 to `main`. Do not open `fix/... → main` while #1 is open. Do not merge either without owner review.
- Merging does not change the database: migrations are applied separately (approval request above).

## Local setup
1. `git status`. If tracked files show as deleted, first check for uncommitted work (`git stash list`, `git diff`), then restore only the positively identified files from the verified commit (`git restore -- <paths>`). No blanket `git restore .`, `reset --hard` or `clean -fdx`.
2. `vercel env pull .env.local --yes --environment=development` (do not overwrite an existing `.env.local` without checking it)
3. Parity runs only: `V5_CUTOUT_BASE="http://127.0.0.1:4173/assets/cut"` in `.env.local`; build/start with `V5_CONTENT_PREVIEW=1` to compare content templates (never set either in Vercel before approval).
4. `npm ci && npm run build && npx next start -p 3000 -H 127.0.0.1` · reference: `npx http-server "Laptops Hub storefront" -p 4173 -a 127.0.0.1 -c-1`
5. Preview e2e: create a share link, save a session with `@playwright/test` chromium (`channel: "chromium"`), then `PLAYWRIGHT_BASE_URL=<url> PLAYWRIGHT_STORAGE_STATE=<state.json> VISUAL_EVIDENCE_DIR=test-results/preview-evidence npx playwright test tests/e2e` (relative evidence dir).

## QA commands
- `npm run test:unit` · `npm run test:security:p0` · `npm run test:security:auth-matrix` · `npm run test:catalog:pagination`
- `npx playwright test tests/e2e` (Preview: `PLAYWRIGHT_BASE_URL=<url> PLAYWRIGHT_STORAGE_STATE=<state.json>` after opening a Vercel share link)
- `npx tsx scripts/visual/verify-v5-data.mts` · `node scripts/visual/check-routes.mjs [--base --share]`
- `node scripts/visual/capture.mjs --group=… [--only --vp --next --share --out --next-only=1]` → `node scripts/visual/report.mjs`
- `node scripts/visual/axe-sweep.mjs` · `node scripts/visual/console-sweep.mjs [base] [state.json]`
- `node scripts/gen-v5-content.mjs` regenerates `src/lib/content/v5-content.ts` + `docs/OWNER_CONTENT_NEEDS.md`
- Screenshots are gitignored (they may contain locally served, unapproved cutouts).

## Isolated tests
Local Supabase only (`docs/ISOLATED_TESTS.md`): COD collection matrix 16/16 · role matrix 15/15 · checkout isolated 31/31 (incl. shipping quote, order confirmation by token, contact insert as anon, checkout key conflicts, 8×6 concurrent HTTP submits) · staff role HTTP 97/97 · push path and rollback verified against the production fingerprint.

## Safest next step
0. **Owner inputs: `docs/FINAL_LAUNCH_OWNER_INPUTS.md`** (single list; engineering is release-candidate ready per `docs/LAUNCH_COMPLETION_MATRIX.md`).
1. Option A and Option B are applied (`docs/MIGRATION_PRODUCTION_APPROVAL.md`). Pre-launch modes implemented and verified on Previews (`docs/PUBLIC_SITE_PLAN.md`); next owner decision: activate mode B (recommended) or A on Production — the single approval is described there. Then the public-site decision (`docs/PUBLIC_SITE_PLAN.md`) and the release sequence (`docs/RELEASE_PLAN.md`). Owner package: `docs/OWNER_READINESS_REPORT.md`.
2. Review PR #1, then PR #2.
3. Owner decisions below.

## Known gaps
- e2e "inquiry dialog submits to /api/contact" is skipped (needs an inquiry-only product in a non-production DB).
- Visual parity harness not re-run this pass (no storefront/CSS change; public pages unchanged while content is gated). Last report: `docs/V5_PIXEL_DIFF_REPORT.md`.
- Real-device checks (iOS Safari, Android Chrome) not performed.

## Owner decisions
Production DB approval (above) · content approval per page (`docs/OWNER_CONTENT_NEEDS.md`; publish in /admin/content — pages with "being finalised" sections need written copy; legal pages also need legal approval) · media rights (catalog photos + cutouts) · shipping zones/fees · contact facts · staff bootstrap · availability/inquiry and description-cleanup proposals · production alias · COD go-live · PR review.
