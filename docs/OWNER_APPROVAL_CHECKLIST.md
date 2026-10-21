# Owner approval checklist

For Laptops HUB to complete. Nothing here was invented in the prototype; every item is currently shown to customers as "Being finalised" (or hidden). Detail per page: BUSINESS_CONTENT_REQUIREMENTS.md. Text lives in `data/lh-content.js` (pending blocks); set a page's `status` to `'ready'` once approved.

To review pending items in context, turn on the `ownerReview` prop (Tweaks). It is off by default and must stay off in any customer-facing build; in Shopify it has no equivalent and pending blocks are simply not rendered.

## Company facts
- [ ] Legal business name, registration details (if to be shown)
- [ ] Address, phone, WhatsApp, email, opening hours
- [ ] About story and photos (optional)
- [ ] "Why Laptops HUB": the inspection/testing steps you actually perform

## Policies (legal review recommended)
- [ ] Shipping: regions, couriers, timelines, charges, cash on delivery, tracking, damage process
- [ ] Returns: window, eligibility, condition, who pays return shipping, refund method and timing, exchanges
- [ ] Warranty: length, coverage, exclusions, claim process, remedy, any manufacturer warranty
- [ ] Privacy policy: data collected, processors, retention, rights, cookies
- [ ] Terms and conditions: entity, pricing, order acceptance, payment, liability, governing law

## Catalog
- [ ] Confirm prices for all 226 public products (one draft, laptop batteries, has price 0)
- [ ] Inventory: storefront shows no stock counts. Decide whether Shopify should track inventory (currently no tracker on any product). No Admin change made
- [ ] Approve or fix the 6 drafts (identity/config review) before publishing
- [ ] Review 2 public products with flags: Surface Laptop 5 (identity), Surface Go 2 i5 11th (configuration)
- [ ] Duplicate titles across separate handles (e.g. 3 × EliteBook 840 G7 i5 10th 8/256): merge or differentiate
- [ ] Rewrite Body HTML for the 182 new products (currently internal CRM notes)
- [ ] Confirm condition values (currently "Used" or not listed)
- [ ] Condition grade definitions if grades will be used
- [ ] Usage collections (student, business, workstation…): rules or per-product tags
- [ ] New arrivals / best sellers: data source

## Media
- [ ] Rights for all 964 product photos (0/232 products cleared)
- [ ] Rights for the 6 hero/story cutouts derived from catalog photos
- [ ] Chromebook photos when products exist

## Chromebooks
- [ ] HP Chromebook 14 G5: confirm processor, screen, condition and photos (listed now with RAM/storage/price only)
- [ ] More Chromebooks: import when real units exist (rules in CHROMEBOOK_IMPORT_REQUIREMENTS.md)

## Forms
- [ ] Where contact and inquiry messages go (Shopify contact form inbox, email, CRM)
- [ ] Reply channel and promised response time (shown on Order inquiries)

## Editorial
- [ ] Sign off 4 buying guides + "How to choose"
- [ ] Homepage copy (hero, story, Chromebook campaign)
- [ ] Testimonials: only real, attributable reviews (none used now)
- [ ] Announcement bar: only real promotions
