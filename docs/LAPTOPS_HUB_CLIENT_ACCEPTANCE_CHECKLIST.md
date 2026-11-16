# Laptops HUB — Client Acceptance Checklist

**For:** the store owner · **Updated:** 2026-11-16 · **Build under review:** see `LAPTOPS_HUB_FINAL_RELEASE_MANIFEST.md`
Everything in §A has been checked by engineering on a private test copy of the shop (not the live site). §B lists the
decisions and content only you can provide — the live shop should not take orders until every §B item is ticked.

## A. Please try these yourself on the test/staging copy (once one is set up)

| ✓ | What to try | What you should see |
|---|---|---|
| ☐ | Sign in at `/admin/login` with your own account | Your email and role at the bottom of the left menu; **Sign out** under it |
| ☐ | Press **Ctrl K** (⌘ K on Mac) or **/** anywhere in the admin, type a product name, SKU, order number or phone | Matching sections, products and orders; ↑ ↓ and Enter open one |
| ☐ | Products → open a laptop → add a second option (e.g. RAM 8GB / 16GB) with its own price and stock | Saved; the product page shows the options; the price changes with the option |
| ☐ | Set one option's stock to 0 | On the product page that option is shown as sold out and cannot be added to the cart |
| ☐ | Order one option through checkout (cash on delivery) | The order shows exactly that option (name, SKU, price); stock goes down by one; Inventory shows the movement |
| ☐ | Cancel that order before dispatch | Stock goes back up by one; no cash is recorded |
| ☐ | Take an order through Confirm → Pack → Dispatch → Record cash | "Paid — cash collected" appears only after you record the cash |
| ☐ | Staff → invite a person with a role | They get an email link, set a password and see only what their role allows. Inviting the same address twice is refused with a message |
| ☐ | Sign in as a Fulfillment person | Orders and inquiries only — no products, inventory, settings or staff |
| ☐ | Delivery zones → try a city you do not serve at checkout | "We do not currently deliver COD to this city/province" and no order button |
| ☐ | Badges & social proof → leave recent-order notices on with no real delivered orders | Nothing is shown on the shop (no invented activity) |
| ☐ | Look at the home page, a collection, a product and checkout on your phone | Same Laptops HUB design as today; nothing cut off or scrolling sideways |

## B. Decisions and content only the owner can provide (blocking the live launch)

| ✓ | Item | Why it blocks |
|---|---|---|
| ☐ | **Delivery and COD fees** per zone (current live setting: All Over PK, Rs 360 delivery + Rs 50 COD) — keep, change, or offer free delivery (Rs 0 + Rs 0) | Checkout charges exactly what is configured |
| ☐ | **Policies** — shipping, returns, warranty, privacy, terms: provide/approve the wording and publish them | Checkout stays closed until all five are published and approved; engineering will not write legal terms |
| ☐ | **Real stock counts** for each laptop/option you want stock-tracked | Stock is currently untracked; we never invent quantities |
| ☐ | **Photo and video rights** for the 964 catalog images and any reels | Images stay "pending" until you confirm rights; reels need "owned/licensed" |
| ☐ | **Staff list** — who gets which role | Each person needs their own login |
| ☐ | **Email sender** (Resend account + verified sending address) | Order emails and staff invitations need it |
| ☐ | **Approval to apply the 14 database updates** (`LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md` §2), after a fresh backup | The new admin and shop features depend on them. Update 28 also closes a staff-permission security hole that exists on the live database today |
| ☐ | **Approval to merge and deploy**, then separately **approval to switch on cash-on-delivery** | Nothing is deployed or switched on without your written go-ahead |
| ☐ | Whether to show recent-order notices and the "Top seller" badge after launch | Off by default; your privacy policy must mention them |
| ☐ | Customer reviews you actually received (with permission) and any blog articles | We do not write reviews or articles on your behalf |

## C. Sign-off

| Role | Name | Date | Signature / message |
|---|---|---|---|
| Owner | | | |
| Engineering | | | |
