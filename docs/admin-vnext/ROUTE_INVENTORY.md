# Admin VNext — route inventory

**Main:** `6e683fa` (#32) · **Prod promote in flight:** `dpl_GbnaeHReBLurhw4MtFSckJRDxhqw` (building)  
**Prior certified prod cited in mandate:** `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT`  
Gates: Visual · Workflow · Functional · Persistence · Responsive · A11y  
Values: `PASS` / `PARTIAL` / `FAIL` / `PENDING` / `BLOCKED`

| Route | Merchant task | Rel | Impl | Deployed | Persist QA | Resp | Notes |
|---|---|---|---|---|---|---|---|
| `/admin` | Overview | F | PARTIAL | YES | PENDING | PENDING | |
| `/admin/orders` | List COD | C | YES | YES | PENDING | PENDING | |
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
| `/admin/blog*` | Blog | A | YES | YES | PENDING | PENDING | TipTap #31; browser QA PENDING |
| `/admin/content` | CMS pages | D | YES | YES | PENDING | PENDING | |
| `/admin/reels` | Reels | D | YES | YES (#32) | PENDING | PENDING | Poster media picker |
| `/admin/reviews*` | Reviews | D | YES | YES (#32) | PENDING | PENDING | Product + testimonials desks |
| `/admin/media` | Media | D | YES | YES (#29) | PENDING | PENDING | cms-media upload |
| `/admin/navigation` | Menus | D | YES | YES (#29) | PENDING | PENDING | status mapping + save bar |
| `/admin/merchandising` | Badges | D | PARTIAL | YES | PENDING | PENDING | IA links; no fake metrics |
| `/admin/online-store*` | Customize | D | PARTIAL | YES | PENDING | PENDING | Tokens/links; V5 preserved |
| `/admin/analytics` | Insights | E | YES | YES (#30) | PENDING | PENDING | Honest COD metrics |
| `/admin/seo` | SEO | E | YES | YES (#30) | PENDING | PENDING | No false indexing claims |
| `/admin/settings` | Settings | E | YES | YES (#30) | PENDING | PENDING | Hub IA + COD readiness |
| `/admin/staff` | Staff | E | YES | YES (#30) | PENDING | PENDING | Roles explained |
| `/admin/activity` | Audit | E | YES | YES (#30) | PENDING | PENDING | Human labels |
| `/admin/help` | Help | F | PARTIAL | YES | PENDING | PENDING | |
| Auth routes | Login/reset | — | YES | YES | — | PENDING | |

See `IMPLEMENTATION_TRACKER.md` and `ACCEPTANCE_MATRIX.md` for independent gates. **Do not treat Impl=YES as Accepted.**
