# Mobile admin acceptance — progress (2026-11-19)

## Done in PR #52
- Admin shell uppercase **LAPTOPS HUB**
- Mobile menu control ≥44px (`data-testid=admin-nav-open`)
- Nav items / sign-out min-height 44px
- Main: `min-w-0`, `overflow-x-hidden`, safe-area bottom padding
- Products + orders tables: bounded `adm-table-scroll`
- Global admin CSS: 16px inputs on small screens (iOS zoom), `.adm-table-scroll` helper

## Continuation (this branch)
- Bounded `adm-table-scroll` on: merchandising, inventory, collections, staff, activity, customers, order detail line items
- Client handover updated to production `79df85d` / `dpl_3YEJSpByQsqfamyCj9MG1tjRAX5Z`

## Remaining (next commits)
- Card layouts for dense lists on ≤390px where tables still require horizontal scroll as primary UX
- Settings sections sticky save bars on short phones
- Blog editor / product editor sticky publish on 320–430
- Full route matrix interactive pass at 320/390/768/1366
- Isolated merchant create/edit/save/reload retest after UI changes

## Honest status
Engineering shell improvements: **PASS** (PR #52).  
List-table overflow hardening: **IN PROGRESS** (this branch).  
Full “every admin route operable on 320px” mandate: **IN PROGRESS** — not yet claimed complete.
