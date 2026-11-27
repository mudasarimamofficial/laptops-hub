# 11 — Release and production evidence

Every PR was merged with `gh pr merge --merge` only after the GitHub `quality` check (typecheck, lint, unit, build) passed. The production deploy for each merge commit was checked through the GitHub commit status from Vercel ("success" = deployment completed/READY).

| PR | Topic | Merge commit | Vercel production deployment | State |
|---|---|---|---|---|
| [#107](https://github.com/mudasarimamofficial/laptops-hub/pull/107) | VIS-001/002a/003/004: map compositing, phone header, promo, phone map layout | `3296c9e` | `HJg5y5VZStTA6wWjX2Erp2rc2Nyd` | success |
| [#109](https://github.com/mudasarimamofficial/laptops-hub/pull/109) | VIS-005: mega-menu Help | `756c668` | `5AFT3tF4eWTPzVGGXWigqvoUXLtE` | success |
| [#108](https://github.com/mudasarimamofficial/laptops-hub/pull/108) | VIS-006: WhatsApp circle (rebased on #107) | `956899d` | `H5pCTPGu74nz5Vix165V17viSUqL` | success |
| [#110](https://github.com/mudasarimamofficial/laptops-hub/pull/110) | VIS-002b hero bleed; VIS-007/008 audit specs | `e2fa482` | `4y1MXZcQJnj3sKVAdV7TGHE5P8oZ` | success |
| [#111](https://github.com/mudasarimamofficial/laptops-hub/pull/111) | Filter accessibility (WCAG 1.4.3) | `4e4daac` | `DGEG9QrS2ZfR99eFKX4KqRLNGNC8` | success |

## Live production verification (read-only)

Method: GET page loads with a headless browser, real-geometry measurements, no forms, no cart, no sign-in, no writes.

| Check | After #107/#108/#109 | After #110 |
|---|---|---|
| 375×667: non-header points inside promo/header (load, 50/80/95/100% scroll) | 0 everywhere | 0 everywhere |
| 375×667: header background | `rgba(247,250,255,0.97)` | same |
| 375×667: map section | `relative`; iframe loaded; frame 307px; card 16px below, `relative` | same |
| 375×667: promo bar overflow | 0 | 0 |
| 1918×542: points in promo/header (load, middle, end) | 0 | 0 |
| 1918×542: map pinned | no (`relative`) | no |
| 1366×768: points in promo/header at load | **200** (hero decoration, VIS-002b) | **0** |
| 1366×768: after scrolling | 0 | 0 |
| WhatsApp at 390 | 56×56, merchant link | same |
| WhatsApp at 1366 | 201.75×52 pill, same link | same |
| Mega menu at 1366×768 | 9 groups, panel 458, Help bottom 491.5 < visible 503.5 | same |

After #111: `/collections/all` has 61 filter inputs, 0 dimmed, 0 disabled (every live option currently has products, so the new rule has nothing to disable today).

**SEO protection (read-only, live):**
- `/`: 200, canonical `https://www.laptopshub.pk`, `index, follow`, one H1.
- `/collections/all` and `/guides`: 200, canonical, one H1.
- `/compare`: `noindex, follow` (intended).
- `sitemap.xml`: 279 URLs. `robots.txt` unchanged (admin/API/order/checkout/cart/track disallowed).

## Not touched

- Production database: no migration, no data change.
- Orders, customers, COD, the 5% storewide discount, product media, testimonials, Search Console, DNS, domain routing, the Hostinger CRM, environment variables, secrets.
- The 45 applied production migrations are unchanged.
