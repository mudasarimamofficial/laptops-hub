# Final E2E report — release 2026-11-16

Machine-readable: `FINAL_E2E_REPORT.json`. Raw logs: `docs/evidence/final-run/`.

## Full suite (isolated stack, fresh `db reset`, synthetic seed)

Run `final-2026-11-16-r2` on HEAD `2bb58d4` plus the uncommitted test fix and ESLint ignore committed in the
next commit. 26 suites, 25 rc=0 on the first pass.

| Suite | Result |
|---|---|
| Static: lint / tsc / npm audit | PASS (lint 0 errors, 12 warnings in existing files) / PASS / PASS |
| Unit (incl. testimonials + map) | PASS |
| SQL matrices: shipping/COD, merchandising, reels/reviews, testimonials | 37/37, 15/15, 17/17, 19/19 |
| Security: P0 probe, auth matrix, role matrix, role HTTP, direct access | 9/9, 24/24, 15/15, 126/126, 193/193 |
| Theme RLS, theme publish/rollback | PASS |
| COD concurrency, COD checkout (isolated; public COD stays disabled in production) | 16/16, 32/32 |
| Inventory orders + ledger | 22/22, PASS |
| Settings navigation, merchant smoke, CSV commit, catalog pagination | PASS, 25/25, PASS, 9/9 |
| **E2E isolated** (incl. 36-step owner acceptance, testimonials/map, bulk selection, sign-out replay) | first pass **106 passed, 1 failed**; rerun **108/108 passed** (see below) |
| E2E legacy | 27/27 |
| Cross-browser: Chromium, WebKit, Firefox; desktop + phone | 110 passed |

### The one first-pass failure

`shipping-zones.spec.ts › zone rules …` timed out at sign-in. The trace shows the login page's JS chunk failing with
`net::ERR_NO_BUFFER_SPACE`, which is Windows running out of socket buffers on the test host. The page never hydrated,
so the Sign in button stayed disabled. This is not an application defect: the same test passes in every other run, and
the host's TCP state was normal afterwards. The whole isolated E2E suite was rerun, unchanged, with no retries
enabled: **108 passed, 0 failed, 0 flaky** (`e2e-isolated-rerun.log`).

One real test defect was fixed earlier in this run: the reviews approve/reject steps raced the server write. They now
wait for the row to leave the queue and for the DB status, then check the approved filter. The assertions are
stricter, not weaker.

## Migration and compatibility

- Real production backup restored and upgraded 14 → 29, with data unchanged and the schema identical to a clean build
  (`MIGRATION_VERIFICATION.md`).
- Production code `cb638b7` built and run against the fully migrated schema: **20/20**. Covers the storefront, cart,
  checkout page, track order, contact anon insert, owner sign-in and 9 admin pages, with no client errors
  (`docs/evidence/migrations/old_code_compat.json`).

## Live QA

**Not run for this release: it is not deployed.** Read-only checks on the current production (`cb638b7`): 267/267
sitemap URLs 200, robots rules correct, no CSP blocking iframes, CRM on `app.` untouched.

## Performance

Modelled locally only (`ADMIN_PERFORMANCE_REPORT.md`): median admin TTFB 1 753 ms (iad1 model) → 365 ms (sin1
model). **Not a production measurement.** Real authenticated p50/p95 needs the deploy.

## Classification

**ENGINEERING VERIFIED LOCALLY — STAGING BLOCKED.** No hosted writable staging exists, and creating one may need a
paid plan. Production migrations and deploy wait on explicit owner approval (`FINAL_PRODUCTION_AUDIT.md`).
