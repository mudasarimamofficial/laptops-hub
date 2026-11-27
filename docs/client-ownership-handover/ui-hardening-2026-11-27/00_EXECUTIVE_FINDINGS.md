# 00 — Executive findings: UI/UX, responsive and production hardening (2026-11-27)

**Status:** all six reported visual defects are fixed, merged and live, together with three more found during testing. A fourth (HYD-001, checkout) and a small SEO fix were found in the final full run; they are in the fix PR listed in `11`. Each was verified on production read-only, with real layout measurements. No production data, order, migration, policy, price, discount, COD setting, DNS or CRM was touched. The V5 design is unchanged: these are fixes, not a redesign.

## In one paragraph each

- **Header / promotion bar (VIS-001, VIS-003):**
  - On phones, the "Visit our store" map was pinned behind the page (a reveal effect meant for large screens). It was taller than the space available, so it painted over the promotion bar and showed through the translucent header ("Open in Maps").
  - The map is now an ordinary section on phones and short windows, and the phone header is 97% opaque.
  - Live: 0 map pixels inside the header or promo bar at any scroll position.
- **Desktop top-right artifact (VIS-002):** two causes, both fixed.
  - On short or zoomed windows, the pinned map reached the header. It now pins only on windows at least 761×700.
  - During the first 2.6 s, the hero's decorative light sweep extended above the hero and painted a pale streak over the right of the promotion bar. It is now clipped to the hero.
  - Live at 1366×768: 200 affected points at load before, 0 after.
- **Mobile map card (VIS-004):** order is now map → card → end of page.
  - Map 280–380px (307px live on a 375×667 phone).
  - The card is an ordinary block 16px below the map, with no absolute positioning, no negative margin and no overlap with the WhatsApp button.
- **Help menu clipping (VIS-005):** the sticky category column was taller than the menu's scrolling area, so Help was cut off by 6px. The column now always fits, and a longer menu would scroll inside it. Live: Help 12px clear of the footer.
- **WhatsApp shape (VIS-006):** a 56×56 circle on phones, with the icon centred (was 68×52). The desktop pill is unchanged, and so is the merchant's link.
- **Site-wide audit (VIS-007):** a new automated audit of 9 routes × 11 screen sizes (phones, landscape, tablet, laptop, short desktop) found nothing else: no sideways scroll, no clipped buttons, no overlay hiding content.
- **Whitespace (VIS-008):** no blank screens anywhere while scrolling. The large empty area in stitched full-page screenshots is the pinned product story's scroll runway, which is intentional V5 and kept.
- **Accessibility:** axe (WCAG 2.2 AA) found one real issue. Filter options with no products were faint but clickable. They are now disabled (#111). Result: 0 violations on 7 routes at phone and desktop width.

- **Full test run (evening, new session):**
  - The previous session's full run was cut off when its account access ended (60 passed, then the local server died).
  - A clean re-run on main `4e4daac` gave 275 passed, 3 failed, 8 not run (38 min). None of the 3 failures came from the product: one was machine load, one a test that depended on an older database (fixed), one was slow Shopify CDN images. Re-running those three files: 15/15 passed (`10`).
- **New defect HYD-001 (checkout, P2), found because of that run:**
  - On a busy phone, the checkout form could be rebuilt by React a moment after it appeared, wiping a city that had just been typed. The customer then saw no delivery price until they typed it again.
  - This was the "flaky quote message" in earlier runs: a real bug, not a flaky test.
  - Cause: the cart's "what the server rendered" value changed once the header read the cart.
  - Fix: one constant in the cart and compare stores. No price, quote or checkout logic changed. Before: React error on 5 of 8 slow loads. After: 0 of 16.
- **SEO-001 (P3):** the live `/cart` page was marked indexable with a generic title. It is now `noindex` like checkout and compare. robots.txt already blocked crawling it.

## Evidence

- Reported defects: `01`. Root causes, with measurements: `02`. Viewport matrix: `03`. Map/compositing: `04`. Mega menu: `05`. WhatsApp: `06`.
- Storefront functional: `07`. Admin functional: `08`. Performance and accessibility: `09`. Tests: `10`.
- PRs and deploys: `11`. Limitations and owner decisions: `12`.
- PRs #107–#111, all merged after green CI, each with a successful Vercel production deploy (`11`).

## Owner checks (5 minutes, own phone)

1. Open the homepage on your phone and scroll slowly to the end. The header stays clean, and the map then the card come after the footer.
2. The WhatsApp button is a round green circle.
3. On a laptop, open "Laptops" in the header. The last group, Help, is fully visible.

Status label: **READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED** (unchanged; it depends on owner decisions in `12`, not on this pass).
