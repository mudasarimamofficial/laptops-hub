# 34 — Operational decision packages A–G (2026-11-28)

**Status: prepared for owner decision. Nothing in this document has been purchased, transferred, rotated, migrated or
re-pointed.** Each package says what is true today, the options, rough cost, risk, the order to do it in, how to verify
it and how to undo it. Engineering carries out a package only after the owner approves that package in writing.

Prices are list prices found on 2026-11-28 from the providers' pricing pages and pricing summaries. Providers change
them; **re-check the provider's own pricing page on the day you decide.** "Verified" means checked read-only on this
date; anything else is marked.

Earlier detail this builds on: `09` (plans and limits), `11` (transfer steps), `23` (decision register D1–D19),
`25` (Shopify media), `28` (Git history), `30` (runbook and dependencies).

## Summary — what to decide, in order

| # | Package | Recommended option | Rough recurring cost | Blocks |
|---|---|---|---|---|
| A | Commercially compliant hosting | Vercel Pro on a client-owned team | about US$20/month + usage beyond the included credit | Certifying the store for revenue |
| B | Database backup and recovery | Stay on Supabase Free **plus** an encrypted scheduled export to client storage, or Supabase Pro | $0–$5/month (export) or about $25/month (Pro) | Recovering from data loss |
| C | Client-owned GitHub / Vercel / Supabase | Transfer in a freeze window, GitHub first | $0 for the transfer itself | Client independence |
| D | Shopify product-media custody | Phase 0 rights decision, then copy-and-switch in batches (doc 25 Option C) | $0 within Supabase Free storage; watch egress | Closing the old Shopify store |
| E | Email (Resend) ownership and alerts | Client-owned Resend account with `laptopshub.pk` verified | $0 (free tier) up to about $20/month | Reliable order and staff email after handover |
| F | Monitoring and incident response | Free external uptime monitor + Vercel deploy-failure email to the client | $0 | Learning about outages before customers do |
| G | Repository privacy and old personal data | Make the repository private, then transfer | $0 | Containing old test-order data in Git history |

Suggested order: **G → C (GitHub) → A + C (Vercel) → C (Supabase) → B → E → F → D.** G first, so the transfer moves a
private repository. A goes with the Vercel transfer, because the plan belongs to the team the project moves into.
B goes after the Supabase transfer, so backups are written by the client's account.

---

## A. Commercially compliant production hosting (D1, LH-014)

**Current state (verified 2026-11-24, doc 09):** Vercel team `mudasarimamofficial-gmailcoms-projects`, **Hobby** plan.
Hobby is for personal, non-commercial use under Vercel's terms. An online store taking orders is commercial use.

| Option | Cost (verify) | Pros | Cons / risk |
|---|---|---|---|
| **A1. Vercel Pro on a client-owned team (recommended)** | About **US$20/month**: platform fee with one deploying seat and US$20 of usage credit; more deploying seats about $20 each; viewer seats free. Usage above the credit is billed. | No code change; same deploy pipeline, cron, domains. Spend controls available. | A recurring cost. Usage-based billing needs a spend limit set on day one. |
| A2. Another host that permits commercial use (for example Netlify paid, Cloudflare, or a VPS) | Varies | Possibly cheaper at scale | Migration work, DNS change, new deployment path, re-testing everything. Not recommended now. |
| A3. Stay on Hobby | $0 | Nothing changes | Breaches the plan's terms; Vercel can restrict the project. Not acceptable for certification. |

**Implementation order (A1):**
1. The client creates a Vercel team on their own email, with 2FA, and upgrades it to Pro (owner pays).
2. Set a spend limit and usage alerts to a client mailbox.
3. Transfer the `laptops-hub` project into that team (doc `11` §2), during the C freeze window.

**Verification:**
- Team billing shows Pro.
- After the transfer, `www.laptopshub.pk` and `laptopshub.pk` show "Valid configuration".
- One docs-only PR deploys with the "Vercel" status success.
- The daily cron `/api/cron/notifications` runs the next morning.
- `app.laptopshub.pk` (Hostinger CRM) still resolves and answers as before.

**Rollback:** transfer the project back to the previous team. Domains and env vars move with the project. Downgrading Pro
takes effect at the end of the billing period.

---

## B. Database backup, encrypted storage, retention and tested recovery (D2)

