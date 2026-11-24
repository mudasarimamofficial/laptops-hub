# 11 — Ownership transfer plan: GitHub, Vercel, Supabase, domain (prepared, NOT executed)

Nothing here has been done. Every step needs the owner's written go-ahead and the client's target account details.
Use each provider's official transfer flow — never ask the client for passwords.

## 0. Before any transfer (all providers)
- [ ] Client's target accounts exist: GitHub user/org, Vercel team, Supabase org — each with 2FA and a client-owned
      recovery email.
- [ ] Plan decided for the client's Vercel team (see `09_FREE_TIER_COST_RISK.md`: Hobby is non-commercial).
- [ ] Fresh logical backup taken and verified (`10_BACKUP_RESTORE_RUNBOOK.md`).
- [ ] Client owner can sign in to `/admin` as **owner** (`infolaptopshub@gmail.com`, role owner, active).
- [ ] Agreed order: GitHub → Vercel (reconnect Git) → Supabase → update env vars → verify → remove developer access.
- [ ] Freeze: no merges or migrations during the transfer window.

## 1. GitHub `mudasarimamofficial/laptops-hub`
Current: public, default branch `main`, **no branch protection**, Dependabot alerts disabled, Actions secrets
`CRON_SECRET`, `NOTIFY_CRON_URL` (names only), workflows `ci.yml`, `supabase-keepalive.yml`, `notification-retry.yml`.
1. Settings → General → Transfer ownership → client user/org. GitHub redirects the old URL.
2. Re-create the two Actions secrets in the new location if they do not carry over; confirm the scheduled workflows run
   (Actions tab → keepalive, notification-retry).
3. Recommended after transfer: protect `main` (require PR + passing `ci`), enable Dependabot alerts, decide whether the
   repository should become private (then CI uses the account's free minutes).
4. Vercel's Git connection must be re-authorised for the new owner (step 2.3).

## 2. Vercel project `laptops-hub`
Current: Hobby team `team_l7hth478q4bLcmoKR21X7uqm`; production branch `main`; region `sin1` functions; domains
`www.laptopshub.pk` (primary), `laptopshub.pk` (308 → www); cron `/api/cron/notifications` daily 06:00 UTC;
Production env names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`COD_CHECKOUT_ENABLED`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED`, `SITE_URL`, `RESEND_API_KEY`, `STORE_FROM_EMAIL`,
`STORE_NOTIFY_EMAIL`, `CRON_SECRET`.
1. Project Settings → General → Transfer Project → client team (on a plan the client approved).
2. Confirm env vars, cron and domains arrived; Vercel moves project domains with the project, but verify
   `laptopshub.pk` / `www` show "Valid configuration" afterwards.
3. Reconnect Git (Settings → Git) to the transferred GitHub repository; push a no-op commit to confirm a deploy.
4. **Do not touch `app.laptopshub.pk`** — it is the Hostinger CRM (`45.130.228.253`). If DNS for `laptopshub.pk` is
   hosted at Vercel, the `app` record must survive the move; check it resolves and returns 200 before and after.

## 3. Supabase project `xvmmjkrkgznnakcobmww`
1. Client creates (or chooses) an organization and the plan; the project is transferred via Project Settings →
   General → Transfer project (requires owner role in both orgs; check Supabase's current eligibility rules for
   free-plan orgs and project limits).
2. The project URL and API keys normally stay the same after an org transfer, so Vercel env vars should not need to
   change — verify by loading the site and signing in to `/admin` immediately after.
3. Re-check: Auth → SMTP (Resend) settings, Auth URL configuration (site URL / redirect allow-list), Storage buckets,
   the keepalive job, and the GitHub/Vercel integrations (re-authorise if they were tied to the developer).
4. Organization-scoped access tokens (developer CLI) stop working — expected.

## 4. Domain and DNS
- Registrar (originally Websoul) account and renewal must be in the client's name; this audit did not inspect it.
- Confirm where the DNS zone lives (Vercel nameservers vs registrar) before any change; record every existing record
  (including `app` for the CRM, mail/MX and any Resend DKIM/SPF records) first.

## 5. Secrets and access after transfer
- Rotate in coordination (not before): Supabase service-role key (then update Vercel), `CRON_SECRET` (Vercel + GitHub),
  Resend API key (Vercel). Rotate one at a time and smoke-test after each.
- Remove developer access only after the client has confirmed owner access + recovery on every provider.
- Alerts (Vercel deploy failures, Supabase usage emails, GitHub Actions failures) must go to a client-owned email.
