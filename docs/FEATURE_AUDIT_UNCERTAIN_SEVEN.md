# Feature audit — 7 uncertain capabilities

> Audited 2026-11-15 against `feat/merchant-operating-system` HEAD.

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Admin global search | **Partial** | `src/app/api/admin/products/search/route.ts` exists (product search). No global admin search bar across orders/customers/content. Collection membership has its own search (`collection-membership.tsx`). |
| 2 | Keyboard shortcuts | **Not implemented** | No dedicated shortcut system. References in content definitions are CSS class names, not keyboard bindings. |
| 3 | Product duplicate | **Implemented** | `src/app/api/admin/products/[handle]/duplicate/route.ts` — full server-side duplication with new handle generation. Button in `product-edit-form.tsx`. |
| 4 | Product archive / restore | **Implemented** | Status transitions (active/archived/draft) in `src/app/(admin)/admin/products/[handle]/page.tsx`. Bulk operations in `src/app/api/admin/products/bulk/route.ts`. Storefront correctly 404s archived products. |
| 5 | Shopify CSV import | **Implemented** | Full pipeline: `shopify-csv.ts` (parser), `shopify-import-commit.ts` (DB commit), `shopify-export.ts` (export), `shopify-import-wizard.tsx` (admin UI). Smoke-tested by `csv-commit` suite. |
| 6 | Blog editing | **Implemented** | Admin pages: list (`/admin/blog`), create (`/admin/blog/new`), edit (`/admin/blog/[id]`). API routes: `src/app/api/admin/posts/route.ts` (CRUD). |
| 7 | Review bulk management | **Not implemented** | Individual review moderation exists (`src/app/api/admin/reviews/[id]/route.ts` — approve/reject). No bulk select-and-action UI. |
| 8 | Scheduled publishing | **Not implemented** | No `scheduled_at` or `publishAt` field in schema or code. Content and products publish immediately. |

## Summary

- **5 of 7 implemented** (product duplicate, archive/restore, Shopify CSV, blog editing, admin product search)
- **2 not implemented** (review bulk management, scheduled publishing)
- **1 partial** (admin search is product-only, not global)

The 2 missing features (review bulk management, scheduled publishing) are enhancements, not release blockers. The admin can moderate reviews individually and publish content immediately.
