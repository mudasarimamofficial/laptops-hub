# Client acceptance checklist — release 2026-11-16

For the store owner. Earlier items (sign-in, search, product options, orders, staff, zones, social proof) remain in
`LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md` §A. This list adds the new features and the current blocking decisions.

## A. New in this release — please try

| ✓ | What to try | What you should see |
|---|---|---|
| ☐ | Open the home page and scroll to the very bottom | After the footer, the map of the Laptops HUB store in Bahawalpur is uncovered as the footer scrolls away; "Open in Google Maps" opens your listing |
| ☐ | Same on your phone | The map appears with the store panel below it; nothing scrolls sideways |
| ☐ | Admin → Catalog → Reviews → **Store testimonials** → Add testimonial; enter a real review you received (with the customer's agreement), tick consent, **Save and publish** | It appears in "What our customers say" on the home page within seconds; the card says where it came from |
| ☐ | Mark one as **Posted on Google** without a link | Refused: "A Google review needs the link to it on Google Maps." |
| ☐ | Press **Hide (unpublish)** | It disappears from the home page; **History** shows who did what and when |
| ☐ | Sign in as an Editor and add a testimonial | Can save and submit for approval, but there is no Publish button |
| ☐ | Home page reviews: press **Pause**, then **Read all reviews** | Movement stops; a window lists every review once; Escape closes it |
| ☐ | Online store → Customize → Customer reviews → change **Position**, Publish | The reviews section moves to the chosen place |
| ☐ | Catalog → Products → tick two products → **Feature** | Both marked featured; the bar reports "2 updated" |
| ☐ | Tick products → **Edit prices in bulk editor** | The bulk editor opens with just those products |
| ☐ | Move between admin pages (Products, Orders, Settings…) | Each opens in well under a second (after the release is deployed) |

## B. Owner decisions blocking public ordering (unchanged unless noted)

| ✓ | Item |
|---|---|
| ☐ | **Approve applying database updates 15–29 to production** (fresh backup first; rehearsed on a copy of the live data — nothing changed in your products) — see `MIGRATION_VERIFICATION.md` |
| ☐ | **Approve the code deployment** (merge to `main`) — see `PRODUCTION_RELEASE_RUNBOOK.md` |
| ☐ | Delivery and COD fees per zone (live: Rs 360 + Rs 50) or free delivery |
| ☐ | Policies (shipping, returns, warranty, privacy, terms) — your wording, approved and published |
| ☐ | Email: provider account + verified sending domain. **New finding:** `laptopshub.pk` has no email DNS records at all (no MX/SPF/DMARC), so it cannot receive mail and is not set up to send |
| ☐ | Genuine customer reviews to publish (the reviews section stays hidden until you do) |
| ☐ | Business identity and contact details for the site (address, phone, hours are not shown until you confirm them; the map points visitors to your Google listing) |
| ☐ | Separately: approval to switch on cash on delivery |

## C. Sign-off

| Role | Name | Date | Signature / message |
|---|---|---|---|
| Owner | | | |
| Engineering | | | |
