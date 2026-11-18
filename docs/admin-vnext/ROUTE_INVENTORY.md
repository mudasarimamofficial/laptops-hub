# Admin VNext — route inventory

Baseline branch: `feat/admin-vnext-release-a` · Source of truth: `src/app/(admin)/admin/**/page.tsx`

| Route | Merchant task | Layout | Release |
|---|---|---|---|
| `/admin` | Overview | Dashboard | F |
| `/admin/orders` | List COD orders | List | C |
| `/admin/orders/[orderNumber]` | Fulfill / timeline | Detail | C |
| `/admin/inquiries` | Handle inquiries | List | C |
| `/admin/customers` | Customer lookup | List | C |
| `/admin/products` | Find products | List | B |
| `/admin/products/new` | Create product | Editor | B |
| `/admin/products/[handle]` | Edit product | Editor | B |
| `/admin/products/bulk` | Bulk edits | Workflow | B |
| `/admin/products/import` | Import | Workflow | B |
| `/admin/products/export` | Export | Workflow | B |
| `/admin/collections` | Manage collections | List | B |
| `/admin/collections/new` | Create collection | Editor | B |
| `/admin/collections/[slug]` | Edit collection | Editor | B |
| `/admin/inventory` | Stock / tracking | Ops | B |
| `/admin/blog` | Blog desk | List | **A** |
| `/admin/blog/new` | Add post | Editor | **A** |
| `/admin/blog/[id]` | Edit post | Editor | **A** |
| `/admin/content` | CMS pages | List/editor | D |
| `/admin/reels` | Video reels | List/editor | D |
| `/admin/reviews` | Moderate reviews | List | D |
| `/admin/reviews/testimonials` | Home testimonials | List | D |
| `/admin/media` | Media library | Library | D |
| `/admin/navigation` | Menus | Editor | D |
| `/admin/merchandising` | Badges / featured | Settings | D |
| `/admin/online-store` | Customize | Settings | D |
| `/admin/online-store/preview` | Preview | Utility | D |
| `/admin/analytics` | Metrics | Insights | E |
| `/admin/seo` | SEO ops | Insights | E |
| `/admin/settings` | Store settings | Settings | E |
| `/admin/staff` | Staff & roles | Settings | E |
| `/admin/activity` | Audit log | Ops | E |
| `/admin/help` | Merchant help | Docs | F |
| `/admin/login` | Sign in | Auth | — |
| `/admin/forgot-password` | Reset request | Auth | — |
| `/admin/reset-password` | Reset form | Auth | — |
| `/admin/forbidden` | Access denied | System | — |
| `/admin/[...missing]` | 404 | System | — |

Acceptance status is tracked in `IMPLEMENTATION_TRACKER.md`.
