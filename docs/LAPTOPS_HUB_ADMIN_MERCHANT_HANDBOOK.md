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

## Reels (Online store → Reels)

Short videos for the homepage "Generation Laptops HUB" row. The row appears only when at least one reel is published.

- Link a **direct video file** (.mp4, .webm or .mov) on an https address you control, plus an optional cover image.
- Set **Video rights** to *Owned* (we filmed it) or *Licensed* (written permission; note who gave it and the terms). A reel cannot be published while rights are *Not confirmed*.
- Videos from other shops (for example the ronin.pk references) are refused.
- Videos never play by themselves; they load only when a shopper presses play.

## Reviews (Catalog → Reviews)

Shoppers can write a review on any product page. Every review waits under **Waiting** until you act:

- **Approve** honest reviews, good or bad. **Reject** spam, abuse or personal data. Staff cannot edit or write reviews.
- The star rating and review count on a product (and in search-engine data) come only from approved reviews. With none, the page says "No reviews yet".
- The reviewer's email, if given, is visible only to staff.

## Blog (Online store → Blog)

Write guides that appear at /guides/your-address, in the guides list and in the sitemap.

- Title, address (filled in from the title), summary and body (safe HTML: headings, paragraphs, lists, links). Scripts and unsafe links are removed when you save.
- A post needs a body before it can be published. Switch it back to Draft to take it off the site.

## What is not in this release

- "Best seller" badges
- "Someone just bought" pop-ups

Neither is shown on the shop, so nothing is invented. Both need real order history first.
