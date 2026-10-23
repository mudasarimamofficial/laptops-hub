# Final launch — owner inputs (single list)

Everything engineering needs from the owner to open real COD orders. Nothing here may be invented by engineering.
Answer inline (or send the answers) — each item says where it goes once answered. Updated 2026-10-23.

Legend: **🔴 blocks public orders** · 🟠 needed before launch, not before testing · 🟢 can follow launch

## 1. Identity and access 🔴

| # | Question | Why | Where it goes |
|---|---|---|---|
| 1.1 | Which person is the **owner** of the store (name + the email they will sign in with)? | No owner account exists (1 manager only). The owner approves policies and manages staff. | One-time bootstrap SQL run by you (`docs/STAFF_HANDBOOK.md` § Owner bootstrap) |
| 1.2 | Is the existing **manager** account intended (who is it)? | Only staff account today. | Keep / deactivate in `admin_memberships` |
| 1.3 | Staff list: name, email, role (`admin`, `manager`, `editor`, `fulfillment`) | Order handling, dispatch, COD collection need named people. | Supabase Auth invite + membership (handbook) |

## 2. Legal business identity and contact 🔴

| # | Question | Why | Where |
|---|---|---|---|
| 2.1 | Registered business / legal name (and registration details, if they should be shown) | Terms, privacy, invoices | Terms, Privacy, About |
| 2.2 | Support phone, WhatsApp number, support email, opening hours | Contact page, order confirmation, notifications | Contact page; `STORE_SUPPORT_*` settings |
| 2.3 | Public address / showroom (or "online only") | Contact, returns address | Contact, Returns |
| 2.4 | Who reads website inquiries and order alerts, and the expected response time | Order-inquiries page, notification recipient | `STORE_NOTIFY_EMAIL` (see § 5) |

## 3. Delivery and charges 🔴

| # | Question | Why | Where |
|---|---|---|---|
| 3.1 | Which **provinces / cities** do you deliver to with COD? (whole province or listed cities) | No zone = no order can be placed | Admin → Settings → Shipping zones |
| 3.2 | **Delivery fee** and **COD fee** (PKR) per zone; any free-delivery threshold? | Charged on every order (server-calculated) | Same (fees per zone; free-delivery rule is not built — say if needed) |
| 3.3 | Courier(s) used and delivery time per zone (for the zone note shown at checkout) | Customer expectation | Zone "notes" |
| 3.4 | What happens on failed delivery / refused parcel (re-attempts, return to store, charges)? | Shipping policy, staff procedure | Shipping policy, handbook |

## 4. Stock and order confirmation 🔴

All 232 variants are **untracked** (no stock counts). The system therefore must not promise stock.

| # | Question | Why | Suggested default |
|---|---|---|---|
| 4.1 | Approve the **availability-confirmation workflow**: every order arrives as *placed*; staff confirm availability (by phone) before *confirmed*; unavailable → *cancelled* with a call. | Prevents selling units you do not have | Approve as written; customer pages say "our team confirms availability with you before dispatch" |
| 4.2 | Or: do you want stock **tracked** for some items (quantities per variant)? | Tracked items reserve stock at order time | Not for launch unless you keep counts current |
| 4.3 | Are the 226 published prices current? Any items to unpublish? | Price shown = price charged | Admin → Products |

## 5. Notifications 🔴 (business alert) / 🟠 (customer email)

The store now has a working notification sender, but it needs an email account you own.

| # | Question | Why | What engineering needs |
|---|---|---|---|
| 5.1 | Email address that must receive **new-order alerts** | Staff must see orders quickly | `STORE_NOTIFY_EMAIL` (Vercel, Production) |
| 5.2 | Approve an email provider and create the account (recommended: **Resend**, free tier; sending domain verified with DNS records) | Sending requires a provider; engineering cannot create it for you | `RESEND_API_KEY`, sender address `STORE_FROM_EMAIL` on a domain you verify |
| 5.3 | Send customer confirmation emails when the customer gives an email? (Y/N) | Optional; phone is the main channel | `NOTIFY_CUSTOMER_EMAIL=1` |
| 5.4 | SMS / WhatsApp notifications? | Not built; needs a provider (e.g. WhatsApp Business API) and approved templates | 🟢 post-launch |

## 6. Policies and content 🔴 (shipping, returns, warranty, privacy, terms) / 🟠 (others)

Per-page fact checklists: `docs/OWNER_CONTENT_NEEDS.md`. Pages with "being finalised" sections need written copy;
policy pages also need legal approval in admin. Engineering will draft from your facts; you approve.

| # | Page | Facts needed (summary) |
|---|---|---|
| 6.1 | Shipping & delivery | 3.1–3.4 |
| 6.2 | Returns & refunds | window, conditions, who pays return delivery, refund method/time, exchanges |
| 6.3 | Warranty | length, coverage, exclusions, claim steps |
| 6.4 | Privacy | 2.1; data collected (name, phone, address, email), processors (Vercel hosting, Supabase database, email provider, couriers); retention; contact for requests. **Not** Shopify. |
| 6.5 | Terms | 2.1; order acceptance (4.1), COD rules, cancellations, liability, governing law (Pakistan) |
| 6.6 | Contact, About, Why Laptops HUB, Condition guide, Order inquiries | 2.x, company story, grading, response time |
| 6.7 | FAQ, How to choose, Comparison guide, guides | Already factual V5 templates; approve publishing as-is (checkbox in admin) |

## 7. Media rights 🔴

| # | Question | Why |
|---|---|---|
| 7.1 | Do you have the right to publish the **964 product photos** (hosted on `cdn.shopify.com`, all marked *pending*)? Source: your own photos / supplier / manufacturer? | Public display without rights is a legal risk |
| 7.2 | If not: who will supply replacement photos, for which products first? | Replacement workflow in `docs/MEDIA_INVENTORY.md` |
| 7.3 | The V5 hero/story cutout images: approved for use? | Currently not deployed |

## 8. Launch approvals (final, one at a time) 🔴

1. Activate pre-launch mode on Production (`docs/PUBLIC_SITE_PLAN.md`) — recommended now.
2. Merge PR #1 → `main`, then PR #2 (production deploys from `main`).
3. Configure zones, staff, notifications, publish approved pages.
4. Controlled test order with **your** details on Production, then cancel it.
5. Enable COD (`COD_CHECKOUT_ENABLED`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED`, `store_settings.cod_checkout`) and remove
   `SITE_PRELAUNCH`.
