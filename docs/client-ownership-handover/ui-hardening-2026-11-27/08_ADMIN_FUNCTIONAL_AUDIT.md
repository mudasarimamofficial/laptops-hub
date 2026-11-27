# 08 — Admin functional audit

No admin code was changed in this pass. The admin was re-verified on the isolated stack as part of the full run on main `4e4daac`, to prove the storefront CSS and markup changes did not leak into it. Totals are in `10`.

| Area | Spec / script | What it proves |
|---|---|---|
| Admin on phones | `admin-mobile-matrix` (4), `admin-mobile-shell` (2) | Sign-in screens at 320/390. Every staff route for the owner at phone sizes. Product/order cards. Settings save bar reachable. Nav drawer; Escape closes it; no page overflow |
| Admin vs storefront separation | `p0-admin-isolation-and-checkout-gates` (6) | The admin shows no storefront header, promo bar or WhatsApp button at any width; the storefront keeps its chrome; readiness matrix and checkout gates |
| Roles | `node scripts/security-role-http-isolated.mjs` | HTTP role matrix (owner/manager/staff/anonymous × admin routes and APIs); see `10` |
| Catalogue, media, collections, specs, import, SEO | `p0-*`/`p1-*` merchant specs | Unchanged behaviour (full list in `10`) |
| Content and theme | `p1-content-revisions-g19`, `p1-theme-*`, `p2*-theme-*` | Draft/publish/rollback, page history (G19, live since 2026-11-27) |
| Orders, COD ledger, notifications | `z-owner-acceptance-36-steps`, `p1-cod-ledger-g22`, `p1-notifications-g24` | Order desk to cash recorded; notifications once |

**Production admin:** not signed in (read-only rule). The only live check was that `/admin` redirects anonymous visitors to sign-in (earlier pass, unchanged).

**Defects found in the admin in this pass:** none.
