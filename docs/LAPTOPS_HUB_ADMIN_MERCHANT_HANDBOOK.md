# Laptops HUB: Admin Merchant Handbook (2026-11-14 additions)

This page adds to `MERCHANT_HANDBOOK.md` (products, variants, collections, CSV, theme editor and navigation) and `STAFF_HANDBOOK.md` (roles). It covers only what changed in this release candidate.

## Admin is its own app

`/admin` no longer shows the shop's header, footer, cart or compare tray. To see the shop, use **View storefront** in the admin navigation or open `/` in a new tab. Unknown admin addresses show an admin-styled "Page not found".

## Is ordering open? (Overview → Checkout readiness)

The readiness panel lists each condition the server checks before a customer can place a cash-on-delivery order:

| Gate | Blocks ordering? | How to fix |
|---|---|---|
| Client flag / server flag | Yes | Ask the developer to set the two Vercel environment variables (owner approval) |
| Store setting | Yes | Settings → turn COD checkout on |
| Shipping zones | Yes | Settings → Shipping: at least one active zone |
| Policies | Yes | Content pages: publish the required policies once they are approved |
| Purchasable catalog | Yes (warns if stock is untracked) | Products: active products with price; track stock |
| Notifications | No (advice only) | Configure an email provider so customers get confirmations |
| Staff | No (advice only) | Invite at least one more staff member |

The status reads **Ordering open** only when every blocking gate passes. Otherwise it reads **Ordering closed · N blocking**. Customers see "Online ordering opens soon" and cannot submit an order.

## Delivery and COD fees

Settings → Shipping zones. Enter fees in rupees.

- **0 means free.** Customers see "Free delivery · No COD fee", and the total equals the subtotal.
- **A blank field is not 0.** The form refuses to save until you enter a number. This stops a missed field from turning into free delivery by accident.
- The current nationwide example is Rs 360 delivery + Rs 50 COD fee. The owner confirms the real amounts.
- Customers in cities outside every active zone are told COD is not available there, and the order button stays disabled.

## Storefront labels (Settings → Storefront labels)

As the client asked, these are hidden by default:

- **Show catalog counts:** "226 listings", "View all 170", "N products in the catalog", and counts in the menu.
- **Show product-story angle labels:** "Front view · 1/4".
- **Show homepage section numbers:** "02 —" in "02 — PRODUCT STORY".

Tick a box and save to bring a label back. The shop updates straight after saving. Image descriptions for screen readers are always kept.

## What is not in this release

- Customer reviews
- Video reels
- A blog editor
- "Best seller" badges
- "Someone just bought" pop-ups

None of these is shown on the shop, so nothing is invented. Each will be built from real data (moderated reviews, licensed videos, real order history) once approved.
