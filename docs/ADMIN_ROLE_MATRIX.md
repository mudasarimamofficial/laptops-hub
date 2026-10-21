# Admin role matrix

| Capability | owner | admin | manager | editor | fulfillment |
|------------|:-----:|:-----:|:-------:|:------:|:-----------:|
| Overview dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Products list/edit (planned) | ✓ | ✓ | ✓ | ✓ | — |
| Orders list / fulfillment | ✓ | ✓ | ✓ | — | ✓ |
| COD cash collection (planned) | ✓ | ✓ | ✓ | — | ✓ |
| Settings / shipping | ✓ | ✓ | ✓ | — | — |
| Inquiries | ✓ | ✓ | ✓ | ✓ | ✓ |
| Staff invite / deactivate (planned) | ✓ | ✓ | — | — | — |

Enforcement: `requireStaffPage([...roles])` on each route. Inactive membership → forbidden. No public self-elevation.
