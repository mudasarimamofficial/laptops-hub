# V5 Visual Parity Matrix

Reference freeze: `reference/v5/` (gitignored local copy of Claude Design V5).  
Primary file: `reference/v5/Laptops Hub Storefront v5.dc.html`  
Branch: `feat/v5-storefront-admin`

Status legend: **MATCH** · **PARTIAL** · **GAP** · **BLOCKED** (owner/rights)

| Component | Reference | Implementation | Responsive | Interactions | Evidence | Known differences | Status |
|---|---|---|---|---|---|---|---|
| Design tokens | V5 CSS vars | `src/styles/tokens.css` | n/a | n/a | — | None intentional | MATCH |
| Header 72px + blur | Header block | `site-header.tsx` | Desktop ≥1180px nav; mobile drawer | Mega, search, escape | Pending Playwright | Search was link; now overlay | PARTIAL |
| Search overlay | `sOpen` dialog | `search-overlay.tsx` + `/api/catalog/search` | Full-bleed | Autofocus, Escape, suggestions | Pending | Live DB suggestions vs static catalog | PARTIAL |
| Mobile nav drawer | `mnav` | `site-header.tsx` | ≤1180 | Focus/scroll lock, groups | Pending | Count badges deferred | PARTIAL |
| Cinematic hero layers | Hero `#top` | `cinematic-hero.tsx` | Mobile stack | Intro, parallax, scroll `--hp` | Pending | Uses **catalog CDN images** (not cutout PNGs) until media rights cleared; stage.png CSS stand-in | PARTIAL |
| Product story (pinned) | `#story` | `product-story.tsx` | Sticky / RM fallback | Chapters, scroll progress | Pending | Cutouts → catalog multi-angle CDN | PARTIAL |
| Product card | `ProductCard v5.dc.html` | `product-card.tsx` | Grid | Hover swap, compare, ATC | Pending | Stock badge omitted (privacy) | PARTIAL |
| Brand / featured / budget / Chromebook / compare teaser | Home sections | `home-sections.tsx` | Yes | Links | Pending | Copy gated where unapproved | PARTIAL |
| Collections / filters | Collection views | `collections/*` | Yes | Sort/paginate | Prior | Filter chrome vs V5 polish | PARTIAL |
| PDP gallery | Product template | `products/[handle]` + gallery | Yes | Thumbs | Prior | Layout polish TBD | PARTIAL |
| Compare tray + page | Tray + `/compare` | `compare-tray.tsx`, `compare/page.tsx` | Yes | Max 4 | Prior | — | PARTIAL |
| Cart | Cart drawer + page | `/cart` (+ drawer TBD) | Yes | Qty | Prior | Slide-out drawer still GAP | GAP |
| Footer | Footer | `site-footer.tsx` | Yes | Links | Prior | Pending contact facts | PARTIAL |
| Cutout / stage assets | `assets/cut`, `assets/scene` | Local `reference/v5/assets` only | — | — | — | **Not published** — see `MEDIA_RIGHTS_CUTOUTS.md` | BLOCKED |

## Immediate engineering focus

1. Hero / header / card / search overlay — in progress this session.
2. Cart drawer + remaining PDP chrome.
3. Playwright baselines: reference HTTP vs Next.js (viewports in master prompt §21).
4. Owner: media rights, shipping, legal, COD enable, Production promote.
