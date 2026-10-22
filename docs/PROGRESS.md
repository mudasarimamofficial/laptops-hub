# Progress log

## 2026-10-22 — V5 reconstruction (`fix/v5-correctness-parity`)

### Done
- Phase 1 correctness patch applied and verified; fixed two pre-existing `useSyncExternalStore` render loops (compare + cart stores broke as soon as anything was added).
- Fonts: tokens resolved invalid (mono/display never applied). Self-hosted V5 weights, literal family names, V5 fallback chains.
- V5 data adapter + taxonomy map; data parity 226/226, 0 mismatches, identical catalog order.
- Ported 1:1 from the V5 source: header (mega, search overlay, mobile menu), footer, toast, product card, all 10 homepage sections (hero, pinned four-angle story, Chromebooks, brands, featured, promo, spec, newer generations, budget, compare demo), collection/search view with server-side facets, PDP, cart page, cart drawer, compare page, 404.
- Parity harness (`scripts/visual/capture.mjs`): reference vs Next at 11 viewports incl. interaction states; report `docs/V5_PIXEL_DIFF_REPORT.md`. Home hero/story 0% at all 11 viewports; every ported template ≤0.4%.
- SEO: sitemap (268 URLs), robots (sitemap, private paths disallowed), canonical URLs, product JSON-LD from verified fields, filtered/search pages noindex, admin noindex, approved meta description.
- Route check: 226/226 PDP 200, 6/6 drafts 404, 39/39 collections 200.

### Found
- `laptops-hub.vercel.app` (Production) is public and serves the pre-parity `ea652f2` build (owner dashboard redeploy). COD there returns 403.

### Remaining
- Port content/FAQ/contact/guides templates.
- Owner: media rights (cutouts + catalog photos), shipping, legal, contact facts, staff bootstrap, production-domain decision.

## 2026-10-21 — Phase 1 correctness patch (`fix/v5-correctness-parity`, from `ea652f2`)

Prepared in Claude Design as a patch set; must be applied, checked and pushed from a machine with the repo (see `APPLY.md` in the patch). Not yet committed, built or deployed.

### Implemented
- Related products load ordered media (one batched media query; no N+1).
- `PublicProduct.available` + `canPurchase()`; cards / PDP / AddToCart only offer cart controls when purchasable; V5 "Ask about this product" dialog posts to `/api/contact` otherwise.
- V5 compare tray (thumbnails, names, per-item remove, Clear all, Compare); new `/api/catalog/compare-summary`; stale/private handles pruned; hidden on cart/compare/checkout/pages/guides/admin, when drawer open, and over `#story`.
- Curated PDP + compare specs (`curateSpecs`); generated spec paragraph hidden from descriptions.
- Public boundary: internal spec key labels renamed/dropped (`toPublicSpecs`), import QA flags removed from `tags` (`publicTags`), descriptions filtered, before data reaches client components or API JSON.
- Cart honours `max_per_order` (store, drawer, cart page, card, PDP, story); legacy lines fall back to the DB hard cap 20.
- `scripts/import-catalog.mjs`: syntax error in `loadEnvLocal` fixed; importer no longer writes the internal-label spec paragraph. **Not run.**
- Unit tests: `specs`, `availability-handles`, `cart-limits`. E2E: `tests/e2e/v5-correctness.spec.ts`.

### Awaiting owner
- `docs/proposals/AVAILABILITY_INQUIRY_ONLY.md` (RLS/view change; not applied).
- `docs/proposals/DESCRIPTION_CLEANUP.md` (3 intro texts with CRM wording + 171 stored generated paragraphs; reversible SQL; not applied).
- Media approval (all `pending`; not changed).

---

## 2026-10-21 — V5 parity sprint (header / hero / card / search / cart)

