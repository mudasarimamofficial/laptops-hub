# 04 — Shopify admin forensic audit (UX benchmark)

**Date:** 2026-11-17  
**Method:** Owner-authenticated Cursor browser · **read-only** (no product/order/settings mutations)  
**Store resolved:** `https://admin.shopify.com/store/laptopshub-2/`  
**Note:** Prompt URL `…/laptops-hub-qiytdqzr/` redirected into this authenticated store session. Treat **laptopshub-2** as the live benchmark surface for this owner account.

## Pass A — Information architecture

### Primary sidebar (observed)

| Group | Items |
|---|---|
| Core | Home · Orders (Drafts, Abandoned checkouts) · Products (Collections, Inventory, Purchase orders, Transfers, Gift cards) · Customers (Segments, Companies) |
| Growth | Growth (Attribution, Autopilot, Campaigns) · Discounts |
| Content | Content (Metaobjects, Files, Menus, Blog posts) |
| Markets | Markets (Catalogs, Rollouts) |
| Analytics | Analytics (Reports, Live View) |
| Channels | Online Store · Agentic |
| Apps | Flow |
| System | Settings · store switcher |

### Global patterns

- **Ctrl/⌘ K** search at top of nav
- Collapsible section children under Orders / Products / Customers / Content / Markets / Analytics
- Sales channels and Apps as separate expandable blocks
- Settings at bottom (persistent)
- Dense keyboard shortcut map (`?`) covering navigation (`G H`, `G O`, `G P P`…) and create actions (`A P`, `A C`…)

### Home / overview principles

- Store readiness status (“Ready to sell”)
- Theme preview + Edit theme + privacy (Private)
- Actionable setup cards (payments, shipping, regional guidance)
- Sidekick-style natural-language prompt bar

**IA takeaway for LH:** group by merchant job (Orders → Catalog → Customers → Online store → Insights → System). Put rarely used / advanced items behind children. Keep Settings last. Global search + keyboard shortcuts matter.

## Pass B — Interface / interaction (observed)

- High content density with clear primary CTAs
- Nested nav expands in place (Products → Collections/Inventory…)
- Setup cards with dismiss + single primary action
- Theme privacy badge on preview
- Shortcuts modal is exhaustive (power-user oriented)
- Pakistan-aware onboarding card (“Optimize your store in Pakistan”)

**Not copied:** Shopify branding, Sidekick, payments activation UI, Markets/Agentic/Flow, gift cards, purchase orders / transfers (unless LH later needs them).

## Pass C — Workflow notes (read-only)

| Workflow | Shopify pattern | LH implication |
|---|---|---|
| Daily ops start | Home → readiness + tasks | Overview should surface COD readiness + blockers (LH already has readiness panel) |
| Catalog | Products list → nested Collections/Inventory | LH already mirrors Products / Collections / Inventory |
| Theme | Online Store → Edit theme | LH `/admin/online-store` customize + preview |
| Settings | Bottom Settings → deep categories | Keep LH Settings consolidated; avoid Shopify payment modules |
| Create anything | `A *` shortcuts + obvious primary actions | LH has Ctrl/⌘ K search; expand shortcuts where missing |

## Explicit non-goals (Shopify-specific / N/A for COD-only LH)

- Card / wallet payment providers
- Shopify Markets / multi-currency
- Gift cards, POS Capital, Agentic channel
- Abandoned checkout paid recovery (different commerce model)
- Shopify apps / Flow as platform dependency

## Settings categories observed (Pass A/C — read-only)

From authenticated `/settings/general` sidebar on **laptopshub-2**:

General · Plan · Billing · Payments · Checkout · Customer accounts · Shipping and delivery · Taxes and duties · Locations · Markets · Apps · Sales channels · Domains · Customer events · Notifications · Metafields and metaobjects · Languages · Customer privacy · Policies · Brand · Users (org) · Partner billing

**LH mapping:** keep consolidated Settings + Staff + Notifications readiness; do **not** add Payments/Plan/Billing/Markets.

## Blockers / limits this pass

- No mutations performed (correct)
- Some Shopify Polaris a11y trees load slowly in automation (CDP text used as evidence)

## Products list (Pass C)

Observed on `/products`:

- Primary **Add product** + Import / Export / More actions
- Search and filter bar
- Bulk checkboxes
- Columns: product thumb/title, Status (Active/Draft), Inventory (“not tracked”), Channels, Type, Vendor
- Pagination (1–50)
- Nested children: Collections, Inventory, Purchase orders, Transfers, Gift cards

## Settings IA (Pass A/C — General)

Settings opens as a dedicated sheet with searchable categories:

General · Plan · Billing · Payments · Checkout · Customer accounts · Shipping and delivery · Taxes and duties · Locations · Markets · Apps · Sales channels · Domains · Customer events · Notifications · Metafields and metaobjects · Languages · Customer privacy · Policies

Plus org-level: Organization · Users · Payouts · Partner billing.

**LH mapping:** collapse into one Settings desk + Staff + SEO/Notifications — do not clone Payments/Plan/Billing/Markets.

General page also shows: store defaults, regional settings (backup region Pakistan), order ID format, order processing (manual fulfill checked), store assets, transfer store. Read-only for this audit.

## Verdict

**PASS (Pass A complete; Pass B/C started: Home, Products, Settings→General)** · continue Orders / Online Store / Shipping without mutations. LH owner admin authenticated in parallel.
