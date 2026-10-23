# Final launch sequence (owner-approved steps only)

Prepared 2026-10-23 for release candidate `fix/v5-correctness-parity`. Every step marked **[approve]** is a separate
owner approval; engineering performs nothing in production without it. The store is **not launched** until § 7
passes and the owner confirms it.

Kill switches available at every step: `store_settings.cod_checkout.enabled = false` (immediate, no deploy) ·
`COD_CHECKOUT_ENABLED=false` + redeploy · `SITE_PRELAUNCH=restricted` + redeploy · Vercel Instant Rollback.

## 0. Before anything (owner, no engineering risk)

Answer `docs/FINAL_LAUNCH_OWNER_INPUTS.md`: owner account, zones and fees, email account, policy facts, media
rights, workflow approval. Optional now, recommended: **[approve] Mode B** (`SITE_PRELAUNCH=restricted`) to hide the
storefront until launch (`docs/PUBLIC_SITE_PLAN.md`).

## 1. Database: outbox lease migration — ✅ APPLIED 2026-10-23 (owner-approved)

`docs/MIGRATION_PRODUCTION_APPROVAL.md` § Outbox lease. Must be applied **before** step 2 (the new code calls
`claim_notifications`). Safe for the code running today (`34f9839` has no notification code).

## 2. Deploy the verified code to Production — ✅ DONE 2026-10-23 (owner-approved)

Approved: "merge PR #1 then PR #2 into main with merge commits, verify main equals the tested tree, let Vercel deploy
Production, and run the read-only post-deploy checks … Keep COD off … do not enable email or COD."

| Step | Result |
|---|---|
| Merge | PR #1 → `c9e0a21`, PR #2 (retargeted to `main`) → `5139ff0`, both merge commits; `--match-head-commit` used |
| Tree | `main` tree `c0cf700` = tested `19089ed` (no diff); no code change after `0bfc552` |
| Production | `laptops-hub.vercel.app` → `dpl_FJ4mDoFeqTsMsURpVkhddnNqtXwB` (`5139ff0`) |
| Intermediate build | merging #1 first made Vercel build `c9e0a21` (old `ea652f2` code); cancel was too late, it served ~57 s (`/pages/*` 500, known jsdom crash; COD stayed 403) until `5139ff0` replaced it. Lesson: next time retarget #2 and merge only the final head, or pause auto-deploy |
| HTTP | `/`, collection, PDP, `/pages/shipping`, search, track-order, checkout page 200 · `/admin` 307 · COD POST 403 · cron 503 (no `CRON_SECRET`) · staff retry 401 without session |
| SEO host | robots + sitemap now use `https://laptops-hub.vercel.app` (was wrong before); 267 sitemap URLs all 200; home `index, follow` |
| Suites (read-only) | e2e 39 passed / 1 skipped · P0 9/9 · auth matrix 24/24 · pagination 5/5 |
| Runtime errors | none from `dpl_FJ4mDo…`; the only errors are from the intermediate deployment, before the switch |
| Unchanged | no env change, COD off, email not configured, `SITE_PRELAUNCH` unset (site public, as before) |

Rollback: Instant Rollback to `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH` (not to `dpl_GsZMH3…`).

## 2 (procedure, for reference)

1. Merge PR #1 (`feat/v5-storefront-admin` → `main`), then retarget PR #2 to `main` and merge it, both with
   **merge commits** (no squash/rebase, so the deployed tree is the tested one). `main` is an ancestor of both, so
   there are no conflicts.
2. Check: `git diff <verified RC commit> origin/main` is empty.
3. Vercel builds Production from `main`. Keep `SITE_PRELAUNCH` as decided, COD variables `false`,
   `V5_CUTOUT_BASE`/`V5_CONTENT_PREVIEW` unset. Set `CRON_SECRET`.
4. Read-only checks: the commit SHA of the deployment equals `main` · `/`, a product, a collection 200 (or coming-soon
   in Mode B) · `/api/checkout/cod` POST → 403 · `/admin` → login · `robots.txt`/sitemap host = the production
   domain · Vercel runtime errors: none.
5. Rollback: Instant Rollback to the previous deployment (`dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH`) works with the
   migrated database. That build has no order notifications at all, so after a rollback staff must watch
   **Orders to confirm** in admin; prefer rolling forward once email is live.

## 2b. Notification retry schedule (PR #3) — ✅ MERGED 2026-10-24 (owner-approved)

`main` `700524d` → Production `dpl_7W2x8QxLKqvcG1iw5WophtRJjhiP` (single build). Read-only checks: `/`, collection,
PDP, `/pages/shipping`, `/admin/login` 200 · `/admin` 307 · COD POST 403 · cron 503 `cron_disabled` (no secret; also
with a wrong bearer) · no runtime errors. GitHub workflow `notification-retry` registered (active); repository secret
`CRON_SECRET` absent, so runs skip. Schedule becomes effective only after § 4 (email + secret) and one green run.
No environment, COD, secret or account change.

## 3. Business configuration and staff access (owner, in admin)

Follow `docs/FINAL_LAUNCH_OWNER_INPUTS.md` § "Owner setup — do these in order". Engineering verifies each item
read-only and records it in the sign-off (§ 9).

## 4. Email provider **[approve env change]**

