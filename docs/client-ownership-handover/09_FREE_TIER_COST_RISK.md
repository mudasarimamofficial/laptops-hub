# 09 — Hosting plans, free-tier limits and cost risk (2026-11-24)

Facts below were read from the authenticated CLIs on 2026-11-24 unless marked otherwise. Provider prices and terms
change; re-check the providers' own pricing pages before deciding. **No plan, billing or payment setting was changed.**

## What the store runs on today

| Provider | Account / project | Plan (verified) | Used for |
|---|---|---|---|
| Vercel | team `mudasarimamofficial-gmailcoms-projects` (`team_l7hth478q4bLcmoKR21X7uqm`), project `laptops-hub` (`prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`) | **Hobby** (`billing.plan = hobby`, active) | Website + admin hosting, `www.laptopshub.pk` / `laptopshub.pk`, one daily cron (`/api/cron/notifications`, 06:00 UTC) |
| Supabase | org `ueulxpdsqoxctaonswwm`, project `Laptops Hub` (`xvmmjkrkgznnakcobmww`, ap-southeast-1) | Free (per `docs/SUPABASE_FREE_RESILIENCE_2026-11-23.md`; **re-confirm in the dashboard** — the CLI does not report plan) | Database (15 MB today), Auth, Storage (CMS media) |
| GitHub | `mudasarimamofficial/laptops-hub`, **public** | Free account | Source, CI (`ci.yml` ~2.5 min/run), scheduled `supabase-keepalive` and `notification-retry` workflows (~9 s each) |
| Resend | (owner account) | not inspected | Order / recovery email (`RESEND_API_KEY` is set in Vercel Production) |
| Domain `laptopshub.pk` | registrar originally Websoul; DNS served via Vercel | not inspected | Website; `app.laptopshub.pk` points to the separate Hostinger CRM (`45.130.228.253`) |
| Shopify CDN | `cdn.shopify.com` image URLs in the catalog | not inspected | Product photos are still loaded from Shopify's CDN |

## Risks the owner must decide on

1. **Vercel Hobby is for non-commercial use (Vercel's fair-use terms).** An ecommerce store selling to customers is
   commercial use. Options: (a) Vercel **Pro** (paid per member per month; usage-based extras) in the client's own
   team — no code change; (b) another host that permits commercial use on a free/cheap tier (requires migration work
   and DNS changes); (c) stay on Hobby and accept the risk of enforcement. Engineering recommendation: (a), done as
   part of the Vercel transfer into the client's team. **Needs owner approval; it creates a recurring cost.**
2. **Supabase Free projects pause after inactivity and have no included automatic backups.** Keepalive runs daily
   (GitHub Actions + Vercel cron) and both ran green on 2026-11-24, but Supabase does not guarantee a free project
   will never pause. Backups: see `10_BACKUP_RESTORE_RUNBOOK.md` (manual logical export). Supabase Pro adds daily
   backups and removes pausing (paid).
3. **Shopify CDN images.** Catalog photos are hot-linked from `cdn.shopify.com`. If the old Shopify store is closed,
   those images can disappear. Mitigation: migrate the images into Supabase Storage (counts against the 1 GB free
   storage and egress) before closing Shopify.
4. **GitHub Actions minutes.** Public repositories get free standard runners; if the repository becomes private
   after transfer, CI and the scheduled workflows draw from the account's monthly free minutes (small today:
   ~2.5 min per CI run plus two ~9 s daily jobs).
5. **Email (Resend)** free tier has a monthly and daily send limit; order volume above it needs a paid plan.

## Rough monthly forecast (verify current prices)

| Traffic | Vercel | Supabase | GitHub | Email | Notes |
|---|---|---|---|---|---|
| Low (today) | Hobby $0 (non-compliant for commerce) or Pro (paid) | Free $0 | $0 | Free tier | Main risk is compliance and pausing, not usage |
| Medium | Pro (paid) | Free may suffice (DB 15 MB of 500 MB) | $0 | Free tier likely | Watch Supabase egress if media moves to Storage |
| High | Pro + usage | Pro (paid) for backups/no pause/egress | $0–low | Paid tier | Re-assess image hosting |

Nothing in the code activates a paid feature. Vercel Web Analytics / Speed Insights are not enabled.
