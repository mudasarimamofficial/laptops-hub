# Client handover — release 2026-11-16, theme editor update 2026-11-17

Release classification: see the end of `FINAL_E2E_REPORT.md`. Deployed to production 2026-11-16 (`772276b`), with an
accessibility fix on 2026-11-17 (`7e406df`, `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ`). Database at 29/29 migrations.
Post-deploy acceptance: `POST_DEPLOY_ACCEPTANCE.md`.

**Theme editor update** (full homepage preview, real section ordering, a cache fix for published themes):
- Built and tested on the feature branch, on the isolated stack (`POST_DEPLOY_ACCEPTANCE.md` §7).
- **Not deployed.** It needs no database change. It changes nothing for customers until published themes are switched on.

## Decisions waiting for the owner (approval gates)

| # | Decision | What happens | Reversible |
|---|---|---|---|
| A | Release the theme editor update to production (merge the PR to `main`) | The admin gets the full preview and ordering. The homepage stays identical (HTML verified), because `THEME_PUBLISHED_ENABLED` stays unset | Yes: Vercel instant rollback to `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ` |
| B | Switch published themes on: set `THEME_PUBLISHED_ENABLED=1` in Vercel Production and redeploy | Nothing changes until a version is published (no publication exists today). After that, the homepage shows the published version | Yes: remove the variable and redeploy, or restore an earlier version in the editor |
| C | First publish from the editor | Customers see that layout within about a minute. Publish only after reviewing it in the full preview | Yes: "Restore this version" in Published history |

Each is a separate approval. Approving A does not approve B or C.

## Merchant checklist: inputs only the owner can provide

These were deliberately **not** done by the agent. Each needs a decision, an account, or facts only the business has.

| # | Item | Why it is needed | Status |
|---|---|---|---|
| 1 | Sign out and back in once on production | Confirms logout. The agent did not do it, because it would end your session | Owner |
| 2 | Approve deleting the leftover test account `cod-sandbox-…@lh-test.local` | Deactivated, never used. Deletion is irreversible | Owner |
| 3 | Decide on Supabase leaked-password protection (Auth → Passwords) | Advisor warning; plan-dependent setting | Owner |
| 4 | Genuine customer reviews with consent (and avatar permission, if photos are used) | The homepage reviews section stays hidden until at least one is published. No invented reviews and no copied 4.9/157 rating | Owner |
| 5 | Confirm the Google Maps listing and embed for the shop | The map shows the supplied embed | Owner |
| 6 | Email provider account (code supports Resend), **its** DNS values, and the Vercel variables `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `CRON_SECRET` (`NOTIFY_CUSTOMER_EMAIL=1` only if customer emails are approved) | Order notifications and staff invitations are not sent today. DNS values are never guessed | Owner |
| 7 | Inbound mail for `@laptopshub.pk`: the mailbox provider's MX values | No MX record exists | Owner |
| 8 | Legal policies (shipping, returns, warranty, privacy, terms), approved for publication | Required before COD. The agent does not write or approve legal text | Owner |
| 9 | Real stock levels (or a decision to keep stock untracked) | All purchasable variants are untracked. The agent does not invent quantities | Owner |
| 10 | Courier charges per zone and the COD fee | One zone "All Over PK" exists; its fee is not a confirmed tariff. Not changed by the agent | Owner |
| 11 | Who confirms, packs and ships orders, and the response time | Required before COD | Owner |
| 12 | After 6–11: approval to switch on public COD and run one controlled real order | Public COD stays disabled. No real order has been created | Owner |
| 13 | Hosted staging (optional): a second Supabase project, possibly paid | Only the isolated local stack exists | Owner decision |

## Business dependencies (separate from the software)

The software is deployed and tested. Live commerce is **not certified**. It depends on items 6–12 above:
- policies;
- fees;
- stock;
- order handling;
- email;
- one controlled order.

## Not changed by the agent

- DNS and nameservers; `app.laptopshub.pk` (CRM on Hostinger) untouched.
- COD flags; `THEME_PUBLISHED_ENABLED`; production env variables; staff accounts; published content.
- No theme was published. No review was published. No order was created.

## Where to look

- Using the admin: `MERCHANT_ADMIN_HANDBOOK.md`.
- Theme editor: Online store → Customize.
  - Use the arrows to move sections and "Show on the homepage" to hide one.
  - "Open full preview" shows the whole page (Draft / Published / V5 default).
- Release steps and rollback: `PRODUCTION_RELEASE_RUNBOOK.md`, `MIGRATION_VERIFICATION.md`.
- Acceptance: `CLIENT_ACCEPTANCE_CHECKLIST.md`, `FINAL_REQUIREMENTS_MATRIX.md`, `POST_DEPLOY_ACCEPTANCE.md`.
- Tests: `FINAL_E2E_REPORT.md`, `docs/evidence/final-run/summary.json`.
- Security: `FINAL_SECURITY_REPORT.md`. Performance: `ADMIN_PERFORMANCE_REPORT.md`.
