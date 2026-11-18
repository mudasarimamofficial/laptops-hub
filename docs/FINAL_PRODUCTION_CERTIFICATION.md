# Final production certification — 2026-11-18

Honest operational certification for Laptops HUB after Resend email ops + cloud hardening.

## Labels used

PASS · FAIL · BLOCKED · NOT TESTED · NOT APPLICABLE

## Release identity

| Item | Value | Verdict |
|---|---|---|
| GitHub `main` SHA | `c0125853dcc4937d7993a35cc3f93584250200e5` (docs cert #19; email runtime redeploy `dpl_46n9waS5…`) | PASS |
| App hardening baseline | `06b5ff3` via PR [#18](https://github.com/mudasarimamofficial/laptops-hub/pull/18) | PASS |
| CI | `quality` success on main | PASS |
| Vercel production | `dpl_46n9waS5kkd5q7QQsP5s8yiQisJV` READY (redeploy after email env) | PASS |
| Prior READY (rollback) | `dpl_2YPmGgv6zJn2y2Wz2YDNagyr74VT` / earlier `dpl_6iekg2…` | PASS |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk` → www | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` ACTIVE_HEALTHY; **31** migrations | PASS |
| CRM `app.laptopshub.pk` | Untouched (A → 45.130.228.253) | PASS |

## Resend / email ops

| Gate | Verdict |
|---|---|
| Resend CLI | PASS — v2.28.2; OAuth via Windows Credential Manager (`resend doctor` ok) |
| Sending domain | PASS — `send.laptopshub.pk` **verified** (DKIM/MX/SPF/CNAME on Vercel DNS) |
| Production sending key | PASS — `sending_access` scoped to domain (name `laptops-hub-production-sending`; value never logged) |
| Vercel Production env | PASS — `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `CRON_SECRET` present (Secret/Production) |
| `STORE_FROM_EMAIL` | PASS — `Laptops HUB <orders@send.laptopshub.pk>` |
| `STORE_NOTIFY_EMAIL` | PASS — owner operational inbox (merchant-owned; value not published) |
| `NOTIFY_CUSTOMER_EMAIL` | NOT TESTED / not enabled — templates validated via provider; flag left unset until owner enables |
| Provider delivery | PASS — Resend `last_event=delivered` for controlled QA sends |
| Idempotency | PASS — replay of same Idempotency-Key returned same message id |
| App staff invitation transport | PASS — Admin → Invite editor; UI “Invitation sent”; Resend `delivered` |
| Merchant/customer template content | PASS — provider sends mirroring `templates.ts` (outbox path idle: **0** production orders) |
| Outbox processing of a real order | NOT TESTED — no production orders; cron `configured=true` with empty queue |
| Inbox observation by human | NOT TESTED — provider `delivered`; owner inbox not opened in this session |
| Password-setup / login after invite | NOT TESTED — invite link not exercised from inbox |
| Supabase Auth SMTP | NOT APPLICABLE for staff invite — app uses Resend via `sendAccessLink` |

## Cron / GitHub

| Gate | Verdict |
|---|---|
| Unauthorized cron | PASS — HTTP 401 |
| Authorized cron | PASS — HTTP 200 `{configured:true, processed:0,…}` |
| GH Actions `CRON_SECRET` | PASS — set; matched via coordinated rotation with Vercel |
| `notification-retry` workflow | PASS — run `44240955449` success; `configured=true`; endpoint `https://www.laptopshub.pk/api/cron/notifications` |
| Resend key in GitHub | NOT APPLICABLE — not required by workflow |

## Commerce readiness

| Gate | Verdict |
|---|---|
| Live COD (env + store_settings + admin readiness) | PASS — Ordering open |
| Shipping All Over PK Rs 360 + COD Rs 50 | PASS |
| Isolated COD matrix / unit tests | PASS (prior session) |
| Authenticated merchant smoke | PASS |
| Controlled live QA order | BLOCKED — no owner-controlled QA identity in project records |
| Admin Orders email banner | PASS — “not configured” cleared after redeploy |

## Security

| Item | Verdict |
|---|---|
| Sending key server-only / Production scope | PASS |
| Protect main + required `quality` | PASS |
| Leaked-password protection | BLOCKED — not enabled |
| Preview COD / merchant mutations isolated | PASS |

## Client staff

| Item | Verdict |
|---|---|
| Active owner account | PASS |
| Controlled QA invite + deactivate | PASS (role editor; deactivated after delivery proof) |
| Client business invite (non-QA mailbox) | BLOCKED — no separate client email in authorized records |

## Rollback

1. Promote prior READY production (e.g. `dpl_2YPmGgv6…` or `dpl_6iekg2…`).
2. Revert `main` with admin bypass if needed.
3. Env restore by key name; never paste secrets into chat.
4. Domain DNS: remove only `resend._domainkey.send` / `send.send` / `rsend.send` if abandoning Resend — do not touch `app` / `www.app`.
5. CRM: no action.

## Remaining external dependencies

1. Owner-controlled QA COD identity for one labeled live order + cancel.
2. Optional enable `NOTIFY_CUSTOMER_EMAIL=1` after owner approval.
3. Optional leaked-password protection.
4. Licensed reel media.
5. Human confirmation that QA emails appear in the owner Gmail inbox (provider already reports `delivered`).

## Overall

**Email infrastructure + staff invite transport + cron: PASS.**  
**Live QA COD order + customer outbox on a real order + invite password setup: BLOCKED / NOT TESTED.**  
Do not treat BLOCKED / NOT TESTED as PASS.