**Current state:**
- Supabase project `xvmmjkrkgznnakcobmww`, believed Free (the CLI does not report the plan; **confirm in the
  dashboard**). Database about 15 MB (doc 09).
- Free includes **no** automatic backups. Keepalive runs daily (GitHub Actions + Vercel cron) to reduce pausing.
- The in-app CMS backup (Settings → Backups) saves theme, pages and settings only. It is **not** an orders/customers
  backup.
- The dump-and-restore procedure is proven on the **local** stack only (`scripts/rehearsal/backup-restore.sh`,
  2026-11-25: 35 tables, 1,685 rows, identical checksums). No production dump has been taken: it would put customer
  data on the engineering workstation.

| Option | Cost (verify) | What you get | Risk |
|---|---|---|---|
| **B1. Supabase Pro** | About **US$25/month** per organization (includes US$10 compute credit = one Micro instance) | Daily backups kept 7 days, restorable from the dashboard; no pausing | Recurring cost. Restores replace the whole database (any orders since the backup are lost unless re-entered). |
| B1+. Pro + Point-in-Time Recovery add-on | About **US$100/month** extra for 7 days (from Supabase examples; confirm in the dashboard; not covered by the spend cap) | Restore to any second | Expensive for a 15 MB database. Not recommended at today's volume. |
| **B2. Stay Free + scheduled encrypted logical export** | **$0–$5/month** (storage) | Daily `pg_dump` of `public` + `auth`, encrypted **before** it leaves the runner, uploaded to client-owned storage, kept 30 daily / 12 monthly | Needs a database connection secret in GitHub Actions (a credential decision). The project can still pause on Free. |
| B3. Both B1 and B2 | About $25–30/month | Provider backups plus an independent copy the client controls | Highest cost of the three. |

**Recommendation:** B1 if the owner accepts the cost, because it also removes the pause risk. Add B2 when order volume
grows or when an off-provider copy is required.

**B2 design (for approval, not built):**
- **Where it runs:** a GitHub Actions workflow on the client-owned, **private** repository (after G and C). It never
  runs on a public repository, and backups are never uploaded as workflow artifacts.
- **Secrets:** a read-only Postgres role created for backups (a production database change: needs approval), the
  storage credentials and an `age` public key. The private key stays offline with the owner.
- **Steps:**
  1. `pg_dump -Fc -n public -n auth`;
  2. `age -r <public key>`;
  3. upload to the client bucket under `laptops-hub/YYYY/MM/DD.dump.age`;
  4. keep 30 daily and 12 monthly copies (a bucket lifecycle rule);
  5. write a run summary (size and SHA-256, no data) to the workflow log.
- **Destination examples:** Backblaze B2, Cloudflare R2 (both have free or very low cost tiers at this size), or the
  owner's Google Drive. The client chooses and owns it.

**Recovery drill (quarterly, both options):**
1. Restore the latest backup into a **new, separate** Supabase project or a local scratch database, never over
   production.
2. Compare per-table row counts and checksums, using the same method as `scripts/rehearsal/backup-restore.sh`.
3. Sign in to `/admin` against the restored copy and open one order.
4. Record the date, backup age and result in the runbook (`30`).

**Verification:**
- B1: the dashboard shows daily backups.
- B2: seven consecutive green runs, then one restore drill passes.

**Rollback:** B1: downgrade the plan (backups stop at period end). B2: disable the workflow and delete the bucket; no
production change other than dropping the backup role.

---

## C. Client-owned GitHub, Vercel and Supabase access or transfer (D9)

**Current state (verified 2026-11-28):**
- Repository `mudasarimamofficial/laptops-hub`: **PUBLIC**, 0 forks, 0 stars.
- Ruleset "Protect main" requires the `quality` check.
- Vercel and Supabase sit in the engineering accounts (doc 30 §3).
- The client admin owner account (`/admin`, role owner) exists.

**Options:**
- **C1 (recommended): full transfer** of the repository, the Vercel project and the Supabase project to client
  accounts. Developer access is then granted back as a member.
- **C2:** keep the engineering-owned accounts and add the client as owner/admin on each.
  - Cheaper to set up, but the client does not own the billing relationship or the recovery email.
  - Not true custody.

**Cost:** $0 for the transfers themselves. Plan costs are in A and B.

