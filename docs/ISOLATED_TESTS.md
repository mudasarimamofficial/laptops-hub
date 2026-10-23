# Isolated database tests

Some tests create Auth users, staff memberships, orders or enable checkout. They must never run against the
hosted project (`xvmmjkrkgznnakcobmww`). Each of these scripts refuses to start unless `NEXT_PUBLIC_SUPABASE_URL`
points at a local Supabase:

| Script | Writes | What it proves |
|---|---|---|
| `scripts/security-role-matrix.mjs` | Auth users, memberships | membership/RPC role rules (editor/inactive staff forbidden from COD RPCs) |
| `scripts/security-role-http-isolated.mjs` | Auth users, memberships, one content row | every admin API and page × every role through real SSR sessions; legal-approval separation; publish/withdraw visibility |
| `scripts/test-cod-concurrency.mjs` | a sandbox order | concurrent COD cash collection: idempotency, no double money |
| `scripts/test-cod-checkout-isolated.mjs` | product, variants, zone, orders, `cod_checkout` setting | `create_cod_order`: forged prices ignored, double submit → one order, no oversell, limits, drafts, zones, anon denied; optional HTTP layer |

## Procedure (Windows, Docker Desktop running)

```bash
supabase start -x studio,storage-api,realtime,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,postgres-meta
supabase status -o env   # API_URL, ANON_KEY, SERVICE_ROLE_KEY
```

