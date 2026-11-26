# 27 — G14 compare-at price: visual proposal (2026-11-26)

**Status: PROPOSAL ONLY. Not built into the storefront, not deployed.** The brief says: "Do not deploy the design change
until approved." V5 is frozen, so showing a compare-at price on the public site needs the owner's approval (decision
**G14-D** in `23`).

## 1. Facts (verified read-only 2026-11-26)

| Fact | Evidence |
|---|---|
| Production has 235 variants; **0** have `compare_at_paisa` set. | `npx supabase db query --linked` count query (read-only) |
| Admin already saves compare-at per variant (product form and variant matrix), and exports it in the CSV. | `src/components/admin/product-variant-matrix.tsx`, `src/app/api/admin/products/export/route.ts` |
| The public product card, product page and quick view never show it. Only the reels "shop" modal has a struck-through slot, which is always empty today (`compareAtText: null`). | `src/lib/content/reels-server.ts:19` |
| Checkout and order totals never read compare-at. The COD order function prices from `price_paisa` and the live storewide campaign only. | `supabase/migrations/*` (compare-at appears only in catalog/variant RPCs) |
| V5 already has a struck-through price style: when the storewide 5% campaign is live, `PriceDisplay` shows the selling price, the list price struck through, a "5% OFF" pill and (on the product page) "You save Rs …". | `src/components/storefront/price-display.tsx` |

So turning G14 on changes **nothing** today (no variant has a value), and it can never change an order total.

## 2. Proposal (reuse the existing V5 pattern; no new styles)

One reference price is struck through, never two:

```
reference = max(compare_at_paisa, price_paisa)      // the higher genuine former/list price
selling   = price after the storewide campaign      // unchanged pricing logic
show the struck-through reference only when reference > selling
```

| Case | What the customer sees |
|---|---|
| No compare-at, campaign off | `Rs 150,000` (today's look) |
| No compare-at, campaign on (5%) | `Rs 142,500  ~~Rs 150,000~~  5% OFF` (today's look) |
| Compare-at Rs 165,000, campaign off | `Rs 150,000  ~~Rs 165,000~~` (no pill; see rule 3); product page "You save Rs 15,000" |
| Compare-at Rs 165,000, campaign on | `Rs 142,500  ~~Rs 165,000~~  5% OFF`; product page "You save Rs 22,500" |
| Compare-at ≤ price (bad data) | ignored: shown as if there were no compare-at |

Rules:
1. **Same component, same tokens.** `PriceDisplay` gains an optional `compareAtPaisa`. Card, product page, quick view and
   the reels modal all go through it. No new colour, font, size or layout.
2. **Never two struck prices.** Only the higher reference is shown.
3. **The pill stays the campaign's own percentage** (it is the published offer). A compare-at saving alone shows no pill,
   so no new "% OFF" number is invented from merchant-entered data. (Option B below if the owner prefers a pill.)
4. **Cart, checkout, order emails and admin order pages are unchanged.** They show what the customer pays.
5. **Structured data:** product JSON-LD keeps `price` = selling price. Compare-at is not sent to Google as a sale price.
6. Bad data (compare-at ≤ price, zero, or missing) is ignored, not shown.
6a. **Accessible wording.** A struck line alone means nothing to a screen reader. The current price gets hidden text
   "Current price" and the struck price "Regular price" (visually unchanged). Colour contrast stays on the existing
   `--lh-ink-2` token (passes AA on white).

A static visual mock of the five cases, built from the exact `PriceDisplay` styles, is in
`27_G14_COMPARE_AT_MOCK.html` (open it in a browser; local file, no site code involved).

Option B (if the owner wants it): show a pill computed from the reference, for example "13% OFF". It is a larger visual
and legal claim; not recommended without rule 7.

7. **Owner responsibility.** A struck-through price tells the customer the product genuinely sold, or is normally sold,
   at that price. Engineering cannot verify that. The owner should only enter compare-at values that are true.

## 3. Scope of the change once approved

| File | Change |
|---|---|
| `src/lib/catalog/v5-model.ts` (product view model) | carry `compareAtPaisa` from `PublicProduct` (already loaded by `queries.ts`) |
| `src/components/storefront/price-display.tsx` | optional `compareAtPaisa`; reference = max(compare-at, list) |
| product card, product page, product detail / quick view | pass the selected variant's compare-at |
| `src/lib/content/reels-server.ts` | fill `compareAtText` with the same rule |
| tests | unit tests for the rule table above; isolated e2e: set a compare-at on a fixture variant, see it on card and product page, cart total unchanged; 360–1440 px no overflow |

No database migration. Estimated size: small (M in `22`).

## 4. What was not done

- No storefront code was changed and nothing was deployed.
- No compare-at value was entered on production.
- No screenshots of a prototype are committed. A prototype can be shown on the isolated stack on request.

## 5. Decision needed (G14-D)

Approve rules 1–7 (recommended), approve Option B, or keep compare-at admin-only (today's behaviour).
