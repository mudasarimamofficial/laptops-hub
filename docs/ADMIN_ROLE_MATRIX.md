# Admin role matrix

| Capability | owner | admin | manager | editor | fulfillment |
|------------|:-----:|:-----:|:-------:|:------:|:-----------:|
| Overview dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Products list/edit | ✓ | ✓ | ✓ | ✓ | — |
| Orders list / status / COD collect | ✓ | ✓ | ✓ | — | ✓ |
| Content pages CMS | ✓ | ✓ | ✓ | ✓ | — |
| Settings / shipping | ✓ | ✓ | ✓ | — | — |
| Inquiries (view, contact details, status) | ✓ | ✓ | ✓ | — | ✓ |
| Staff invite / deactivate (planned) | ✓ | ✓ | — | — | — |

Enforcement: `requireStaff` / `requireStaffPage([...roles])` on each route and API. Inactive membership → forbidden. No public self-elevation.

Anonymous API denial: `npm run test:security:auth-matrix` (requires local/preview base URL).
