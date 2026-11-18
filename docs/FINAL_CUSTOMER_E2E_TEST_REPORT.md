# Final customer E2E test report — 2026-11-18

Production storefront: `https://www.laptopshub.pk`  
Production deployment under test: `dpl_8sSU9AFwebcSBwPt1hyqTV14CMcR` @ `06b5ff3`  
Method: authenticated IDE browser + HTTP probes + quote API. No invented customer PII.

## Viewport / devices

| Viewport | Method | Verdict |
|---|---|---|
| Desktop ~1440 CSS | Browser automation screenshots (home, PDP, checkout) | PASS |
| 360 / 390 / 768 | NOT TESTED this pass | NOT TESTED |

## Journey matrix

| Step | Evidence | Verdict |
|---|---|---|
| Homepage render | Title Laptops HUB; hero; nav Dell/HP/Lenovo; cart control | PASS |
| Catalog `/collections/all` | Filters; sort; product grid; Add to cart | PASS |
| Invalid short handle `/products/dell-5400` | Intentional “not in catalog” with browse CTA | PASS |
| PDP Dell 5400 (full handle) | Specs, gallery, price Rs 49,000, Add to cart · Rs 49,000 | PASS |
| Add to cart | Drawer opens; badge 2 → 3 after extra add | PASS |
| Cart into checkout | Items Rs 147,000 (3× 49,000) | PASS |
| Checkout form | Name/phone/address/province; Place COD order gate | PASS |
| Shipping quote UI (Lahore + Punjab) | **All Over PK** Delivery Rs 360 · COD fee Rs 50; Cash due Rs 147,410 | PASS |
| Quote API | `POST /api/checkout/quote` with nested `address` → shipping 36000 / COD 5000 paisa | PASS |
| Apex → www | `laptopshub.pk` → 308 `https://www.laptopshub.pk/` | PASS |
| Policy pages | `/pages/shipping|returns|privacy|terms|warranty|about|faq|contact` → 200 | PASS |
| Guides | `/guides` → 200 | PASS |
| Controlled live COD submit | Owner-controlled QA identity **not found** in project records | BLOCKED |
| Order cancel / no-dispatch | Depends on live order | NOT APPLICABLE |

## Checkout totals (verified, no order placed)

| Line | Amount |
|---|---|
| Items (3× Dell 5400) | Rs 147,000 |
| Delivery | Rs 360 |
| COD fee | Rs 50 |
| Cash due | Rs 147,410 |

Matches DB zone: All Over PK `flat_fee_paisa=36000`, `cod_fee_paisa=5000`.

## Console / network

| Check | Verdict |
|---|---|
| Homepage HTTP 200 | PASS |
| Quote API ok=true | PASS |
| Cron unauthorized 401 | PASS (auth bound) |
| Broken footer policy URLs | Correct slugs all 200 | PASS |

## Real order status

**BLOCKED** — requires owner-controlled test recipient (name, `03XXXXXXXXX` mobile, street, city, province) labeled QA / do-not-dispatch. No such identity is present in authorized project docs or accounts inspected this session.

Isolated COD matrix: **23/23 PASS** (`scripts/test-cod-checkout-isolated.mjs`) against local Supabase — not pointed at production writes.
