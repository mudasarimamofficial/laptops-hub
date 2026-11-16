# "Visit our store" map — footer-underlay reveal

Status: **implemented and verified on the isolated stack (2026-11-16)**; not yet in production.

## Behaviour

- **Homepage only**, rendered after the site footer through the storefront layout's parallel route slot `@after`
  (`@after/page.tsx` renders the map on `/`; `@after/[...rest]/page.tsx` and `@after/default.tsx` render nothing, so it
  never lingers after client-side navigation).
- **Reveal:** the map section is `position: sticky; bottom: 0` underneath the page. The main content and footer are
  lifted above it (opaque background, footer shadow), so as the footer scrolls up it uncovers the map. Pure CSS: no
  scroll listeners, no scroll hijacking, no layout shift (the section's height is reserved in normal flow).
- At the end of the page nothing covers the map and it is fully interactive.
- **Lazy loading:** the Google iframe is not in the page at first. A zero-height sentinel before the section mounts it
  when within 600 px of the viewport (`loading="lazy"` as well). Optional "click to load" setting for owners who prefer
  no Google request until the visitor asks. A `<noscript>` iframe covers no-JS visitors.
- **Reduced motion** or the reveal turned off: an ordinary section after the footer (no sticky).
- **Mobile (≤ 640 px):** the information panel sits below the map instead of over it.
- Panel: "Visit our store", intro, "Laptops HUB · Bahawalpur", **Open in Google Maps**, and a note that directions,
  hours and contact details are on the Google listing. No street address, phone or hours are typed into the site —
  `src/lib/business.ts` marks those as unconfirmed, so the Google listing (maintained by the owner) is the source.

## Safety

- The embed URL must match `^https://www.google.com/maps/embed?pb=[safe chars]$`; the "Open in Google Maps" link must be
  a host-anchored Google Maps link. Anything else falls back to the approved defaults and the theme API refuses to save
  it (400 with a readable message).
- iframe: `referrerPolicy="strict-origin-when-cross-origin"`, descriptive `title`, `allowFullScreen`.
- The supplied official embed is used as is; no scraping, no Maps API key.

## Verified

- Pin in the embed is the **LAPTOPS HUB** listing in Bahawalpur (checked in the browser, 2026-11-16).
- E2E (`p1-store-testimonials-map.spec.ts`): after the footer in DOM order; iframe absent at the top of the page and
  mounted near the bottom with the safe `src` and `loading="lazy"`; no horizontal overflow at 320 / 390 / 768 / 1440;
  absent on `/products`; reduced motion → not sticky.
- Browser check at 1440 px mid-scroll: footer scrolls up over the pinned map (computed `position: sticky`, map
  `z-index: 0`, footer `z-index: 1`).
- Still to run: WebKit / Firefox pass (step 7 of the release plan).

## Theme editor

Section **Store map** (`v5_store_map`): on/off, heading, intro, embed link, Google Maps link, reveal effect on/off,
click-to-load on/off.

## Files

`src/components/storefront/home/store-map.tsx` + `.module.css`, `src/app/(storefront)/@after/*`,
`src/app/(storefront)/layout.tsx`, `src/lib/content/home-sections.ts`.
