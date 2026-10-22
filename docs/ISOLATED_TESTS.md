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

Last run (2026-10-23, local stack, explicit grants, no auto-expose): role matrix 15/15 · checkout isolated 21/21
(incl. 8×6 concurrent HTTP submits) · role HTTP 87/87.

COD collection same-key race (fixed locally 2026-10-23, migration `20261023130000`, not applied to production):
`record_cod_collection` checked the idempotency key only before locking the order, so a concurrent same-key call
failed on `cod_collections_idempotency_uidx` instead of replaying (money was never collected twice). It now
re-checks after `FOR UPDATE` and handles `unique_violation` (same key on another order). `test-cod-concurrency.mjs`
adds 10×8 same-key bursts and a cross-order same-key race: old function 6–8/10 (burst + cross-order fail every
run), fixed function 10/10 on 15 consecutive runs.
