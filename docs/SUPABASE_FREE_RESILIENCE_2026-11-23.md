# Supabase Free resilience — 2026-11-23 (updated gap closure)

## Goal
Reduce the chance that the Laptops HUB Free project pauses during low-traffic periods, without paid upgrades.

## Truth
No free-tier scheduler can **guarantee** a project never pauses. Supabase may still pause if internal “user activity” criteria are not met. This system is best-effort + observable.

## Architecture (independent layers)

| Layer | Trigger | Depends on repo commits? | Notes |
|-------|---------|--------------------------|-------|
| A. Vercel Cron `/api/cron/notifications` | Daily `0 6 * * *` (existing Hobby cron) | No | Now also calls `touch_keepalive` with source `vercel-notifications-cron` |
| B. GitHub Actions `supabase-keepalive` | Schedule `17 1,7,13,19 * * *` UTC + `workflow_dispatch` | **Risk:** public-repo schedules can disable after ~60 days inactivity | Supplemental only; fails hard if `CRON_SECRET` missing |
| C. External HTTP cron (optional) | Owner-configured (e.g. cron-job.org free) | No | **BLOCKED until owner creates account** — see below |

## Implementation
1. Table `system_keepalive` + RPC `touch_keepalive(source)` — minimal indexed write (genuine DB activity).
2. Endpoint `GET /api/cron/keepalive` — Bearer `CRON_SECRET`; RPC then tiny `store_settings` read; on total DB failure emails `STORE_NOTIFY_EMAIL` (≤1/day via Resend idempotency key).
3. Notifications cron embeds keepalive so Vercel Hobby’s single daily schedule still produces DB activity without a second cron job.
4. GitHub workflow **exits 1** when `CRON_SECRET` is unset (no silent success skip).

## Security
- Same `CRON_SECRET` as notification cron.
- No service-role keys in client env.
- Minimal JSON response; no customer data.

## Verification evidence
| Check | Status | Evidence |
|-------|--------|----------|
| Migration + RPC applied | PASS | `system_keepalive` row present |
| Manual / dispatch keepalive | PASS | GH run `45152922915` → HTTP 200 `touch_keepalive` ping_count≥2 |
| First **schedule**-triggered GH run | PARTIAL / PENDING | Must observe `event: schedule` in Actions (next windows 01:17 / 07:17 / 13:17 / 19:17 UTC) |
| Vercel notifications cron includes keepalive | PASS (code) | Deploy this release; verify response JSON `keepalive.ok` after next daily cron |
| Missing `CRON_SECRET` fails GH job | PASS (code) | Workflow exits 1 |
| Failure alert path | PASS (code) | Resend to `STORE_NOTIFY_EMAIL` when DB unreachable |
| External independent cron | BLOCKED | Owner must create cron-job.org (or similar) job hitting `/api/cron/keepalive` with Bearer secret |
| Guaranteed never-pause | NOT CLAIMED | — |

## Owner steps remaining
1. Confirm GitHub Actions → `supabase-keepalive` shows at least one run with **event `schedule`** (not only `workflow_dispatch`).
2. Optional independent monitor: create a free [cron-job.org](https://cron-job.org) (or UptimeRobot HTTP) job:
   - URL: `https://www.laptopshub.pk/api/cron/keepalive?source=cron-job-org`
   - Header: `Authorization: Bearer <same CRON_SECRET as Vercel>`
   - Frequency: 2–4×/day
   - Until configured, mark external monitor **BLOCKED**.

## Recovery runbook
1. Supabase Dashboard → project `xvmmjkrkgznnakcobmww` → Resume if paused.
2. Verify `select last_ping_at, last_source, ping_count from system_keepalive`.
3. Hit storefront home + `/admin/login`.
4. Confirm catalog and settings load.
5. Manually dispatch `supabase-keepalive` workflow if needed.
