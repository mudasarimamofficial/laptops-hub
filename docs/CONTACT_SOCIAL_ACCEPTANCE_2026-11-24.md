# Contact / WhatsApp acceptance — 2026-11-24

## Results

| Check | Result |
|---|---|
| Admin Contact & Social save / reload / storefront reflect | **PASS** (isolated; values restored) |
| Phone list add / remove / reorder | **PASS** (UI + API) |
| Empty phone list does not resurrect defaults | **PASS** |
| Multi-variant WhatsApp message (variant/qty/campaign/SKU/URL) | **PASS** |
| Fixture recipient → `wa.me/{digits}?text=` encoding | **PASS** (`923009998877` test only) |
| No-recipient copy/open fallback | **PASS** |
| Primary ATC / Buy Now unchanged | **PASS** |
| Production footer contacts + social + float short link | **PASS** |
| Production PDP WhatsApp below Buy now; 5% price in CTA (`Rs 46,550`) | **PASS** |
| Production hero main cutout `boxShadow` | **PASS** (`none`) |

Isolated Playwright: **10/10**. Unit `contact-social.test.ts`: **ok**.

## Defect fixed in this pass

Phone editor lacked add / remove / reorder; `parseContactSocial([])` incorrectly restored the three default numbers. Both fixed.

## Merchant-only remaining

1. Enter the **verified WhatsApp recipient** (international digits, no `+`) in Admin → Settings → Contact & Social for automatic `wa.me` prefill. Do not assume any public phone is WhatsApp-enabled.
2. Until that number is set, PDP keeps the copy/open fallback (current production behavior: `data-wa-prefilled=0`).

## Evidence

- `docs/visual-evidence/contact-social-acceptance-2026-11-24/`
- Isolated suites: `contact-social-admin-persist.spec.ts`, `contact-social-whatsapp-order.spec.ts`, `contact-social-whatsapp.spec.ts`
