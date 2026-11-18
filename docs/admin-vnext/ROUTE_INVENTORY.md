# Admin VNext — route inventory

**Main:** `58572f6` · **Prod:** `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT`  
Gates: Visual · Workflow · Functional · Persistence · Responsive · A11y  
Values: `PASS` / `PARTIAL` / `FAIL` / `PENDING` / `BLOCKED`

| Route | Merchant task | Rel | Impl | Deployed | Persist QA | Resp | Notes |
|---|---|---|---|---|---|---|---|
| `/admin` | Overview | F | PARTIAL | YES | PENDING | PENDING | |
| `/admin/orders` | List COD | C | YES | YES | PENDING | PENDING | Labels improved |
| `/admin/orders/[n]` | Fulfill | C | YES | YES | PENDING | PENDING | Off lh-container |
| `/admin/inquiries` | Inquiries | C | YES | YES | PENDING | PENDING | |
| `/admin/customers` | Customers | C | PARTIAL | YES | PENDING | PENDING | |
| `/admin/products` | Find products | B | YES | YES | PENDING | PENDING | |
| `/admin/products/new` | Create | B | YES | YES | PENDING | PENDING | EditorLayout |
| `/admin/products/[handle]` | Edit | B | YES | YES | PENDING | PENDING | Full flow PENDING |
| `/admin/products/bulk` | Bulk | B | PARTIAL | YES | PENDING | PENDING | |
| `/admin/products/import` | Import | B | PARTIAL | YES | PENDING | PENDING | |
| `/admin/products/export` | Export | B | PARTIAL | YES | PENDING | PENDING | |
| `/admin/collections*` | Collections | B | PARTIAL | YES | PENDING | PENDING | |
| `/admin/inventory` | Stock | B | PARTIAL | YES | PENDING | PENDING | |
| `/admin/blog*` | Blog | A | YES | YES | PENDING | PENDING | Upload+RTE gaps |
| `/admin/content` | CMS pages | D | YES | YES | PENDING | PENDING | |
| `/admin/reels` | Reels | D | PARTIAL | YES | PENDING | PENDING | |
| `/admin/reviews*` | Reviews | D | PARTIAL | YES | PENDING | PENDING | |
| `/admin/media` | Media | D | IN PROG | — | PENDING | PENDING | Upload added D2 |
| `/admin/navigation` | Menus | D | IN PROG | YES | PENDING | PENDING | is_published fix |
| `/admin/merchandising` | Badges | D | PARTIAL | YES | PENDING | PENDING | |
| `/admin/online-store*` | Customize | D | PARTIAL | YES | PENDING | PENDING | |
| `/admin/analytics` | Insights | E | PENDING | YES | PENDING | PENDING | |
| `/admin/seo` | SEO | E | PENDING | YES | PENDING | PENDING | |
| `/admin/settings` | Settings | E | PENDING | YES | PENDING | PENDING | |
| `/admin/staff` | Staff | E | PENDING | YES | PENDING | PENDING | |
| `/admin/activity` | Audit | E | PENDING | YES | PENDING | PENDING | |
| `/admin/help` | Help | F | PENDING | YES | PENDING | PENDING | |
| Auth routes | Login/reset | — | YES | YES | — | PENDING | |

See `IMPLEMENTATION_TRACKER.md` for release SHAs and independent gates.
