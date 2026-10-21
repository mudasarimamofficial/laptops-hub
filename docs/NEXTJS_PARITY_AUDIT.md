# Next.js app vs V5 prototype: parity audit

Date: 2026-10-21 · Repo `mudasarimamofficial/laptops-hub` @ `feat/v5-storefront-admin` (`ea652f2`).
Status key: **FIXED (patch)** = implemented in `patches/fix-v5-correctness-parity/`, not yet committed or run in the repo. **BLOCKED** = needs DB access or owner decision. **WITHDRAWN** = audit finding was wrong.

## 0. Architecture (RESOLVED 2026-10-21: owner confirmed Next.js + Supabase + Vercel; no Shopify theme)
- The repo's `docs/DECISIONS.md` #1 says the store is an **independent Next.js + Supabase + Vercel COD store, not Shopify**. Shopify is used for CSV import only.
- The 2026-10-21 brief in this project asked for a **Shopify OS 2.0 theme** on `laptopshub-2.myshopify.com`.
- These are two different products. Owner must pick one. This audit assumes the repo's Next.js direction.

## 1. Infrastructure
| Item | Status |
|---|---|
| Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` | Verified: `laptops-hub`, owned by `mudasarimamofficial-gmailcoms-projects`. Last 5 deployments are Preview from `feat/v5-storefront-admin`, all READY. Latest `dpl_BBcNPjatc8S1AFkxVWwKqDpeb765`. |
| Supabase `xvmmjkrkgznnakcobmww` | **Not reachable from this session** (connected account lists 0 projects; permission denied). Repo has 6 migrations (2026-10-21). Repo docs report import 232 / 226 / 6 / 964. Not independently verified. |
| GitHub | `main` + `feat/v5-storefront-admin`. Work is on the feature branch. |

## 2. Homepage section order
V5: 01 Hero → 02 Product story → 03 Chromebooks → 04 Brands → stock grid → promo → new-generation carousel → compare demo.
Next.js: Hero → Story → Brands → Featured → Budget → Chromebooks → Compare teaser → pending policies block.

| # | Gap | Severity |
|---|---|---|
| H1 | Chromebooks section is 6th, V5 has it 3rd (directly after story) with the scroll-linked `--cp` parallax. Next.js version is static. | High |
| H2 | New-generation carousel (scroll-snap row + prev/next buttons, `/collections/gen-10-plus`) is missing. | High |
| H3 | Compare demo (dark two-column spec table on home) replaced by a text teaser. | Medium |
| H4 | Promo tile (16/11 framed image) missing. | Medium |
| H5 | "Shop by budget" section is not in V5. Its blurbs ("Everyday machines for study and work" etc.) are new marketing copy. | Medium (content rule) |
| H6 | Brand tiles are text-only. V5 brand cards carry a product image (`LHImg`, multiply blend). | Medium |
| H7 | Hero `stockText: "In catalog"` and Chromebook blurb ("Specs that are not yet owner-verified stay blank…") are internal/meta wording on a public page. | Medium |

## 3. Product card (`product-card.tsx` vs `ProductCard v5.dc.html`)
Geometry, type scale, chips, price block, compare toggle: match.
| # | Gap | Severity |
|---|---|---|
| C1 | **FIXED (patch) / DB part BLOCKED.** No sold-out state. V5 shows "Ask about availability" (inquire) when `soldOut`; Next.js always shows Add to cart. `purchasable` is read in `mapProduct` but listing rows (`mapListing`) never check it. | High |
| C2 | **WITHDRAWN.** V5 badge is also the category (ProductCard v5: "Category badge (no inventory/stock wording by design)"). | — |
| C3 | **Partly withdrawn.** V5 also shows "Condition not listed". The "Brand" fallback is not in V5. Open, low priority. | Low |
| C4 | **FIXED (patch).** `listRelatedProducts` returns cards with no images (`mapListing(r)` without media). | High |

## 4. Collection page
| # | Gap | Severity |
|---|---|---|
| L1 | No filter panel / mobile filter drawer, no sort control. The API (`filterPublicProducts`) already supports brand/category/price/sort. | High |
| L2 | No breadcrumb and no ice/radial header band. | Medium |
| L3 | Description line reads `{description} · {n} products`. Fine, but grid is 4-col at xl; V5 uses `cardGrid` (auto-fill min 240px). | Low |

## 5. Product page
| # | Gap | Severity |
|---|---|---|
| P1 | No breadcrumb (Home / Brand / Model). | Medium |
| P2 | Gallery lacks prev/next buttons, counter pill, swipe. | Medium |
| P3 | No quantity stepper (V5: 54px pill −/+). | Medium |
| P4 | **FIXED (patch).** Spec table prints raw `specs` keys (lower-case, up to 16, incl. internal keys if present). V5 shows a curated, labelled set. | High |
| P5 | Line "Cash on Delivery · pay when delivered" is a payment claim; confirm owner approval. | Medium (content rule) |

## 6. Compare, cart, tray
| # | Gap | Severity |
|---|---|---|
| K1 | **FIXED (patch).** Compare tray prints raw handles (`dell-latitude-7420-core-i5-…`). V5 tray shows 44×33 thumbnails + model names. | High |
| K2 | Compare page: no product images in headers, no Add to cart per column. Raw spec keys **FIXED (patch)**. | Medium |
| K3 | Compare page fetches products one by one in sequence (4 round-trips). | Low |
| K4 | Cart page: no line images, numeric input instead of −/+ stepper, max 20. Drawer and PDP use `maxPerOrder`. Inconsistent limits. | Medium |
| K5 | Cart page copy "Browser cart is a convenience cache only…" is developer wording. | Low |

## 7. Header / footer / global
| # | Gap | Severity |
|---|---|---|
| G1 | Footer tagline "Independent Pakistan electronics retailer… Business policies pending owner approval." is not V5 copy. Company description should come from approved content or be hidden. | Medium |
| G2 | Homepage ends with a visible "Policies & store contact" pending block. V5 keeps pending blocks on the relevant pages only. | Low |
| G3 | Sora loaded at 600–800, V5 uses 500–700. Hanken 800 missing (V5 loads 400–800). | Low |

## 7b. Data-quality findings (added in Phase 1)
| # | Finding | Status |
|---|---|---|
| D1 | **Corrected: 3/232** `intro` texts contain internal CRM wording (the earlier "96" came from a filter bug, now fixed). They are shown on PDPs and in the V5 prototype. | **BLOCKED**: owner wording (`docs/proposals/DESCRIPTION_CLEANUP.md`) |
| D2 | 171 `description_safe` values end with a generated "key: value" paragraph that includes internal labels. | **FIXED (patch)**: display filter and importer; stored rows need the optional cleanup in the proposal |
| D3 | All `product_media.approval` = pending; public RLS ignores approval. | **BLOCKED**: owner/media-rights decision |
| D4 | `scripts/import-catalog.mjs` `loadEnvLocal` has a syntax error (`if (…) let v = …`). | **FIXED (patch)**, not run |
| D5 | Cart store caps qty at 20, `max_per_order` is 5 (server rejects excess). | **FIXED (patch)**: limit carried on cart lines; legacy lines fall back to 20 |
| D6 | Import QA flags (`CONFIG_REVIEW`, `IDENTITY_REVIEW_SOFT`) stored in `tags` of 2 active products; serialised into page HTML via client components. | **FIXED (patch)** in app payloads; still readable via Supabase REST (grant change needs approval) |
| D7 | Internal spec key labels (`Memory (CRM config)`, `… (source reference)`) in client payloads and `/api/catalog/product`. | **FIXED (patch)** via `toPublicSpecs`; raw column still readable via REST |

## 8. Already correct (no action)
Tokens (`tokens.css` = V5 values), red HUB wordmark, 72px blurred header, no inventory/stock counts in public UI, drafts excluded (`status = active`), Chromebook collection uses the real HP Chromebook 14 G5, COD disabled, no Production promote.

## 9. Fix order (Phase 1 = step 1, on `fix/v5-correctness-parity`, Preview only)
1. C1, C4, K1, P4: correctness and data exposure.
2. H1, H2, L1: largest visual and functional gaps.
3. H5, H7, G1, P5, K5: remove unapproved or meta copy.
4. Remaining Medium/Low.
Each step: build, unit + P0 tests, Preview deploy, screenshot vs V5 at 1440 / 768 / 390.

## Not verified
Supabase data (no access), patch not compiled or run in the repo, live Preview rendering (no browser run against the deployment), admin flows, header/search/cart-drawer/hero source (not read in this pass).
