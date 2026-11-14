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
- **Creator name and tag** (optional): a name is shown only if you tick that the person agreed in writing. Never name a creator or public figure without permission.
- Playback: the reel a shopper is looking at plays **without sound**, one at a time, and stops when scrolled away. Sound starts only when the shopper presses the speaker button. Shoppers who prefer reduced motion or save data get a play button instead. You can turn automatic playback off, and change the row's heading, in **Badges & social proof → Reels row**.

## Reviews (Catalog → Reviews)

Shoppers can write a review on any product page. Every review waits under **Waiting** until you act:

- **Approve** honest reviews, good or bad. **Reject** spam, abuse or personal data. Staff cannot edit or write reviews.
- The star rating and review count on a product (and in search-engine data) come only from approved reviews. With none, the page says "No reviews yet".
- The reviewer's email, if given, is visible only to staff.

## Blog (Online store → Blog)

Write guides that appear at /guides/your-address, in the guides list and in the sitemap.

- Title, address (filled in from the title), summary and body (safe HTML: headings, paragraphs, lists, links). Scripts and unsafe links are removed when you save.
- A post needs a body before it can be published. Switch it back to Draft to take it off the site.

## Badges & social proof (Online store → Badges & social proof)

The top box always tells you how many real qualifying orders exist and which products qualify, so you can see why nothing shows yet.

- **Editorial labels** — "Featured", "Popular pick" or "Staff pick" on one product, with an optional start and end date. They show a star and a blue outline. Editors can set them.
- **"Top seller" badge** — a small flame, calculated automatically from real orders (default: 3 or more units confirmed in the last 30 days, at most 8 products). You cannot give it to a product by hand. Cancelled, failed and returned orders never count. It is **off** until you switch it on.
- **Recent order notices** — a small corner card such as "A customer ordered HP EliteBook 840 G8 today". Only real confirmed (or delivered) orders; never a name, phone, address or order number; the city only if you allow it; never on the cart or checkout. It is **off** until you switch it on, and with no qualifying orders nothing appears. There is no demo mode.
- Owner, admin and manager can change these settings; editors can manage labels only. Every change is in the Activity log.

Switch the notices and "Top seller" on only after your privacy policy is published and covers them.
