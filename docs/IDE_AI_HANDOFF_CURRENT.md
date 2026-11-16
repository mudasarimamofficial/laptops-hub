# IDE / AI handoff — current state

**Updated:** 2026-11-16 · **Branch:** `feat/merchant-operating-system` · **Not pushed, not merged, nothing deployed.**
Read this first, then `docs/RESUME.md`, `docs/FINAL_COMPLETION_REPORT.md` and `docs/LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md`.

## Safety boundaries (unchanged)

- Production Supabase `xvmmjkrkgznnakcobmww` (14 migrations applied) and Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` were
  **not touched** in this session. The Supabase CLI is not linked on this machine. Never run `npm run db:push`.
- `.env.local` holds only local demo keys (`ref=none`, issuer `supabase-demo`), local URLs and the fake email provider.
- Preserved: `stash@{0}`, tags `baseline/2026-11-14-pre-guardian`, `checkpoint/2026-11-15-pre-closeout`, and a full
  working-tree snapshot at `refs/backup/2026-11-16-session-start` (incl. untracked files, no `.env.local`).
- Left untracked on purpose (public repo; they contain infrastructure IDs / third-party URLs): `.agents/`,
  `skills-lock.json`, `LAPTOPS_HUB_CURSOR_MASTER_PROMPT_2026-11-14.md`, `LAPTOPS_HUB_LIVE_AUDIT_2026-11-14.md`.

## How to run the isolated stack

```bash
npx supabase start                                   # local Docker stack (54321/54322)
npx supabase db reset --local                        # all migrations from scratch
set -a; . ./.env.local; set +a
node scripts/test-fixtures/seed-isolated.mjs         # clears local test orders, seeds products/zone/staff → .isolated/fixture.json
THEME_PUBLISHED_ENABLED=1 npx next build             # seed BEFORE building (PDPs prerender)
# start: .claude/launch.json → "isolated-app" (next start -p 3001) and "fake-resend" (port 4599)
bash scripts/release/run-final-suite.sh <label>      # exit code 0 only if every suite has rc=0
```

## Milestones in this session

See `docs/LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md` for evidence and the final classification. Short list:

1. Recovery: previous session's uncommitted work committed as `cf08f2f` (marked UNVERIFIED) after a backup ref.
2. `4ab0708` — security + variants: migration 28 (staff direct-write escalation closed, media metadata hidden,
   availability RPC), real per-variant stock on the PDP, exact variant through cart → quote → order → ledger → cancel.
3. Staff invitations: original implementation kept (the previous session's client-side rewrite was not needed and is
   only in `cf08f2f` history). Test now also proves reload persistence and three failure states.
4. Social proof: deterministic baseline (seed clears local test orders, the 36-step suite deletes its orders,
   precondition enforced) — the status-flipping workaround and the skip are gone; exact assertions.
5. Cross-browser: Firefox `NS_BINDING_ABORTED` retry removed; root cause was navigating during an in-flight
   `router.refresh()`; the test now waits for the refreshed server data.
6. Catalog pagination: synthetic 105-product dataset always seeded, storefront "Load more" verified page by page; the
   always-true assertion removed; libuv exit crash (rc=127) fixed at the source; suite runner verdict = exit codes.
7. Mandatory features: global admin search (Ctrl/⌘ K, "/") with server-side role scoping; admin list search no longer
   interpolates raw text into PostgREST filters.
8. Admin **sign-out** (`POST /api/admin/account/sign-out`, works without JS, cross-site refused) in the sidebar footer.
9. Staff invite form pre-hydration defect (typed address kept, button disabled) fixed + regression test.
10. Performance: storefront card photos request the displayed size from the Shopify CDN (`src/lib/catalog/image-url.ts`,
    `srcset`/`sizes`); same rendering.
11. Test races found by repeated full runs, fixed at the cause: 36-step purchase notice checked in a fresh shopper
    session (per-session cap); social-proof "broken video" test no longer waits forever for a play button that the
    unavailable state legitimately removes. `playwright.isolated.config.ts` keeps traces on failure and the suite runner
    copies them to `$TMPDIR/final-run-isolated-failures` before the next Playwright run clears `test-results/`.
12. Docs: release manifest, staging certification (local only — no staging exists), runbook updated to 14 pending
    migrations (15–28; 28 after 27).

## Open items for the next engineer

See "Not done / not verified" in `docs/LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md`.