Owner creates the Resend account and verifies the domain (inputs § C). With the owner's approval engineering sets, for
**Production only**: `RESEND_API_KEY` (Sensitive), `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `NOTIFY_CUSTOMER_EMAIL`
(if approved), `CRON_SECRET` (Sensitive), then redeploys. Checks: `/api/cron/notifications` → 401 without the secret,
200 `{"configured":true,…}` with it (0 rows → nothing sent). The real send is verified by Scenario A.
Keys are never written to the repository, logs or chat.

## 5. Acceptance tests — public checkout stays closed throughout

Two separate scenarios, because the order rules do not allow cancelling an order once it is `shipped`
(allowed: `placed → pending_confirmation | confirmed | cancelled`, `confirmed → packing | cancelled`,
`packing → shipped | cancelled`, `shipped → out_for_delivery | delivery_failed`, `out_for_delivery → delivered |
delivery_failed`, `delivered → returned`, `delivery_failed → shipped | cancelled | returned`).

### Scenario B — Fulfillment, on the isolated stack (no production records)

Local Supabase + fake email provider (`docs/ISOLATED_TESTS.md`, launch journeys). Covers confirm → packing → shipped
with carrier and tracking → customer page shows them; **shipped cannot be cancelled** (option hidden, server
refuses); delivery failed → re-attempt → out for delivery → delivered → returned; delivery failed → returned to
store; cancellation before dispatch; COD cash collection exactly once; provider outage and staff retry; cron secret.
No shipping, delivery, return or cash is ever recorded on a real order for testing.

### Scenario A — Cancellation, one owner-authorized order on production data **[approve]**

Runs on a **protected Preview** (Vercel login; no share link is created for it) because Production keeps
`COD_CHECKOUT_ENABLED=false` and refuses every order (403).

**Shared-database side effects — what the approval covers.** The Preview uses the production database. Therefore:

| Effect | Detail | Reversible? |
|---|---|---|
| Global checkout setting | `store_settings.cod_checkout.enabled` must be **on** during the test. Production stays closed because its environment switch is off (checked before the database); other Previews refuse because the Preview-wide switch is off | yes — switched off right after |
| Real records | 1 order with the owner's own name, phone, address and email; its items, address, events, audit entries; 1 notification row | **no** — kept as a cancelled order (no hard delete); it appears in order lists and counts |
| Order number | one production order number is used | no |
| Email | a real store alert to `STORE_NOTIFY_EMAIL`, and a customer email to the owner's address if enabled | no (it is sent) |
| Rate limits | one checkout counted for the owner's IP | expires by itself |
| Stock | none (stock is not tracked) | — |
| Cash / shipping | none recorded | — |

Steps:
1. Branch `preview/launch-test` from `main`; Preview variables **scoped to that branch only**:
   `COD_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true` and the email variables from § 4.
2. Engineering turns the database setting on (one approved SQL update: `update public.store_settings set value =
   jsonb_set(value, '{enabled}', 'true') where key = 'cod_checkout'`; there is no admin switch for it); immediately
   check Production `POST /api/checkout/cod` → 403.
3. Owner places one order on the Preview: a real product, a real zone, own details.
4. Verify: confirmation page and totals (item + zone delivery fee + COD fee); Admin → Orders shows *placed*; overview
   **Orders to confirm** = 1; store alert in the inbox (and customer email if enabled); order page shows
   **Store alert: accepted**; Track order with number + phone works, a wrong phone is refused.
5. **Cancel** it while it is still *placed* (note: "launch acceptance test"); the customer page shows *Cancelled*.
6. Engineering turns the database setting **off** (same update with `false`); Production still 403. Delete the branch-scoped variables and the branch.

## 6. Go-live sign-off (before any checkout switch)

| Gate | Evidence required | Status |
|---|---|---|
| Owner account; staff least-privilege; test manager deactivated | membership list (read-only) | ☐ |
| Shipping zones = owner's coverage, fees, courier notes | Admin → Settings readiness panel; quote for a real city | ☐ |
| Contact facts published (phone, WhatsApp, email, hours) | contact page | ☐ |
| Policies published + legal approval (shipping, returns, warranty, privacy, terms) | Admin → Content | ☐ |
| Prices confirmed; image rights stated (or products drafted) | owner statement; `product_media.approval` | ☐ |
| Availability-confirmation workflow approved (inputs 4.1) | owner statement | ☐ |
| Email: domain verified, Production vars set, cron 401/200 | § 4 checks | ☐ |
| Scenario B passed on the current `main` | journeys result | ☐ |
| Scenario A passed and the order cancelled; setting off again | order page, inbox | ☐ |
| Monitoring owner named; retry schedule active (`docs/NOTIFICATIONS.md`) | owner statement; workflow run | ☐ |
| Rollback ready: last good deployment id; kill switches known | this document | ☐ |

## 7. Public launch **[approve]**

1. Production: `COD_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true`; database setting on; remove
   `SITE_PRELAUNCH` if it was set; redeploy (the public variable is read at build time).
2. Verify: checkout page open; quote for a served city = zone fees; unserved city refused; invalid phone refused;
   admin still requires sign-in; P0 9/9; auth matrix 24/24.
3. The first real customer order: alert received, order visible under **Orders to confirm**, customer page works.
4. SEO: robots allows crawling, home `index, follow`, sitemap on the production domain (already true today unless
   restricted mode is turned on in the meantime). Optional: submit the sitemap in Google Search Console.
5. First day: someone watches the store inbox and **Orders to confirm** at least every 2 hours; Vercel runtime errors
   checked at the end of the day.

The store is **launched** only after step 7 passes and the owner confirms. While COD is off it is not launched.

## 8. Kill switches and rollback

- Stop orders immediately (no deploy): `store_settings.cod_checkout.enabled = false`.
- Stop orders at the edge: `COD_CHECKOUT_ENABLED=false` + redeploy.
- Hide the storefront: `SITE_PRELAUNCH=restricted` + redeploy.
- Web regression: Vercel → Deployments → Instant Rollback to the previous good Production deployment (today
  `dpl_FJ4mDoFeqTsMsURpVkhddnNqtXwB` is current; `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH` has no notifications).
