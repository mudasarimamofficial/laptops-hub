# 23 — Owner decisions and remaining ownership risks (2026-11-24, updated 2026-11-25)

These items cannot be closed by engineering. Each needs the owner's decision, account access or written policy.
No ownership transfer, paid upgrade, DNS change, production data change or theme publish was made to prepare this list.
"Verified" means checked on 2026-11-24 (or the date given) by a read-only command or page load. "Not verified" means taken from earlier
documents or not inspectable from this workstation.

| # | Risk / decision | State today | What it blocks | Owner options | Reference |
|---|---|---|---|---|---|
| D1 | **Vercel Hobby plan for a commercial store** | Verified: team is on Hobby (LH-014). | Hobby is restricted to non-commercial use; the store should not be certified for revenue on it. | (a) Vercel Pro on the client's own team (paid); (b) another host; (c) accept the enforcement risk. | `09_FREE_TIER_COST_RISK.md` |
| D2 | **Supabase Free: pausing and no included backups** | Plan not reported by the CLI (re-confirm in the dashboard). Daily `supabase-keepalive` workflow reduces the pause risk. `docs/LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md` assumes dashboard backups/PITR, which Free does not include. Doc 09 links to a `10_BACKUP_RESTORE_RUNBOOK.md` that does not exist. | Recovery after data loss. The in-app CMS backups could not be restored at all until LH-036 (PR #84); after it is live, **take a new backup** (Settings → Backups), because the one backup made before the fix cannot be verified and will be refused. | (a) Supabase Pro (daily backups; PITR is an add-on); (b) stay Free and run a scheduled logical export (`pg_dump`) to client-owned storage, encrypted, with a quarterly restore drill. | Local restore rehearsal: see "Backup rehearsal" below |
| D3 | **Product images hosted on Shopify's CDN** | Verified: 964 of 964 `product_media` rows point at `cdn.shopify.com`. | Closing or downgrading the old Shopify store may break every product image. | Keep the Shopify store/files reachable, or approve a media migration to client-owned storage (size and egress to be measured first). | — |
| D4 | **Live COD ordering** | Verified read-only 2026-11-25: `cod_checkout` is **enabled** (stored reason: owner mandate 2026-11-18; Rs 360 delivery + Rs 50 COD launch tariffs). 1 production order (18 Nov 2026). Not changed by engineering. | Certifying live commerce. | Owner confirms the published delivery, returns and cancellation policies are final, then places and verifies one real order end to end (order → staff alert → status updates → delivery). | LH-017 |
| D5 | **First merchant theme publish** | Verified 2026-11-25: production has 0 theme publications; the storefront renders the frozen V5 defaults. LH-018 is fixed (PR #81): publishing the unchanged default layout now produces byte-identical homepage HTML on the isolated stack, and edit → publish → restore is proven there (13/13). | Nothing; it is the merchant's call. | The merchant publishes when ready. Restore returns to the previous published version. No publish was made on production to produce evidence. | `05_THEME_EDITOR_SPEC_AND_ACCEPTANCE.md`, `15_MERCHANT_GUIDE_HOMEPAGE_EDITING.md` |
| D6 | **WhatsApp recipient** | The site shows the contact number from the owner's brief. Not verified: that this number is a monitored WhatsApp (Business) account. | WhatsApp orders/enquiries reaching a person. | The owner confirms the number in Admin → Settings and sends one test message from a customer phone. | — |
| D7 | **Client-owned email** | `RESEND_API_KEY` is set in Vercel Production. The Resend account owner, sending-domain verification and free-tier limits were not inspected. | Order, recovery and invitation email after handover. | Move Resend (or another provider) to a client account, verify `laptopshub.pk` sending records, then rotate the key in coordination (see `11`). | `09`, `11` |
| D8 | **Monitoring and alerting** | No uptime, error-tracking or alert service is configured. Vercel runtime logs exist on the current account. | Learning about outages or failed orders without a customer complaint. | Choose a free uptime monitor for the homepage and a product page (there is no health endpoint today) with alerts to a client mailbox; optionally error tracking. | — |
| D9 | **GitHub / Vercel / Supabase transfer** | Repository `mudasarimamofficial/laptops-hub` is **public**. Ruleset "Protect main" now requires the `quality` check (LH-015 is partly fixed: Dependabot and repo visibility still to decide). Vercel deploys from this repo; GitHub Actions hold Supabase keepalive/retry secrets. | Client independence. | Follow `11_OWNERSHIP_TRANSFER_PLAN.md` in a freeze window: transfer GitHub first, re-link Vercel, then Supabase org transfer. Decide whether the repo should be private. | `11` |
| D10 | **Domain and the Hostinger CRM** | Per doc 09 (not re-verified): `laptopshub.pk` DNS is served via Vercel and `app.laptopshub.pk` points to the separate Hostinger CRM (`45.130.228.253`). The CRM was not touched. | Any DNS or nameserver move. | Before any DNS change, export every record (including `app`, MX and email DNS) and recreate it first at the new host. | `11` §4 |
| D11 | **Migration ledger repair (LH-025)** | Re-verified read-only 2026-11-25 (`npx supabase migration list --linked`), unchanged: remote-only 20261118095223, 20261118123619, 20261118134801, 20261123095218; repo-only 20261118143000, 20261118160000, 20261118190000, 20261123120000. Live objects match the repo; pair 4 differs only in two column comments. `supabase db push` refuses to run until the ledger is repaired. | Future migrations through the normal `db push` path (G19, G22 and D12 all need one). | Two approvals: (1) the two `migration repair` commands in `21` §7 (ledger rows only, no schema SQL; backups in §8 first); (2) for pair 4, Option A (a comment-only migration) or Option B (accept the comment drift in writing), `21` §6. **CLOSED 2026-11-26:** the owner approved Option A and `24` §7; executed and verified (`24` §10). | `21`, `24` |
| D12 | **Database-level stock check in `sync_product_variants`** (optional hardening) | The app now refuses stale stock edits (PR #77). The RPC itself still writes absolute counts without an "expected quantity" check. | Defence in depth only. | Approve a small migration that adds an expected-quantity guard to the RPC. | `22_ADMIN_SELF_SERVICE_MATRIX.md` |
| D13 | **Production keys on this workstation** (LH-013) | `.env.production.local` holds production Supabase keys. The isolated scripts refuse non-local Supabase. | Accidental production writes from a local build. | Delete the file; pull env from Vercel only when needed. | `02` |
| D14 | **Supabase leaked-password protection** (LH-016) | Not re-checked in the dashboard. | Staff account security. | Turn it on in Supabase Auth settings (free). | `02` |

## Owner tasks from the search launch (2026-11-25)

Engineering for search is implemented; Google indexing is pending (see `seo-search/00` and the dated checklist in
`seo-search/17_MONITORING_CHECKLIST.md`). These are business decisions, not code:

| # | Task | Why it is the owner's | How |
|---|---|---|---|
| O1 | **Duplicate product titles** (9 groups, 19 products, counted 2026-11-25) | Only the owner knows whether two listings are different units or true duplicates. Nothing was renamed or archived automatically. | Admin → SEO → "Products sharing one search title". For each group: give each listing a distinct, **true** search title (for example the real RAM/storage or condition), or archive a real duplicate. Never invent a difference. |
| O2 | **Google Business Profile website link** | The profile is managed outside this project. | business.google.com → Website = `https://www.laptopshub.pk`. Check name, phone and address match the site. Do not create a second profile. |
| O3 | **Official address: "Shop no 3"?** | The profile and Facebook say "Shop no 3, 1st Floor…"; the site says "1st Floor…". The site was **not** changed. | Decide the exact official address, then make Admin → Settings → Contact & Social and the profile match exactly. |
| O4 | **Search Console review** | Only Google decides indexing; the property is owned by the business account. | On the dates in `seo-search/17`, open *Pages* and *Performance*. Do not re-request indexing unless a page changed. |
| O5 | **Merchant Center / free listings** (optional) | Needs written return and shipping policies. | Decide later; never publish invented policies. |

## Backup rehearsal (local stack only)

Run 2026-11-25 with `scripts/rehearsal/backup-restore.sh` against the **local** isolated database only: `pg_dump` of
`public` and `auth` (627 KB) restored into a scratch database. 35 tables, 1,685 rows in both; per-table row counts and
content checksums **identical**; 50 policies, 10 triggers, 169 constraints, 92 indexes and 12 auth users on both sides.
Scratch databases and the dump were removed afterwards. This proves the dump/restore procedure, not a production backup.

Separately, the in-app CMS backup (Settings → Backups) could never be restored until LH-036 (PR #84, live 2026-11-25).
It is now proven end to end on the isolated stack (backup → change → restore; the COD switch is kept).

No production dump was taken: it would place customer personal data on this workstation. A production restore drill
needs D2 decided first, then a client-owned, encrypted destination.

## Handover readiness

**READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED. Not a complete handover certificate.** D1, D2, D9 and D11 must be decided before the client
can run the store on their own accounts; D3, D4 (one verified real order), D6, D7 and D8 before relying on it for daily trade.
