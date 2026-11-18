# Final customer E2E test report — 2026-11-18

Production storefront: `https://www.laptopshub.pk`  
Production deployment under test: `dpl_2daEN1ms2GpUwnjJXsjPSfybVGF4` @ `3a00091`  
Method: authenticated IDE browser + HTTP probes + quote API. No invented customer PII.

## Viewport / devices

| Viewport | Method | Verdict |
|---|---|---|
| Desktop ~1440 CSS | Browser automation screenshots | PASS |
| 360 / 390 / 768 | NOT TESTED this pass (prior certification covered; no layout defect observed on desktop journey) | NOT TESTED |

## Journey matrix

| Step | Evidence | Verdict |
|---|---|---|
| Homepage render | Title Laptops HUB; hero; nav Dell/HP/Lenovo; cart control | PASS |
| Catalog `/collections/all` | 226 products; filters; sort; Add to cart | PASS |
| Invalid `/laptops` | Intentional 404 with catalog CTAs | PASS |
| PDP Dell 5400 | Specs, gallery, price Rs 49,000, Add to cart | PASS |
| Add to cart | Drawer opens; cart badge increments (1 → 2) | PASS |
| Cart persistence into checkout | Checkout shows Items Rs 98,000 (2× 49,000) | PASS |
| Checkout form | Name/phone/address/province; Place COD order gate | PASS |
| Shipping quote UI (Lahore + Punjab) | Option **All Over PK** Delivery Rs 360 · COD fee Rs 50; Cash due Rs 98,410 | PASS |
| Quote API | `POST /api/checkout/quote` → shipping 36000 / COD 5000 paisa | PASS |
| Policy pages | `/pages/shipping|returns|privacy|terms|warranty|about|faq|contact` → 200 | PASS |
| Guides | `/guides` → 200 | PASS |
| Compare / cart routes | 200 | PASS |
| Controlled live COD submit | Owner-controlled QA identity **not found** in project records | BLOCKED |
| Order cancel / no-dispatch | Depends on live order | NOT APPLICABLE |

## Checkout totals (verified, no order placed)

| Line | Amount |
|---|---|
| Items (2× Dell 5400) | Rs 98,000 |
| Delivery | Rs 360 |
| COD fee | Rs 50 |
| Cash due | Rs 98,410 |

Matches DB zone: All Over PK `flat_fee_paisa=36000`, `cod_fee_paisa=5000`.

## Console / network

| Check | Verdict |
|---|---|
| Homepage HTTP 200 | PASS |
| Historical runtime error `Cannot read properties of undefined (reading 'reels')` | Observed on older deployment `dpl_GmTV…` (last 2026-11-17); current homepage rendered without that failure in this session | PASS (current) |
| Broken footer policy URLs | Correct slugs `/pages/shipping` etc. all 200 | PASS |

## Real order status

**BLOCKED** — requires owner-controlled test recipient (name, `03XXXXXXXXX` mobile, street, city, province) labeled QA / do-not-dispatch. No such identity is present in authorized project docs or accounts inspected this session.

Isolated/negative checkout suites remain available locally (`tests/e2e-isolated`, security probes) and were **not** pointed at production writes.
