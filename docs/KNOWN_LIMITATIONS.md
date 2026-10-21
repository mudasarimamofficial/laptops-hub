# Known limitations

1. **Checkout not connected**: button disabled and labelled.
2. **Forms not delivered**: contact and inquiry validate, then show "Demo only … not sent". Nothing is stored; legacy `lh_inquiries` is deleted on load.
3. **One Chromebook only** (HP Chromebook 14 G5); its processor, screen and condition are not in the export.
4. **Policies and company content unapproved**: pages show "Being finalised" blocks.
5. **Media rights**: 0/232 products cleared (147 PENDING_OEM, 65 pending review, 14 untagged, 6 NONE); hero cutouts derived from catalog photos.
6. **Responsive**: geometry verified at 8 widths; visual inspection at 905px only.
7. **Performance**: not measured.
8. **Usage collections** (student, professional…) not published: no classification data. Gaming and workstation come from Shopify Type/tags.
9. **New arrivals / best sellers** not published: no dates or sales data.
10. No inventory data is used. Every public listing with a price is shown as purchasable; the cart allows up to 99 per line (UI limit only). Real availability must come from Shopify (`variant.available`).
11. Filters reset on route change and are not in the URL (Shopify facets add query params).
12. Newsletter not built: no provider chosen.
13. Hero / story feature fixed products (Latitude 7420, ProBook 640 G2, ThinkPad T580): cutouts exist only for these.
14. Hash routing; in-page anchors (`#brands`, `#chromebooks`) are distinguished from routes (`#/…`). The theme uses real URLs.
15. Compare tray floats over the lower part of PDP gallery thumbnails at tablet widths until the page is scrolled. On the homepage it hides while the product story is on screen.
17. The prototype runtime paints the raw template for ~250ms on first load before page logic attaches. This does not exist in the Shopify theme.
16. Not tested with screen readers or on physical devices.
18. 182 new products have specs parsed from the title only (no display, graphics or OS unless named in the title); their descriptions are a neutral generated line because the CSV Body HTML contains internal CRM notes.
19. Several handles share an identical title (e.g. three "HP EliteBook 840 G7 - Core i5, 10th Gen, 8GB RAM, 256GB Storage"); all are listed because each handle is a separate Shopify product. Owner may want to merge or differentiate them.
20. Vendor "Laptops HUB" is used on 13 unbranded accessories and appears as a brand in the Brand filter.
