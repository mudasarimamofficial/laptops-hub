# Design system (V5, frozen)

All tokens are CSS custom properties set once on the app root in `Laptops Hub Storefront v5.dc.html`. New components (pages, FAQ, forms, articles) use only these.

## Colour
| Token | Value | Use |
|---|---|---|
| --lh-signal | #E52434 | HUB badge, section dash. Never for shopping actions or small text (fails 4.5:1 at 12px; 404 kicker uses --lh-ink-2) |
| --lh-action / -hover | #2159D4 / #1748B5 | All shopping actions, links, focus ring |
| --lh-grad-action | #2C64E2→#2159D4 (vertical, same hue) | Primary CTAs. No blue→purple gradients |
| --lh-electric | #1CB9E8 | Glows, dots, progress, difference markers |
| --lh-iris | #6574D5 | Ambient light on navy surfaces only |
| --lh-canvas | #F6F9FE | Page background |
| --lh-titanium | #DFEAF7 | Product stage floors |
| --lh-ice | #EAF3FE | Selected / hover tint |
| --lh-navy | #0A1730 | Cinematic sections, footer, CTA bands, summaries |
| --lh-ink / -ink-2 | #102039 / #52637B | Text |
| --lh-border / -divider | #DAE5F2 / #E8EFF7 | Lines |
| --lh-success(-bg,-bd) | #166044 | Success states (no stock badges are used) |
| --lh-warning(-bg) | #865111 / #FFF4E0 | Pending content, rights flags |
| --lh-error | #B42318 | Form errors, remove |

## Type
Sora 600–800 (display, prices, headings, letter-spacing −.03 to −.05em) · Hanken Grotesk 400–700 (UI, body) · JetBrains Mono 400–500 (kickers, counts, SKUs, uppercase .1em tracking).

## Shape & spacing
Radii: 6 (HUB badge), 8–14 (controls, chips, thumbnails), 18–24 (cards, panels), 28–32 (feature frames), 999 (pills/buttons). Container 1360px (commerce) / 1200px (content pages); gutter clamp(16px,3vw,32px). Section rhythm clamp(56px,7vw,96px).

## Wordmark
"Laptops" Sora 700 + "HUB" Sora 800 white on solid --lh-signal, radius 6, inset bottom shadow. Same markup in header, mobile nav and footer.

## Patterns
Section kicker = 12px red dash + mono label. Pending content = warning-bg, dashed border, mono "PENDING BUSINESS APPROVAL". Draft = white pill "DRAFT · EDITORIAL REVIEW". Card badge: white pill with blue dot showing the product category (no stock wording).