### Recovered
- Working tree had deleted the entire Next.js app; restored from `feat/v5-storefront-admin` @ `0a12238`.
- Frozen V5 export under gitignored `reference/v5/`.
- Relinked Vercel project `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`; pulled `.env.local` (quotes stripped).
- Supabase project `xvmmjkrkgznnakcobmww` confirmed ACTIVE.

### Implemented
- Layered cinematic hero (V5 geometry, parallax, scroll `--hp`, three catalog product layers, price tag, chips).
- Search overlay + `/api/catalog/search`; header opens overlay (not bare `/search` link).
- Mobile drawer (V5-style) + desktop nav breakpoint ~1180px; header 72px + saturate blur.
- Product card fidelity to `ProductCard v5.dc.html` (stage, chips, compare, ATC).
- Cart slide-out drawer matching V5 chrome.
- Env loaders strip quoted Vercel env values; P0 probes **9/9**.
- Playwright visual smoke **8/8**; evidence in `docs/visual-evidence/`.
- Parity matrix: `docs/V5_VISUAL_PARITY_MATRIX.md`.

### Still partial / blocked
- Cutout PNGs + `stage.png` not published (media rights) — catalog CDN stand-ins.
- Full pixel-diff vs reference HTTP server not yet automated end-to-end.
- COD still disabled; Production promote blocked on owner gates.

---

## 2026-10-21 — Vercel 404 recovery (Preview restored)

### Root cause
- Vercel project Framework preset was **Other** with Output Directory **`public`**, so READY deployments served no Next.js app root → platform `NOT_FOUND` on aliases/URLs.
- GitHub bot linked “Preview” to Production hostname `laptops-hub.vercel.app` (misleading).

### Fix
- `vercel project update --framework nextjs` + clear output directory
- `vercel.json` framework nextjs; Tailwind v4 `postcss.config.mjs` + `@tailwindcss/postcss`
- `.vercelignore` so CLI deploys do not upload local archives (100MB+ failure)

### Verified Preview
- URL: https://laptops-qi1nix9ah-mudasarimamofficial-gmailcoms-projects.vercel.app (`dpl_1oui2NALZxJF6vXi2fpjZHurWJP8`, `9b24eae`)
- Routes smoke: `/` + collections + product + search/compare/cart/checkout/admin/login = 200; `/admin` = 307 login; COD API disabled
- Production alias left untouched (no `--prod`)

---

## 2026-10-21 — RC hardening (financial, CMS, catalog, roles)

### Financial integrity
- `record_cod_collection(jsonb)` — FOR UPDATE, over-collection reject, idempotency key, events+audit atomic
- `transition_order_status(jsonb)` — locked transitions + stale `expected_from_status`
- Concurrency script: **6/6** (`docs/COD_CONCURRENCY_RESULTS.json`)

### CMS security
- `isomorphic-dompurify` allowlist sanitizer + XSS unit tests
- `legal_approved` separated from editorial `status`; editors cannot publish legal pages

### Catalog
- `public_catalog_listing` view; full paginated filter/sort; collections page through entire catalog
- Pagination proof: **5/5** (226 public; last page of price sort discoverable)

### Variants / media
- Product PATCH requires `variantId` for price; ownership check
- Unverified Dell cutouts removed from public tree (`docs/MEDIA_RIGHTS_CUTOUTS.md`)

### Auth
- Role matrix with ephemeral users: **15/15** (`docs/SECURITY_ROLE_MATRIX_RESULTS.json`)
- Anonymous auth matrix + P0 still green

### Visual
- Playwright specs + evidence dir prepared; Chromium download flaky on network — screenshots pending completion

---

## 2026-10-21 — V5 storefront + merchant mutations (`feat/v5-storefront-admin`)

### Storefront
- Cinematic hero (intro / skip / reduced-motion), pinned product story, brand/featured/budget/Chromebook/compare sections
- Mega-menu + mobile nav; floating compare tray (max 4); `/compare`
- Collections resolve from DB seed + matchers; search with brand/category/price/sort
- PDP gallery, compare toggle, related products

