# Client handover — release 2026-11-16

Release classification: see the end of `FINAL_E2E_REPORT.md`. Deployed to production 2026-11-16 (`772276b`); database at 29/29 migrations.

## What the owner must approve or provide

| # | Item | Why it is needed | Who |
|---|---|---|---|
| 1 | ~~Migrations 15–29~~ — done 2026-11-16 | — | — |
| 2 | ~~Merge PR #10~~ — done 2026-11-16 | — | — |
| 2a | Sign in to the admin and open each section once; report anything slow or broken | Authenticated admin was not exercised live by the agent | Owner |
| 3 | Genuine customer reviews with consent (and avatar permission, if photos are used) | The homepage reviews section stays hidden until reviews are published | Owner |
| 4 | Confirm the Google Maps listing and embed for the shop | The map shows the supplied embed | Owner |
| 5 | Email: choose a provider (code supports Resend), create the account, publish **its** DNS values in Vercel, and set `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` (alert inbox), `NOTIFY_CUSTOMER_EMAIL=1` only if customer emails are approved, and `CRON_SECRET` | Order notification emails are not sent in production today | Owner |
| 6 | Inbound mail for `@laptopshub.pk`: mailbox provider MX values | No MX record exists | Owner |
| 7 | Before COD: published legal policies, real shipping fees per zone, real stock levels, who handles orders, and approval for one controlled test order | COD stays disabled until all are confirmed | Owner |
| 8 | Hosted staging (optional): a second Supabase project, possibly paid | Only the isolated local stack exists | Owner decision |

## Not changed by this release

- DNS and nameservers; `app.laptopshub.pk` (CRM on Hostinger) untouched.
- COD flags; production env variables; staff accounts; published content.

## Where to look

- Using the admin: `MERCHANT_ADMIN_HANDBOOK.md`
- Release steps and rollback: `PRODUCTION_RELEASE_RUNBOOK.md`, `MIGRATION_VERIFICATION.md`
- Acceptance: `CLIENT_ACCEPTANCE_CHECKLIST.md`, `FINAL_REQUIREMENTS_MATRIX.md`
- Tests: `FINAL_E2E_REPORT.md`, `docs/evidence/final-run/summary.json`
- Security: `FINAL_SECURITY_REPORT.md`; performance: `ADMIN_PERFORMANCE_REPORT.md`
