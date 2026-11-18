# Final production certification — 2026-11-18

Honest operational certification for Laptops HUB after cloud hardening.

## Labels used

PASS · FAIL · BLOCKED · NOT TESTED · NOT APPLICABLE

## Release identity

| Item | Value | Verdict |
|---|---|---|
| GitHub `main` baseline before hardening PR | `3a00091b983996347b728e20a46e7686d45f3b52` | PASS |
| Hardening PR | [#18](https://github.com/mudasarimamofficial/laptops-hub/pull/18) — CI + cron URL | PASS (CI `quality`) |
| Follow-up commit | RLS initplan migration + these certification docs | (merged with #18 or successor) |
| Vercel production (pre-redeploy for env bind) | `dpl_2daEN1ms2GpUwnjJXsjPSfybVGF4` | PASS |
| Production aliases | `www.laptopshub.pk`, `laptopshub.pk` → www | PASS |
| Supabase migrations | 31 after `rls_initplan_perf` | PASS |
| CRM `app.laptopshub.pk` | Untouched | PASS |

## Commerce readiness

| Gate | Verdict |
|---|---|
| Live COD (env triad + `store_settings.cod_checkout`) | PASS |
| Shipping All Over PK Rs 360 + COD Rs 50 | PASS (DB + quote API + checkout UI) |
| Policies published + legal-approved (shipping/returns/privacy/terms/warranty) | PASS |
| Catalog purchasable (226 active) | PASS |
| Controlled live QA order | BLOCKED — no owner-controlled test identity |
| Email notifications | BLOCKED — Resend / `STORE_*` absent |
| Cron auth secret on Vercel Production | PASS (config); runtime bind requires Production redeploy after env add |
| GitHub 15‑min retry | Inactive until GH `CRON_SECRET` after Resend | PASS by design |

## Security

| Item | Verdict |
|---|---|
| Service role not public | PASS |
| Preview COD off + merchant mutations disabled | PASS |
| Main force-push / deletion blocked (ruleset) | PASS |
| Leaked-password protection (Supabase Auth) | BLOCKED — requires dashboard enable; not flipped to avoid lockout without owner confirmation |
| SECURITY DEFINER storefront RPCs | PASS (intentional least-privilege design) |

## Client staff

| Item | Verdict |
|---|---|
| Staff invite / client account | BLOCKED — no authorized invite email provided |

## Rollback plan

1. Vercel → Deployments → Promote prior READY production (`dpl_2daEN1…` or earlier rollback candidate).
2. Revert GitHub merge commit on `main` if needed (admin bypass on ruleset).
3. Database: RLS initplan migration is behavior-preserving; reverse by restoring prior policy expressions from migration history if required.
4. Env: remove or restore Vercel vars by key; never paste secrets into chat.
5. CRM: no action (independent Hostinger).

## Remaining external dependencies

1. Resend account + verified sender → set `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` on Production → redeploy → set matching GitHub `CRON_SECRET` → enable schedule.
2. Owner-controlled QA COD identity for one labeled live order + cancel.
3. Optional: enable Supabase leaked-password protection.
4. Optional: require CI status check on `main` after CI stays green.
5. Licensed reel media before publishing reels.

## Overall certification

**Commerce storefront + COD quoting: PASS for day-to-day browsing and checkout readiness.**  
**Full ops loop (email + live QA order + authenticated admin deep E2E + client staff): BLOCKED on external inputs listed above.**  
**Do not treat BLOCKED items as PASS.**
