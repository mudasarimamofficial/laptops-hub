# Laptops HUB — Project overview

**Entry point:** `Laptops Hub Storefront v5.dc.html` (single-page, hash-routed storefront prototype)
**Rollback point:** `Laptops Hub Storefront v5 (pre-final checkpoint).dc.html` (state before the final completion pass)
**Design system:** V5 — Arctic Titanium × Electric Sapphire × Signal Red (frozen; see DESIGN_SYSTEM.md)

## Files
| File | Role |
|---|---|
| Laptops Hub Storefront v5.dc.html | App shell: header, mega-menu, all routes, cart, compare, search, dialogs, footer |
| ProductCard v5.dc.html | Product card (badge, chips, price, compare, add/inquire) |
| LHImg.dc.html | Image wrapper with loading / error fallback |
| data/lh-catalog.js | 50-product catalog (window.LH_CATALOG) — authoritative, unchanged |
| data/lh-content.js | Content system: 13 pages + 4 guide articles (window.LH_CONTENT) |
| assets/cut, assets/scene | Hero / product-story cutouts and stage |
| docs/*.md | This handoff set |

## What the prototype does
Browsing (home, 39 collections (+2 legacy aliases), search, 226 public PDPs from a 232-product catalog), filtering + sorting, compare (≤4, persisted), cart (persisted; no inventory logic), product inquiry + contact forms (demo only, nothing stored), 13 information/policy pages, guides hub + 4 articles, 404.

## What it does not do
No live checkout, no form delivery, no customer accounts, no real inventory sync. These are integration boundaries, documented in SHOPIFY_OS2_HANDOFF.md.

## Status in one line
Frontend scope implemented and route-verified at the preview width (905px). Business content (policies, contact details, company story), Chromebook inventory, media rights and multi-viewport testing remain open — see FINAL_COMPLETION_REPORT.md.