**Implementation order (doc `11` has the exact screens):**
1. The client creates a GitHub account or org, a Vercel team and a Supabase org, each with 2FA and a client recovery
   email.
2. **Freeze window:** no merges and no migrations.
3. GitHub: transfer the repository, re-create Actions secrets `CRON_SECRET` and `NOTIFY_CRON_URL`, check the ruleset
   carried over.
4. Vercel: transfer the project, re-link Git, confirm env vars, cron and domains.
5. Supabase: transfer the project to the client org. URL and keys normally stay the same; confirm by loading the site
   and signing in.
6. Smoke test:
   - home, product, cart, checkout quote (no order), `/admin` sign-in;
   - the next scheduled keepalive run.
7. **Only then** rotate secrets, one at a time with a smoke test after each (doc `11` §5).
8. Remove developer ownership only after the client confirms owner access on every provider.

**Verification:**
- Each provider shows the client as owner.
- A docs-only PR deploys.
- The keepalive and notification-retry workflows run green on schedule.

**Rollback:** each provider allows transferring back while the client still owns the target. Keep the old accounts
until two weeks of normal operation have passed.

---

## D. Shopify product-media custody and staged migration (D3, D17)

**Current state (verified 2026-11-26, doc 25):**
- 964 of 964 product images are hot-linked from `cdn.shopify.com`: 87.2 MB, all reachable, rights marked `pending`
  on every row.
- 14 homepage preset images are on Shopify too.
- The storefront relies on Shopify's free resizing (`?width=`). A plain copy would make phones download full-size
  originals.

**Options:**

| Option | Cost | What it means |
|---|---|---|
| A. Keep hot-linking | $0 | Every product photo breaks the day the Shopify store closes. |
| B. Back up only | $0 | Copy files to client storage; the site still uses Shopify. |
| **C. Copy and switch in phases (recommended)** | $0 within Supabase Free storage | About 150–250 MB including sized WebP copies (to be measured). Egress moves to Supabase. |

**Implementation order (doc 25 §7; one approval per phase):**
1. Phase 0: the owner's rights decision.
2. Phase 1: copy plus sized WebP copies, on a 10-product sample first.
3. Phase 2: byte-for-byte verify.
4. Code PR: `image-url.ts` builds `srcset` from the stored widths. **This needs an LCP check, because product images
   are the LCP element on collection and product pages (doc 35).**
5. Phase 3: re-point in batches of 10 → 50 → the rest.
6. Phases 4–5: homepage presets and the importer.
7. Keep Shopify open 30 days after the last batch.

**Verification:**
- Each batch: the product pages return 200, the images are the right type and size, and LCP is no worse than the
  doc 35 baseline.
- After the full switch: zero `cdn.shopify.com` requests on home, collection and product pages.

**Rollback:** each batch saves a before-image of its `product_media` rows (`id, url, origin`). Restoring those rows
switches the batch back to Shopify instantly. Shopify files are never deleted by this plan.

---

## E. Resend email account ownership and alert delivery (D7)

**Current state:**
- `RESEND_API_KEY`, `STORE_FROM_EMAIL` and `STORE_NOTIFY_EMAIL` are set in Vercel Production (names only, doc 30).
- The Resend account owner, the domain verification of `laptopshub.pk` and the plan were **not inspected** (not
  accessible from this workstation).
- Settings → Notifications has a "send test" button (G24) for staff alerts.

**Options and cost (verify on resend.com/pricing):**
- **Free:** 3,000 emails a month, at most 100 a day. Enough for a small store's order confirmations and staff alerts.
- **Pro:** about US$20/month for 50,000 emails, with no daily cap.
- An alternative provider (Postmark, Amazon SES and others) would need a small code change to the sender. Not
  recommended now.

**Implementation order:**
1. The client creates a Resend account on a client mailbox, with 2FA.
2. Add the domain `laptopshub.pk` and add the SPF/DKIM records Resend shows.
   - This is a **DNS change**, so it needs separate approval.
   - Export every existing record first; never touch `app.laptopshub.pk` (Hostinger CRM).
3. Wait for "Verified" in Resend.
4. Create an API key limited to sending, and put it in Vercel Production as `RESEND_API_KEY`. This is a credential
   rotation: do it in a quiet hour.
5. Redeploy.
6. Admin → Settings → Notifications → send test to the staff address.
7. Revoke the old key in the old account only after the test arrives.