### Admin / COD ops
- Product list (search/paginate) + edit form → `PATCH /api/admin/products/[handle]`
- Order detail + status transitions + COD cash collection (explicit, audited)
- Content CMS for pending pages (`/admin/content`) — no auto-publish
- Shipping zone create (prior) retained

### Security / infra
- Migration `20261021150000` collections seed + `consume_rate_limit`
- Migration `20261021151000` pending content page seeds
- Auth matrix: **24/24** (`docs/SECURITY_AUTH_MATRIX_RESULTS.json`)
- P0 probes still **9/9**; build + unit tests pass
- COD checkout remains disabled

### Next
1. Owner staff bootstrap → browser role E2E
2. Playwright visual vs V5 reference viewports
3. Wire approved `lh-content.js` into CMS publish flow
4. Preview RC deploy of this branch; still no `--prod`

---

## 2026-10-21 — P0 security (admin authorization)

### Fixed
- `requireStaff` / `requireStaffPage` on all privileged admin routes before service-role reads
- Middleware staff membership check (defense in depth)
- Column grants: anon/authenticated cannot select inventory or internal product ops columns
- Order confirmation via narrow RPC; contact rate limit + honeypot
- Docs: `SECURITY_P0_REVIEW.md`, `ADMIN_ROLE_MATRIX.md`

### Verified
- `npm run test:security:p0` → **9/9**
- `npm run test:unit` → pass
- `npm run build` → pass
- Public nested catalog select still works

### Not done (next)
- Browser E2E non-staff vs staff against `/admin/*`
- Owner bootstrap of `admin_memberships`
- V5 parity, COD UX, full admin mutations

---

## 2026-10-21 — Phases 0–2 (foundation)

### Phase 0
- Read master bible; audited ZIP/docs/CSV/catalog.
- Verified GitHub / Supabase / Vercel IDs (no duplicate projects).
- Wrote `docs/00_FORENSIC_AUDIT.md`.
- Linked Vercel + Supabase; expanded `.gitignore`.

### Phase 1
- Scaffolded Next.js 16 (App Router, TS, Tailwind 4) at repo root.
- Authored `supabase/migrations/20261021120000_init_laptops_hub.sql` (catalog, COD orders, RLS, `create_cod_order`).
- Applied migration to remote Supabase successfully.
- COD checkout API + Zod validation; checkout **disabled** by default.
- Admin routes + middleware session gate.

### Phase 2
- `scripts/import-catalog.mjs` dry-run + live import: **232 upserted, 226 active, 6 drafts, 964 media, 0 errors**.
- Evidence: `docs/IMPORT_RECONCILIATION.md`.

### Storefront (partial Phase 3)
- Tokens, header/footer wordmark, home, collections, PDP, cart, checkout UI, search, pending content pages.
- Cinematic hero/story parity: deferred (structure ready; cutouts in local `reference/`).

### Tests
- `npm run test:unit` pass (money, phone).
- `npm run build` pass.

### Deploy
- Pushed sanitized `main` to GitHub (no CSV/secrets/catalog JS).
- Vercel env configured (Supabase URL/anon/service + COD flags=false).
- Preview READY: `https://laptops-drtmlkjt9-mudasarimamofficial-gmailcoms-projects.vercel.app` (project ID verified).
- **No production promote** performed.

### Next engineering
1. Port cinematic hero + pinned scroll story from `reference/v5`.
2. Compare tray, search overlay, CMS content from `lh-content.js`.
3. Admin mutations (status transitions, COD collection action, shipping zone editor).
4. Playwright E2E + visual diffs; RLS negative tests.
5. Owner: shipping zones, staff UID, policies, media rights → then enable COD carefully.

### Blockers (owner)
- Shipping/COD fees, contact, legal pages, media rights, draft reviews, first admin user.
- Explicit go-live before `vercel --prod`.
