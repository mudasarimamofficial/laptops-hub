# Final launch sequence (owner-approved steps only)

Prepared 2026-10-23 for release candidate `fix/v5-correctness-parity`. Every step marked **[approve]** is a separate
owner approval; engineering performs nothing in production without it. The store is **not launched** until step 10
is done and the owner confirms it.

Kill switches available at every step: `store_settings.cod_checkout.enabled = false` (immediate, no deploy) ·
`COD_CHECKOUT_ENABLED=false` + redeploy · `SITE_PRELAUNCH=restricted` + redeploy · Vercel Instant Rollback.

## 0. Before anything (owner, no engineering risk)

Answer `docs/FINAL_LAUNCH_OWNER_INPUTS.md`: owner account, zones and fees, email account, policy facts, media
rights, workflow approval. Optional now, recommended: **[approve] Mode B** (`SITE_PRELAUNCH=restricted`) to hide the
storefront until launch (`docs/PUBLIC_SITE_PLAN.md`).

## 1. Database: outbox lease migration — ✅ APPLIED 2026-10-23 (owner-approved)

`docs/MIGRATION_PRODUCTION_APPROVAL.md` § Outbox lease. Must be applied **before** step 2 (the new code calls
`claim_notifications`). Safe for the code running today (`34f9839` has no notification code).

## 2. Deploy the verified code to Production **[approve]**

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

## 3. Business configuration and staff access (owner, in admin)

- Owner account (handbook § 1), staff accounts with the least role they need; check Admin overview → `role owner`.
- Shipping zones with the owner's coverage and fees (Admin → Settings). The readiness panel shows active zones.
- Policies: write approved copy, publish, legal approval (Admin → Content).
- Media decision recorded (`docs/MEDIA_INVENTORY.md`).

## 4. Email provider (owner + engineering) **[approve env change]**

Owner creates the Resend account and verifies the domain (`docs/FINAL_LAUNCH_OWNER_INPUTS.md` § 5). Engineering sets
`RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` (and `NOTIFY_CUSTOMER_EMAIL` if approved) for Production and
for the test Preview branch only, then redeploys. Verify with the controlled order (step 5) — no artificial
inquiries to the production inbox.

## 5. Controlled COD test order — public checkout stays closed **[approve]**

Production keeps `COD_CHECKOUT_ENABLED=false`, so its checkout API refuses every order (403) and the checkout page
stays closed. The test runs on a **protected Preview** (Vercel login required) that uses the same database:

1. Branch `preview/launch-test` from `main`; Preview variables **scoped to that branch only**:
   `COD_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true` (+ the email variables from step 4).
2. Turn `store_settings.cod_checkout.enabled` **on** (Admin → Settings, or one SQL update). Re-check that Production
   still returns 403 for a checkout POST.
3. On the Preview, the owner orders one real product with **their own** name, phone, address and email.
4. Verify:
   - **Order**: confirmation page, order number, items, delivery fee, COD fee and total match the zone; Admin →
     Orders shows it as *placed*; the overview counts it under **Orders to confirm**.
   - **Notifications**: the store inbox receives the alert; the customer email arrives if enabled; the order page
     shows `accepted` for each recipient.
   - **Tracking**: Track order with order number + phone shows the status; a wrong phone is refused.
   - **Fulfillment**: confirm → packing → shipped with carrier + tracking; the customer page shows them.
   - **Financial records**: order totals stored in the order; `cod_collections` only if cash is actually received —
     otherwise cancel the order (step 5.5) and rely on the collection tests (16/16 isolated). Never record cash that
     was not received.
5. Cancel the test order (note: "launch test"). Turn `store_settings.cod_checkout.enabled` **off** again until step 6.
6. Delete the test branch's Preview variables and the branch.

## 6. Enable COD **[approve]**

Production: `COD_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true`; `store_settings.cod_checkout`
on; redeploy (the public variable is read at build time). Check the checkout page opens and the quote matches a zone.

## 7. Remove restricted mode **[approve]**

Unset `SITE_PRELAUNCH`, redeploy.

## 8. Restore SEO

Follows from step 7: `robots.txt` allows crawling, pages lose `noindex`, the sitemap lists the production domain.
Optional: submit the sitemap in Google Search Console (owner account).

## 9. Smoke tests (read-only)

Customer: home, collection, product, search, cart, checkout page (no order), track order page. Admin: sign-in,
orders list, settings readiness panel. `PLAYWRIGHT_BASE_URL=<production> npx playwright test tests/e2e` (contact
submit is mocked). Vercel runtime errors: none.

## 10. Owner confirmation → launched

Only after steps 1–9 pass and the owner confirms. First day: someone watches the store inbox and **Orders to
confirm**; incident steps in `docs/RELEASE_PLAN.md` § Incident response.
