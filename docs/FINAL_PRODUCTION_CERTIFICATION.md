# Final production certification — 2026-11-18

Honest operational certification for Laptops HUB after cloud hardening.

## Labels used

PASS · FAIL · BLOCKED · NOT TESTED · NOT APPLICABLE

## Release identity

| Item | Value | Verdict |
|---|---|---|
| GitHub `main` SHA | `afed09a808d4357aeff2d9375b40fb797e68546d` (app hardening `06b5ff3` + this certification) | PASS |
| Hardening PR | [#18](https://github.com/mudasarimamofficial/laptops-hub/pull/18) — CI + cron URL + certification docs | PASS |
| CI on main | Runs `44235107324` (`06b5ff3`) and `44236261618` (`afed09a`) — `quality` success | PASS |
| Vercel production | `dpl_E22FfdsVi8KcEJiwqLnmfBNNKVmz` READY @ `afed09a` | PASS |
| Production aliases | `www.laptopshub.pk`, `laptopshub.pk` → www (308) | PASS |
| Supabase migrations | 31 aligned (local = remote) | PASS |
| CRM `app.laptopshub.pk` | Untouched | PASS |

## Commerce readiness

| Gate | Verdict |
|---|---|
| Live COD (env triad + `store_settings.cod_checkout`) | PASS |
| Shipping All Over PK Rs 360 + COD Rs 50 | PASS (DB + quote API + checkout UI cash due Rs 147,410 on 3× Dell 5400) |
| Policies published | PASS (8 CMS pages HTTP 200) |
| Catalog purchasable (226 active) | PASS |
| Isolated COD / security matrix | PASS (23/23) |
| Unit tests | PASS |
| Controlled live QA order | BLOCKED — no owner-controlled test identity |
| Email notifications | BLOCKED — Resend / `STORE_*` absent |
| Cron auth secret on Vercel Production | PASS (401 without valid bearer) |
| GitHub 15‑min retry | Inactive until GH `CRON_SECRET` after Resend | PASS by design |

## Security

| Item | Verdict |
|---|---|
| Service role not public | PASS |
| Preview COD off + merchant mutations disabled | PASS |
| Main force-push / deletion blocked + required `quality` check | PASS |
| Leaked-password protection (Supabase Auth) | BLOCKED — dashboard toggle not enabled (avoid lockout without owner confirmation) |
| SECURITY DEFINER storefront RPCs | PASS (intentional least-privilege design) |
| Anon order RPC denied | PASS (isolated) |

## Client staff

| Item | Verdict |
|---|---|
| Staff invite / client account | BLOCKED — no authorized invite email provided |

## Rollback plan

1. Vercel → Deployments → Promote prior READY production (`dpl_2daEN1ms2GpUwnjJXsjPSfybVGF4` @ `3a00091`).
2. Revert GitHub merge on `main` if needed (admin bypass on ruleset).
3. Database: RLS initplan migration is behavior-preserving; reverse by restoring prior policy expressions from migration history if required.
4. Env: remove or restore Vercel vars by key; never paste secrets into chat.
5. CRM: no action (independent Hostinger).

## Remaining external dependencies

1. Resend account + verified sender → set `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` on Production → redeploy → set matching GitHub `CRON_SECRET` → enable notification-retry schedule.
2. Owner-controlled QA COD identity for one labeled live order + cancel.
3. Optional: enable Supabase leaked-password protection.
4. Licensed reel media before publishing reels.
5. Authenticated staff session for full production admin deep E2E.

## Overall certification

**Commerce storefront + COD quoting: PASS for day-to-day browsing and checkout readiness.**  
**Cloud config (GitHub ruleset + CI + Vercel env/domains + Supabase ledger + cron auth gate): PASS.**  
**Full ops loop (email + live QA order + authenticated admin deep E2E + client staff): BLOCKED on external inputs listed above.**  

**Do not treat BLOCKED or NOT TESTED items as PASS.**
