# Enterprise Admin — Capability Execution Matrix

**Baseline verified:** 2026-10-25 · `main` `2b43236` · Supabase ledger 14 · catalog 232/226/6 · media 964 · zones 0 · COD off  
**Branch:** `feat/merchant-operating-system`

Status key: `done` · `partial` · `gap` · `blocked-owner`

| ID | Capability | Evidence (before) | Required | Priority | Status | Acceptance |
|---|---|---|---|---|---|---|
| A1 | Merchant admin shell / IA | Minimal top bar `admin/layout.tsx` | Sidebar, mobile nav, role-aware | P0 | **done** | Navigate all sections on desktop + mobile |
| A2 | Overview KPIs | Basic counts | Ops alerts, COD readiness, media rights | P0 | **partial** | Live counts; date ranges later |
| A3 | Product list | Search/status/price table | Thumbnails, inventory, bulk, media rights | P0 | **partial** | List enhanced; bulk select still gap |
| A4 | Product create | None | Full create with variant | P0 | **partial** | Create + default variant live |
| A5 | Product edit | Limited fields + one price | Options, SEO, inventory, specs | P0 | **partial** | Core fields + media; options matrix gap |
| A6 | Media URL / gallery | No admin media UI | Add/reorder/remove/primary, CDN refs | P0 | **partial** | URL add/reorder/remove live; primary/health later |
| A7 | Archive / soft-delete / restore | Status only | Soft-delete + audit + order safety | P0 | **partial** | API+UI; hard-delete gate TBD; needs migration for `deleted_at` |
| A8 | Bulk editor | None | Grid + paste + undo | P1 | **gap** | Status page only |
| A9 | Collections CRUD | DB + storefront rules; no admin module | Manual/smart, reorder, SEO | P0 | **partial** | List/detail read; create/edit gap |
| A10 | Inventory policy | Variant `inventory_mode` | Global settings + ledger | P0 | **partial** | Counts page; migration adds ledger |
| A11 | Shopify CSV import | `import-catalog.mjs` proprietary | Wizard, dry-run, commit, jobs | P0 | **partial** | Preview wizard; commit gated |
| A12 | Shopify CSV export | None | Modern/legacy/sidecar | P0 | **gap** | Helpers ready; endpoint gap |
| A13 | Site / theme editor | Hardcoded `page.tsx` V5 | Visual customize + publish | P0 | **gap** | Status panel |
| A14 | CMS pages | Basic HTML forms | Rich blocks, SEO, versions | P1 | **partial** | Existing content admin remains |
| A15 | Navigation menus | Code/hardcoded | Drag menus | P1 | **gap** | — |
| A16 | Orders / COD desk | Functional but basic UI | Enterprise filters, COD ledger UX | P0 | **partial** | Existing; shell only |
| A17 | Customers | None | Derived from orders | P1 | **partial** | Order-derived list |
| A18 | Inquiries | Exists | Polish + assignee | P1 | **partial** | Existing |
| A19 | Settings modular | Shipping + raw JSON | Typed modules | P1 | **partial** | Existing settings under shell |
| A20 | Analytics truthful | None | Real COD collected vs ordered | P2 | **partial** | Basic all-time |
| A21 | Activity / audit UI | Writes exist | Merchant-readable log | P1 | **partial** | List live |
| A22 | Roles / RLS on new APIs | Staff roles exist | Every new route tested | P0 | **partial** | Uses `requireStaff`; auth-matrix update pending |
| A23 | External media policy | All pending approval | Rights gate + health | P0 | **partial** | Never auto-approve; doc started |
| A24 | COD launch gates | Dual env+DB+policies | Preserve OFF | P0 | **done** | Unchanged / still off |

## P0 blockers (external)

| Blocker | Needed from owner |
|---|---|
| Shipping zones / fees | Exact zones + PKR fees |
| Legal policies | Approved copy for 5 checkout-required pages |
| Media rights | Confirm authorization for Shopify CDN URLs |
| Contact phones / hours / address | Resolve conflicting candidates |
| Production migration approve | Exact SQL review for `20261025120000` |
| CSV from source Shopify store | Real export for acceptance |
| COD go-live | Explicit after release gates |

## Dependency order

Shell → Product/media CRUD → Collections/inventory/bulk → CSV pipeline → Site editor → Orders/settings polish → Full QA → Owner activation
