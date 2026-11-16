# Client handover — release 2026-11-16

Release classification: see the end of `FINAL_E2E_REPORT.md`. This release is **not yet in production**.

## What the owner must approve or provide

| # | Item | Why it is needed | Who |
|---|---|---|---|
| 1 | Approve applying migrations 15–29 to production (list, risk and rollback in `FINAL_PRODUCTION_AUDIT.md`) | The new code needs them | Owner |
| 2 | Approve merging the PR into `main` (deploys production) after item 1 | Ships the release | Owner |
| 3 | Genuine customer reviews with consent (and avatar permission, if photos are used) | The homepage reviews section stays hidden until reviews are published | Owner |
| 4 | Confirm the Google Maps listing and embed for the shop | The map shows the supplied embed | Owner |
| 5 | Email: choose a provider (code supports Resend), create the account, publish **its** DNS values in Vercel, and set `RESEND_API_KEY`, `STORE_EMAIL_FROM`, `CRON_SECRET` | Order notification emails are not sent in production today | Owner |
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
