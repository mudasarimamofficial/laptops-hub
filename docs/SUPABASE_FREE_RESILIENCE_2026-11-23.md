# Supabase Free resilience — 2026-11-23

## Goal
Reduce the chance that the Laptops HUB Free project pauses during low-traffic periods, without paid upgrades.

## Truth
No free-tier scheduler can **guarantee** a project never pauses. Supabase may still pause if internal “user activity” criteria are not met. This system is best-effort + observable.

## Implementation
1. Table `system_keepalive` + RPC `touch_keepalive(source)` — minimal indexed write.
2. Endpoint `GET /api/cron/keepalive` — Bearer `CRON_SECRET`; calls `touch_keepalive`, falls back to a tiny `store_settings` read.
3. GitHub Action `.github/workflows/supabase-keepalive.yml` — schedule `17 1,7,13,19 * * *` UTC (4×/day) + `workflow_dispatch`.
4. Existing notification cron remains separate (Vercel Hobby daily + GitHub 15‑min).

## Security
- Same `CRON_SECRET` as notification cron.
- No service-role keys in client env.
- Minimal JSON response; no customer data.

## Recovery runbook
1. Supabase Dashboard → project `xvmmjkrkgznnakcobmww` → Resume if paused.
2. Verify `select last_ping_at, ping_count from system_keepalive`.
3. Hit storefront home + `/admin/login`.
4. Confirm catalog and settings load.

## Verification status
| Check | Status |
|-------|--------|
| Migration + RPC applied | PASS |
| Endpoint shipped | PASS (after deploy) |
| GitHub workflow file present | PASS |
| Scheduled execution observed | PARTIAL — requires `CRON_SECRET` repo secret + first scheduled/manual run |
| Guaranteed never-pause | NOT CLAIMED |

## Owner step if needed
Ensure GitHub repository secret `CRON_SECRET` matches Vercel Production (same as notification-retry workflow).
