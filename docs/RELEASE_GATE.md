# Release gate

Five separate gates. A later gate cannot pass before the earlier ones. No combined percentage is given on purpose.

**A** Frontend implemented · **B** Frontend verified (actual tests in this environment) · **C** Business content approved by the owner · **D** Shopify integration complete · **E** Production launch approved

| Area | A | B | C | D | E |
|---|---|---|---|---|---|
| Design system / tokens (V5, frozen) | Yes | Yes | n/a | No (theme settings) | No |
| Header, mega menu, mobile menu, footer | Yes | Yes | n/a | No (Shopify menus) | No |
| Homepage hero + scroll story + reduced motion | Yes | Yes (geometry all widths; visual 905) | Copy: pending owner review | No | No |
| Chromebook campaign + collection | Yes (1 real product: HP Chromebook 14 G5) | Yes | Specs incomplete in export | No | No |
| Collections (39, incl. categories) + filters + sort | Yes | Yes | Usage collections not defined | No (Search & Discovery) | No |
| Catalog: 232 products (226 public, 6 drafts hidden) | Yes | Yes (reconciliation 27/27; 226/226 PDPs) | 182 products need descriptions + full specs; 6 drafts need review | No (import + metafields) | No |
| No public stock / inventory display | Yes | Yes (226 PDPs + 12 listing routes scanned) | Inventory tracking decision pending | Use `variant.available` only | No |
| Search overlay + results | Yes | Yes | n/a | No (Predictive Search API) | No |
| Cart drawer + cart page | Yes | Yes | n/a | No (AJAX Cart API) | No |
| Checkout | Disabled button only | n/a | n/a | No | No |
| Compare (max 4, persisted) | Yes | Yes | n/a | No (product JSON fetch) | No |
| Contact + inquiry forms | Yes (demo only, store nothing) | Yes | Contact details missing | No (Shopify contact form) | No |
| About, Why, FAQ, Shipping, Returns, Warranty, Condition, Order inquiries, Privacy, Terms | Yes (pending blocks) | Yes | **No** | No | No |
| Buying guides (4 + how-to-choose) | Yes | Yes | Draft, needs editorial sign-off | No (blog) | No |
| 404 / unknown product / unknown collection | Yes | Yes | n/a | No (404.json) | No |
| Accessibility (automated) | Yes | Yes | n/a | — | Needs screen-reader pass |
| Responsive (8 widths) | Yes | Geometry yes; visual 905 only | n/a | — | Needs device pass |
| Performance | Not measured | No | n/a | — | Needs Lighthouse / field data |
| Media | 964 CDN images + 6 cutouts | Per-product order + primary image verified | **Rights not cleared (0/232)** | No (Shopify Files) | No |

## Launch blockers (all must clear for E)
1. Owner-approved policy and company content (OWNER_APPROVAL_CHECKLIST.md)
2. Media rights clearance for all product photos and hero cutouts
3. Shopify theme build, catalog import with metafields, real cart + checkout
4. Contact/inquiry delivery connected and tested end to end
5. Catalog content: descriptions for 182 new products, 6 draft reviews, duplicate-title review
6. Real-device responsive pass, screen-reader pass, performance measurement
7. Legal review of Returns, Warranty, Privacy, Terms

## Status (2026-10-21 — Next.js COD platform)
- Stack: Next.js + Supabase + Vercel preview (not Shopify). Gate **D** above is legacy; treat as “platform integration” = Supabase catalog + COD APIs.
- Branch `feat/v5-storefront-admin`: V5 homepage port, compare, collections, search filters, admin product/order/COD/content mutations.
- Security: P0 **9/9**, auth matrix **24/24** (anonymous). Staff-role browser E2E still needs owner membership bootstrap.
- **COD live ordering: OFF.** **No `vercel --prod`.** Production launch: **blocked** until owner checklist + explicit approval.
