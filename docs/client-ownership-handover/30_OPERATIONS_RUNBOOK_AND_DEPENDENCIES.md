# 30 — Operations runbook and dependency list (2026-11-26)

A short operating guide for whoever runs Laptops HUB after handover. Deeper procedures are linked, not repeated.
Nothing here changes production by itself.

## 1. How a change reaches customers

1. Branch from `main` and make the change.
2. Prove it on the **isolated stack**:
   - local Supabase in Docker, and the fake mail server on port 4599;
   - build with `node scripts/dev/isolated-next.mjs build`, then run `npx playwright test --config=playwright.isolated.config.ts`;
   - see `docs/ISOLATED_TESTS.md`.
   - The isolated scripts refuse any non-local Supabase.
3. Open a PR. The GitHub ruleset "Protect main" requires the `quality` check (typecheck, lint, unit tests, build).
4. Merge. Vercel deploys `main` to production automatically. Smoke-check the public pages afterwards (read-only).
5. **Database changes are a separate, approved step.** Never `db push` during a merge. Follow
   `docs/LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md` and the change's own plan (for example `26`).
   - Run `npx supabase migration list --linked` first. On 2026-11-26 it showed 43 applied, 1 pending (`20261126140000`, D15), and none remote-only.
   - G19's `20261126160000` lives on the PR #91 branch (D16).

**Rollback:**
- Code: revert the merge commit and push (Vercel redeploys), or promote the previous deployment in Vercel.
- Theme: Admin → Online store → restore the previous published version.
- CMS data: Settings → Backups → restore. The live COD switch, notification settings and legal-page text are kept.
- Database schema: the per-migration rollback in its plan.

## 2. Daily and weekly checks (merchant / operator)

| When | What | Where |
|---|---|---|
| Daily | New orders, failed notifications ("Retry sending"), COD cash recorded | Admin → Orders; order page → Notifications |
| Daily | New inquiries and pending reviews | Admin → Inquiries, Reviews |
| Weekly | Search Console *Pages* and *Performance* (dates in `seo-search/17`) | Google Search Console (business account) |
| Weekly | Take a CMS backup before large edits | Admin → Settings → Backups |
| Monthly | Free-tier usage: Vercel, Supabase, Resend | Each dashboard (`09`) |

Automatic jobs (GitHub Actions; they need repository secrets):
- `notification-retry`: every 15 min; alerts by failed-run email.
- `supabase-keepalive`: 4× a day.
- `ci`: on every PR and push.

Vercel cron: once a day (Hobby limit).

## 3. Dependency list

### Services

| Service | Used for | Account today | Owner action | Ref |
|---|---|---|---|---|
| **Vercel** (Hobby) | Hosting, deploys, daily cron, domain routing for `laptopshub.pk` / `www` | engineering account | D1 (plan), D9 (transfer) | `09`, `11` |
| **Supabase** (`xvmm…` project, Free) | Database, auth, storage, RPCs | engineering org | D2 (backups), D9 | `09`, `11` |
| **GitHub** `mudasarimamofficial/laptops-hub` (public) | Code, CI, ruleset, Actions secrets | engineering account | D9, D19 (visibility) | `11`, `28` |
| **Resend** | Order, inquiry, invitation and recovery email | not inspected | D7 | `docs/NOTIFICATIONS.md` |
| **Shopify CDN** (`cdn.shopify.com`) | All 964 product images (hot-linked) | old Shopify store | D3 / D17 | `25` |
| **Google Search Console / Business Profile** | Indexing, local listing | business account | O1–O4 | `seo-search/` |
| **Hostinger** | Separate CRM at `app.laptopshub.pk` | client | **Do not touch.** Export DNS before any change. | D10 |
| **WhatsApp** | Order/enquiry chat from the site | number in Contact & Social | D6 | — |
| `ronin.pk` | Reference reels; allowed image host only. Not published (rights). | — | Remove from `next.config` remote hosts when no longer needed | — |

### Environment variables

Names only; values live in Vercel, never in git.

| Group | Variables |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Site | `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `SITE_PRELAUNCH`, `V5_CONTENT_PREVIEW`, `V5_CUTOUT_BASE` |
| COD gates | `COD_CHECKOUT_ENABLED`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` (plus the database switch `store_settings.cod_checkout`) |
| Email | `RESEND_API_KEY`, `RESEND_API_URL` (tests only), `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`, `NOTIFY_CUSTOMER_EMAIL`, `NOTIFY_TIMEOUT_MS` (fallbacks: Settings › Notifications overrides when saved) |
| Jobs | `CRON_SECRET` (Vercel and the GitHub Actions secret) |
| Safety switches | `MERCHANT_MUTATIONS_DISABLED`, `MERCHANT_WRITES_ALLOW_REMOTE` (local only), `THEME_PUBLISH_DISABLED`, `THEME_PUBLISHED_DISABLED` |

### Software

| Item | Detail |
|---|---|
| Runtime | Next.js 16.4.5, React 19.3.0 |
| Libraries | `@supabase/ssr`, `@supabase/supabase-js`, TipTap 3 (rich text), `sanitize-html`, `zod` |
| Tooling | Playwright, tsx, ESLint, TypeScript, Supabase CLI |
| Database | 44 migration files on `main`: 43 applied, 1 pending (D15). Isolated stack: `.isolated/` fixtures (git-ignored). |

## 4. Where things are

| Need | Document |
|---|---|
| What is decided and what is not | `23` (D1–D19) |
| Admin coverage per screen | `29` |
| Admin gap register | `22` |
| Backup and restore | `docs/LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md` |
| Transfer to client accounts | `11` |
| Theme editing for the merchant | `15` |
| Notifications | `docs/NOTIFICATIONS.md` |
| Git history review | `28` |