The local database is created from `supabase/migrations/` (no production data).

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
node scripts/test-cod-concurrency.mjs
node scripts/security-role-matrix.mjs http://127.0.0.1:3001
node scripts/test-cod-checkout-isolated.mjs http://127.0.0.1:3001
node scripts/security-role-http-isolated.mjs http://127.0.0.1:3001
```

The HTTP-layer checks need the app built and started against the same local stack (public env vars are inlined
at build time), e.g. into a separate dist dir so the normal build is untouched:

```bash
NEXT_DIST_DIR=.next-local COD_CHECKOUT_ENABLED=true NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npx next build
… npx next start -p 3001
```

Stop with `supabase stop` (add `--no-backup` to discard the local data).

Notes
- `auto_expose_new_tables` is unset: privileges come from `20261023120000_explicit_grants.sql`
  (`docs/proposals/EXPLICIT_GRANTS.md`). New tables and functions need explicit GRANTs in their migration.
- The local catalog is empty (no product seed), so `test:security:p0` / `test:security:auth-matrix` report
  "no public prices/catalog" locally; their other checks pass.
- A `.next-local` build rewrites `next-env.d.ts` and `tsconfig.json`; run `git checkout -- next-env.d.ts tsconfig.json`
  afterwards. Stopping a backgrounded `next start` task may leave its node process on the port; check
  `netstat -ano | grep :3001`.

Latest run (2026-10-23, all 13 migrations, no auto-expose): COD collection matrix 16/16 · role matrix 15/15 · checkout isolated 31/31 (incl. shipping quote, order confirmation by token, contact insert as anon, checkout key conflicts, 8×6 concurrent HTTP submits) · staff role HTTP 97/97. New this pass: `quote_cod_shipping` failed for every address once a zone existed (4 checks red before `20261023170000`, green after); contact origin check rejected same-site posts when the server's URL host differs from the browser's (fixed: request Host is accepted). Release audit (drift, push path, injected failure, rollback): `docs/MIGRATION_PRODUCTION_APPROVAL.md`.

Earlier run (2026-10-23, 12 migrations, no auto-expose): role matrix 15/15 · COD collection matrix 16/16 (8 consecutive runs; 2/8/16/32-way same-key bursts, cross-order and different-amount conflicts, over-collection) · checkout isolated 25/25 (incl. same-key different cart/zone conflicts and 8×6 concurrent HTTP submits) · staff role HTTP 97/97 (incl. CMS template gate and COD collection record/replay/conflict through the admin route). Defect reproduction: with `20261023150000` held back, the collection matrix is 12/16 (conflict cases return success with nothing recorded). Guard check: with EXECUTE re-granted to anon, both staff RPCs return `forbidden`. Default privileges: a function/table/sequence created as `postgres` is not accessible to anon/authenticated. Production-path simulation: `auto_expose_new_tables = true` + all migrations gives privileges identical to a fresh build.

Previous run (2026-10-23, local stack, explicit grants, no auto-expose): role matrix 15/15 · checkout isolated 21/21
(incl. 8×6 concurrent HTTP submits) · role HTTP 87/87.

COD collection same-key race (fixed locally 2026-10-23, migration `20261023130000`, not applied to production):
`record_cod_collection` checked the idempotency key only before locking the order, so a concurrent same-key call
failed on `cod_collections_idempotency_uidx` instead of replaying (money was never collected twice). It now
re-checks after `FOR UPDATE` and handles `unique_violation` (same key on another order). `test-cod-concurrency.mjs`
adds 10×8 same-key bursts and a cross-order same-key race: old function 6–8/10 (burst + cross-order fail every
run), fixed function 10/10 on 15 consecutive runs.

## Notification outbox reliability (2026-10-23, 14 migrations)

`npx tsx tests/isolated/outbox-reliability.test.ts` (after `seed-isolated.mjs`, with fake-resend running and the
isolated env; refuses non-local URLs). **11/11**: 6 concurrent workers → one claim, each recipient delivered once ·
live lease on an old row respected, expired lease on a new row recovered · stalled worker overtaken, its late write
refused (`lost`), one delivery · crash after provider acceptance → retry with the same key, one delivery ·
partial delivery → only the failed recipient retried after backoff · timeout the provider still accepted → one
delivery · customer without email `skipped` · fail ×5 → no 6th automatic attempt, marker added once, staff retry
works · first attempt 24 h old → no automatic retry · not configured → nothing claimed · anon cannot call
`claim_notifications`. fake-resend now also simulates `delayMs`, `failTo` and 409 for a key in flight.
Rollback file tested (restore → re-apply). Note: run it after the checkout suite only with a fresh seed (that suite
switches local checkout off at the end).

## Launch journeys (browser, 2026-10-23)

Real UI + real routes + local Supabase + a local stand-in for the email provider (`scripts/test-fixtures/fake-resend.mjs`,
de-duplicates by `Idempotency-Key` like Resend). Order matters: product pages are prerendered at build time, so
**seed before building**.

```bash
node scripts/test-fixtures/fake-resend.mjs 4599 &              # stand-in email provider
supabase db reset --local
node scripts/test-fixtures/seed-isolated.mjs                     # 2 products, Lahore zone, staff; writes .isolated/fixture.json
# build + start with: NEXT_DIST_DIR=.next-local COD_CHECKOUT_ENABLED=true NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true
#   RESEND_API_KEY=re_local_test STORE_FROM_EMAIL=… STORE_NOTIFY_EMAIL=owner@lh-test.local NOTIFY_CUSTOMER_EMAIL=1
#   RESEND_API_URL=http://127.0.0.1:4599 CRON_SECRET=local-cron-secret + local Supabase URL/keys
npx playwright test -c playwright.isolated.config.ts
```

Result: **10/10, two consecutive runs** — product → cart → checkout → confirmation (DB rows, totals, consent version);
business alert + customer email delivered once; track order (wrong phone refused); unserved address / invalid phone /
over-limit refused; concurrent duplicate submit → one order, one notification; editor denied orders; manager confirm →
pack → dispatch with tracking → full COD collection (events + audit rows) and the customer page shows it; fulfillment
cancellation; provider outage → `failed`, staff retry → `accepted`, delivered once; cron requires its secret.
With the outbox lease (2026-10-23): 10/10 twice on a fresh build; one earlier run on a loaded machine timed out
waiting 5 s for "Fully collected." (collection recorded correctly once), not reproduced in the next two runs.
Also on this build: collection 16/16 · role matrix 15/15 · checkout 31/31 · role HTTP 113/113 (incl. zone PATCH and
notification retry). Order lookup: cross-site 403; 10 guesses per IP per 15 min, then 429.
