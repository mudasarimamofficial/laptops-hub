# Client handover — release 2026-11-16, security patch and theme editor release 2026-11-17

Release classification: see the end of `FINAL_E2E_REPORT.md`. Deployed to production 2026-11-16 (`772276b`), with an
accessibility fix on 2026-11-17 (`7e406df`, `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ`). Database at 29/29 migrations.
Post-deploy acceptance: `POST_DEPLOY_ACCEPTANCE.md`.

## Security-patch release, 2026-11-17 (deployed)

### What was released

| Item | Value |
|---|---|
| PR | mudasarimamofficial/laptops-hub#12, merged to `main` as **`7abb680`** |
| Production deployment | **`dpl_2gJc3wmKpE5hxJrQywnCrLRBrcay`** (READY, region `sin1`, aliases www.laptopshub.pk and laptopshub.pk) |
| Next.js | **16.4.5** (Vercel build log). `eslint-config-next` 16.4.5. Lockfile committed. |
| Rollback target | `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ` (`7e406df`), via Vercel instant rollback |
| Database | 29/29 migrations, none pending, none applied by this release |
| Unchanged | `THEME_PUBLISHED_ENABLED` unset everywhere (the homepage is still the built-in V5 default); public COD setting; Hostinger CRM at `app.laptopshub.pk` (200, Hostinger IP); owner session |

### Checks before release

| Check | Result |
|---|---|
| Audit | Production dependencies: **0**. Dev-only: **7 moderate, not resolved** (`minimatch` via typescript-eslint, lint tooling only). See `SECURITY_PATCH_NEXT_16_4_5.md`. |
| Release suite (`docs/evidence/final-run/summary.json`) | Verdict **PASS**, 0 failed stages. Isolated E2E 114, legacy 27, cross-browser 115. Security matrices, COD, inventory, theme publish/rollback, tsc, lint (0 errors), build rc 0. |
| Test isolation | Crash-safe baselines added. A SIGKILL in the middle of a run was recovered to the exact baseline. See `TEST_ISOLATION.md`. |
| Preview `dpl_8vsnW2ev…` | Next 16.4.5. Anonymous `/preview/homepage` returns 404 with `noindex, nofollow` and `private, no-store`. |
| Visual comparison, production vs Preview (`docs/evidence/visual-regression/`) | Desktop, desktop with reduced motion, and phone with reduced motion: **0 px** difference. Phone: 23 px (0.0003%), all inside the hero photo (resampling). Section order, CLS 0, no overflow, map sticky/plain and after the footer, and map focus all identical. |

### Live QA after deploy (read-only; no orders, settings or testimonials created)

**Storefront**
- Homepage: no console errors, no overflow at desktop or 375 px, map present. Reviews hidden because no testimonials are published (correct).
- Product page, `/collections/dell` (24 products), search (24 results), cart, empty checkout, track-order and compare all respond 200.
- `/products` and `/guides` index pages return 404, the same as the previous deployment (no index pages exist). Not a regression.

**Admin** (owner session)
- The theme editor loads 13 sections in V5 order and shows the "published themes are off" explanation.
- The embedded draft preview renders the full homepage with the map.
- Every admin route prefetch returns 200. Warm responses take about 0.4–0.8 s.

**Defect found** (it predates this release): at 1024–1279 px windows the theme editor's settings panel overflowed the window by 117 px.
- Fixed in mudasarimamofficial/laptops-hub#13, with a regression test at 1024, 1280 and 1440 px.
- Admin only. **Production needs owner approval for the #13 deploy.**

**Not verified live:** checkout payment options with an item in the cart. The browser pane could not take input. The COD flags were not changed and checkout code was not touched by this release.

This is **not** live-commerce certification. COD go-live, stock accuracy, reviews, legal text and email delivery remain merchant requirements (below).

## Decisions waiting for the owner (approval gates)

| # | Decision | What happens | Reversible |
|---|---|---|---|
| A | ~~Release the theme editor update~~ **Done 2026-11-17** (`7abb680`, `dpl_2gJc3wmK…`) | The admin has the full preview and ordering. The homepage is unchanged (`THEME_PUBLISHED_ENABLED` unset) | Yes: Vercel instant rollback to `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ` |
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
