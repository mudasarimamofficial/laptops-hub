# Final production audit — release 2026-11-16

Status vocabulary: **Implemented** · **Locally verified** (isolated stack, fresh reset) · **Staging certified** ·
**Production deployed** · **Live browser verified** · **Business approval pending**.

## Where each part stands

| Area | Implemented | Locally verified | Staging certified | Production deployed | Live verified | Business approval pending |
|---|---|---|---|---|---|---|
| Merchant OS (catalog, variants, stock ledger, collections, bulk, shipping zones, order desk, staff) | yes | yes (final suite) | no hosted staging | **yes** — `772276b`, 2026-11-16 | public pages yes; admin sign-in not exercised | — |
| Store testimonials and review carousel | yes | yes (E2E ×5 browsers, SQL 19/19) | no | yes | hidden state verified (nothing published) | genuine reviews and consent |
| Store map after footer | yes | yes | no | yes | **yes** (3 browsers × 2 viewports) | confirming the map listing |
| Admin latency (sin1, staff lookup dedupe, local JWT in middleware) | yes | modelled only | no | yes (sin1) | unauthenticated only | — |
| Migrations 15–29 | yes | yes (real backup restored and upgraded) | no | **yes** (29/29, owner-approved 2026-11-16) | post-checks PASS | — |
| COD checkout | yes | yes | no | flags unchanged | disabled | policies, fees, stock, operations, test order |
| Notification email | code yes | yes (fake provider) | no | no provider or env | — | provider choice, DNS values from provider |

## Staging

No hosted writable staging exists. A second Supabase project may need a paid plan, and none was created (no charges
without approval). The isolated local stack (fresh `db reset`, synthetic seed, no production PII) is the
certification environment. **The release is therefore not "staging certified".**

## Production checks performed (read-only, 2026-11-16)

- `www.laptopshub.pk` → 200, `laptopshub.pk` → 308 → www; served from Vercel with `x-vercel-id` `bom1::iad1::…`
  (functions in **iad1** until this release's `regions: ["sin1"]` deploys).
- No `Content-Security-Policy` or `X-Frame-Options` on Vercel responses, so the Google Maps embed iframe is not
  blocked by policy. The app adds none, so no CSP change is needed for `frame-src`.
- Sitemap baseline: 267/267 URLs 200. robots.txt disallows admin, api, order, checkout, cart and track-order.
- Supabase `migration list --linked`: 14 applied, 15 pending.

## Domains and email (assessed, nothing changed)

| Record | Value found | Meaning |
|---|---|---|
| NS `laptopshub.pk` | `ns1/ns2.vercel-dns.com` | DNS is managed in Vercel |
| A `app.laptopshub.pk` | `45.130.228.253` (Hostinger, LiteSpeed, 200) | CRM, **preserved** |
| MX `laptopshub.pk` | none | **Inbound** mail to `@laptopshub.pk` is not delivered anywhere |
| TXT (SPF) apex | none | Receivers cannot verify any sender for the domain |
| `_dmarc` | none | No DMARC policy |
| `resend._domainkey`, `send.` MX/TXT | none | Resend (the provider the code supports) is not verified for this domain |

**Outbound** email is a separate question from MX. It works only once a provider is chosen, its account exists, its
issued DKIM/SPF (and optional return-path) values are published in Vercel DNS, and `RESEND_API_KEY`, `STORE_EMAIL_FROM`
and `CRON_SECRET` are set in production. None of these exist today, so order notification emails are not sent in
production (they stay queued in `notification_outbox`). No DNS records were invented or added. Inbound mail needs a
mailbox provider (e.g. the Hostinger mail plan, if the owner has one) and that provider's MX values.

## Approval gate (production SQL and deploy) — approved and executed 2026-11-16

The owner approved both steps. A fresh backup was taken first (`D:\LaptopsHub-Backups6-11-16-pre-apply`, schema
checksum identical to the rehearsed one), the dry run listed exactly these 15, they applied in order, post-checks passed
(`docs/evidence/migrations/prod_apply_2026-11-16.txt`), then PR #10 merged (`772276b`). The approved change set:

1. **Apply migrations 15–29 to production** (exact list and hashes below), after a fresh same-day backup.
2. **Deploy the code** by merging the PR into `main` (Vercel production branch), only after step 1 succeeds.

| # | File | SHA-256 (first 12) |
|---|---|---|
| 15 | 20261025120000_merchant_catalog_extensions.sql | 6db615ed2702 |
| 16 | 20261025130000_site_builder_sections.sql | 4e646082926c |
| 17 | 20261025140000_theme_publish_variant_rpc.sql | 35a732dd5dcc |
| 18 | 20261025150000_theme_rls_inventory_hardening.sql | 1af78cebdf17 |
| 19 | 20261025160000_theme_immutability_service_role.sql | 9e2b343522c6 |
| 20 | 20261114100000_function_search_path_hardening.sql | b1776499ef67 |
| 21 | 20261115100000_reels_and_product_reviews.sql | 6b5e200ad6a7 |
| 22 | 20261116100000_merchandising_badges_and_reel_details.sql | 119611029085 |
| 23 | 20261117100000_order_inventory_integrity.sql | 6d2bbf3177d9 |
| 24 | 20261117110000_anon_write_revoke_and_fk_indexes.sql | 400070f98f96 |
| 25 | 20261117120000_shipping_zone_rules.sql | e436927a5d35 |
| 26 | 20261117130000_inventory_adjustments.sql | 1f47df575efd |
| 27 | 20261117140000_catalog_column_security_grants.sql | d0e66971c04d |
| 28 | 20261117150000_staff_direct_access_least_privilege.sql | caf00e4f22e6 |
| 29 | 20261118100000_store_testimonials_and_home_sections.sql | 4d8868df3f2b |

**Risk assessment**
- Data: no drops, truncates or deletes of existing rows. The only change to existing data is migration 15's
  backfill: one `store_settings` row (`inventory_policy`) and collections with non-empty rules set to `automated`.
  Rehearsed on the real backup: 232 products / 232 variants / 0 orders unchanged, and the schema matches a clean
  build exactly.
- Access: migrations 24, 27 and 28 *remove* privileges (anon writes, column grants, staff direct writes). Code that
  relied on them was verified against the new schema. Old code `cb638b7` passes 20/20 on the migrated schema, so the
  window between migration and deploy is safe.
- Ordering: migration 28 depends on 15–27. `supabase db push --dry-run` must list exactly these 15 in order.

**Backup status**: full schema, data (including auth) and roles dump from 2026-11-16 off-repo with checksums, restore
rehearsed. A fresh dump must be taken the same day, immediately before applying.

**Rollback limits**: code rolls back by promoting `cb638b7` (works on the new schema). The database has no automatic
down-migrations. Reverting schema means restoring the backup, which loses any data written after it. Production has
0 orders today, so the exposure is small if applied promptly.
