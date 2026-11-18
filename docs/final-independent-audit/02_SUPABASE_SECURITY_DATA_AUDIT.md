# 02 — Supabase security and data audit (baseline)

**Date:** 2026-11-17  
**Method:** Supabase CLI linked to `xvmmjkrkgznnakcobmww` (read-only queries + `migration list`)  
**Dashboard UI:** pending owner browser login

## Project health

| Check | Result |
|---|---|
| Name | Laptops Hub |
| Ref | `xvmmjkrkgznnakcobmww` |
| Status | `ACTIVE_HEALTHY` |
| Region | `ap-southeast-1` (Singapore) |
| Postgres | 17.x |
| Linked from this machine | Yes (`supabase/.temp/project-ref`) |

## Migrations

| Local files | Remote applied | Pending |
|---|---|---|
| 29 | 29 | **0** |

All timestamps from `20261021120000` through `20261118100000` match locally and remotely.

**Note:** Prior closeout docs stating “14 migrations pending (15–28)” are **obsolete** relative to production as of this audit.

## Catalog integrity (read-only)

| Metric | Count |
|---|---|
| Active products | 226 |
| Draft products | 6 |
| Soft-deleted | 1 |
| Total product rows | 233 |
| Variants | 234 |
| Product media | 964 |
| Collections table rows | 16 |
| Shipping zones | 1 |
| Store testimonials | 0 |
| Reels | 0 |
| Published testimonials | 0 |

Soft-deleted QA product explains the +1 over the original 232 baseline — not treated as corruption.

## Commerce gates

`store_settings.cod_checkout` = `{ "enabled": false, "reason": "Owner shipping/policies pending" }`

Aligned with live API 403.

## Security advisors (MCP, 2026-11-17)

| Advisor | Level | Assessment |
|---|---|---|
| `rate_limit_buckets` RLS, no policies | INFO | Likely service-role only; confirm no anon grants |
| Anon EXEC on SECURITY DEFINER RPCs (quote, confirmation token, homepage sections, `is_staff`/`has_staff_role`, availability) | WARN | **Intentional storefront RPCs** — do not revoke without exploit proof; re-run isolated negatives |
| Authenticated EXEC on theme publish/save/rollback + same public RPCs | WARN | Theme RPCs must enforce staff inside function — covered by prior theme RLS matrices |
| Leaked password protection disabled | WARN | **Owner Auth toggle** |

## Performance advisors

| Advisor | Level | Notes |
|---|---|---|
| Auth RLS initplan (`admin_memberships`, `inventory_ledger`) | WARN | Optional `(select auth.uid())` rewrite |
| Unused indexes (24) | INFO | Do not drop without workload evidence |
| Multiple permissive policies (14 tables) | WARN | Common public+staff SELECT pattern; optimize later |

## Public schema tables (30)

`admin_memberships`, `articles`, `audit_logs`, `cod_collections`, `collection_products`, `collections`, `contact_inquiries`, `content_pages`, `faq_entries`, `fulfillments`, `import_jobs`, `inventory_ledger`, `notification_outbox`, `order_addresses`, `order_events`, `order_items`, `orders`, `product_badges`, `product_media`, `product_reviews`, `product_variants`, `products`, `rate_limit_buckets`, `reels`, `shipping_zones`, `store_settings`, `store_testimonials`, `theme_publications`, `theme_templates`, `theme_versions`

## Backups

Automated plan backups and restore drills: **not re-certified in this session yet**. Vercel rollback does not reverse DB writes/migrations.

## Verdict

**PASS (identity + migration ledger + catalog counts + advisor triage)**  
**PARTIAL** pending fresh isolated security matrices and backup restore drill.