**Verification:**
- The test email arrives, and is not in spam.
- The Resend dashboard shows the message as delivered.
- The next real order produces the staff alert.

**Rollback:** put the previous key back in Vercel and redeploy. DNS records added for Resend can stay; they do not
affect the website.

---

## F. Production monitoring and incident response (D8)

**Current state:**
- No uptime monitor or error tracking.
- Vercel runtime logs exist on the current account.
- The daily cron and the GitHub keepalive/retry workflows email their account owner on failure: today that is the
  engineering account.

**Options (verify terms; some free tiers are personal-use only):**

| Option | Cost | Notes |
|---|---|---|
| **F1. Free external uptime monitor (recommended start)** | $0 | Check `https://www.laptopshub.pk/` and one product page every 5 minutes; alert to a client mailbox and WhatsApp/SMS if offered. Examples: Better Stack free tier, UptimeRobot (check its current terms for commercial use). |
| F2. Error tracking (for example Sentry's free developer plan) | $0 for one user and a small error quota | Needs a code change (SDK + DSN env var) and a privacy review: customer data must not be sent in error payloads. Separate PR, separate approval. |
| F3. Vercel Observability / log drains | Paid on Pro | Optional later. |

**Incident response (one page for the owner, add to runbook `30`):**
1. **Site down:**
   - check the Vercel status page and the project's latest deployment;
   - if the last deploy is bad, **Instant Rollback** to the previous deployment in Vercel (no code needed);
   - then tell engineering.
2. **Checkout failing:**
   - turn off COD in Admin → Settings → COD checkout. The site keeps browsing and WhatsApp enquiries working;
   - check the latest orders and the notification log.
3. **Database paused (Free plan):** Supabase dashboard → project → Restore/Resume. Then check one product page.
4. **Email not arriving:** Settings → Notifications → send test; check the Resend dashboard and the daily limit.
5. **Afterwards:** write down what happened, when, what was done, and what to change.

**Verification:** stop nothing on production to test. Instead, point a temporary monitor at a URL that returns 404
and confirm the alert arrives, then delete that monitor.

**Rollback:** delete the monitors; no change to the site.

---

## G. Repository privacy and historical personal-data containment (D19)

**Current state (verified 2026-11-28):**
- The repository is **PUBLIC** (0 forks, 0 stars).
- The current files hold no personal data from the engineering test order (doc 28 §2).
- Older text is still reachable in Git history and cached GitHub views. No keys or passwords were found in history
  (doc 28 §1).
- The LH-025 private evidence is only on the engineering workstation.

**Options:**
1. **Make the repository private (recommended).** $0.
   - Vercel keeps deploying.
   - GitHub Actions then uses the account's free private minutes. Today's use is about 2.5 minutes per CI run plus
     two short daily jobs, well within the free allowance, but re-check after the transfer.
2. Ask GitHub Support to purge specific cached views. Only needed if a specific old page with personal data is still
   reachable.
3. Rewrite history (`git filter-repo`). **Not recommended:** it breaks PR links and deployment history, and option 1
   already contains the exposure.

**Implementation order:**
1. Change visibility to Private: Settings → General → Danger Zone.
2. Merge a docs-only PR and confirm the "Vercel" status is success.
3. Confirm the CI and scheduled workflows still run.
4. Copy the LH-025 evidence to client-controlled encrypted storage. The owner confirms receipt; the workstation copy
   is then deleted on the owner's instruction.
5. Then do C (transfer).

**Verification:**
- `gh repo view --json visibility` returns `PRIVATE`.
- An anonymous browser gets 404 on the repository URL.
- The next deploy succeeds.

**Rollback:** change visibility back to Public. Stars and forks would not return, but there are none.

---

## What engineering will not do without written approval

Buy or upgrade plans, transfer accounts, change DNS, rotate production credentials, create database roles, copy or
re-point product media, or change repository visibility. Each package above is executed only after its own approval.

Sources for prices (2026-11-28; re-check before deciding):
- Vercel Pro: [vercel.com/pricing](https://vercel.com/pricing), [Pro plan docs](https://vercel.com/docs/plans/pro-plan)
- Supabase: [supabase.com/pricing](https://supabase.com/pricing), [PITR usage](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery)
- Resend: [resend.com/pricing](https://resend.com/pricing), [new free tier](https://resend.com/blog/new-free-tier)
