# 05 — Theme editor: what exists, what changed, what is next (2026-11-24)

## Architecture (verified in code)
- **Admin UI:** `/admin/online-store` (`src/components/admin/homepage-section-editor.tsx`) — section list (order, hide/show),
  per-section settings, desktop/tablet/mobile preview frame, full-page staff preview (`/preview/homepage?v=draft|published|default`),
  Save draft, Publish, version history with Restore.
- **Storage:** `theme_templates` (key `homepage`), `theme_versions` (one `working-draft`, immutable `published` snapshots),
  `theme_publications` (pointer to the live snapshot). Writes go through SECURITY DEFINER RPCs (`save_homepage_draft`,
  `publish_homepage_theme`, `rollback_homepage_theme`) that check the staff role; customers read only
  `get_published_homepage_sections()` (no access to drafts).
- **Rendering:** the real V5 storefront components render both the public page and the staff preview (`HomePageView`),
  so the preview is the actual page, not a mock-up.
- **Cache:** public homepage ISR 60 s; publish/rollback expire the `homepage-theme` tag and `/`.
- **Roles:** owner/admin/editor can edit and save drafts; only owner/admin can publish or restore.

## Changed in this release (`feat/theme-editor-live-publish-copy-2026-11-24`)
| Change | Before | After |
|---|---|---|
| Going live | Publish had no customer-visible effect unless a developer set `THEME_PUBLISHED_ENABLED=1` in Vercel (never set; 0 publications in production) | Publishing is the merchant's switch. `THEME_PUBLISHED_DISABLED=1` is a developer emergency off switch |
| Editable copy | Only hero/story images + products, reviews and map text | +46 copy fields: every V5 section's kicker, heading, intro and button text/link (hero, story, Chromebook, brands, featured, promo, specs, new generation, budget, compare, inquiry) |
| Defaults | n/a | Empty field = approved V5 text (shown as the placeholder); "Reset to default" per field; defaults are not copied into the draft, so future default improvements still apply |
| Safety | n/a | Plain text only (React-escaped), length caps, control characters stripped, links limited to site paths, `#section`, `https://`, `tel:`, `mailto:` — checked in the editor, on save (400) and again at render (fallback to default) |
| Concurrency | Last save silently won | Each save carries the draft fingerprint it was based on; a newer draft by someone else → 409 and an explicit "overwrite?" choice |
| Inquiry phones | Hard-coded constant (hidden) | Same list as the footer, from Settings → Contact & social |

## Acceptance evidence (isolated stack: local Supabase + `next start`, no theme env flag)
`tests/e2e-isolated/p1-theme-copy-publish.spec.ts` — 4/4 passed:
1. Unsafe button link (`javascript:`) refused on save (400, message names the field).
2. Owner edits hero line 1, main button text + link and the brands heading in the editor UI → Save draft → logged-out
   homepage unchanged → staff draft preview shows all three edits.
3. Stale editor: second save with an old fingerprint → 409 `draft_conflict`; explicit overwrite → 200.
4. Publish in the UI → logged-out homepage shows the new heading, button text, button link and brands heading →
   Restore previous version → homepage back to the previous text.
Regression: `p1-theme-ordering-preview` (reorder/hide/preview/publish/rollback, editor fit at 1024/1280/1440 px) and
`p1-storefront-labels`, `home-inquiry` — see `18_FINAL_PRODUCTION_EVIDENCE.md` for the run table.

## Phase 2a — site-wide header & footer copy (`feat/theme-phase2-global-copy-2026-11-24`)
- **Storage, no migration:** `theme_versions.theme_settings.globals` of the homepage theme. The publish RPC already
  copies `theme_settings` into the immutable snapshot, so header/footer text gets draft → publish → restore for free.
- **Latent bug fixed:** the draft API never sent `theme_settings`, and `save_homepage_draft` replaces it wholesale
  (`COALESCE(payload->'theme_settings','{}')`), so any stored theme settings were wiped on every save. The API now always
  sends the stored object, replacing only `globals` when the request carries them. Older clients (sections only) keep
  the stored text (tested).
- **Registry:** `src/lib/content/theme-globals.ts` — 11 fields in three groups (Header & menu: menu button, search text
  ×2, mega-menu "all products" label, second link label + link; Footer: description, contact heading, WhatsApp button;
  Promotion bar: button label + link). Defaults are the approved V5 text; plain text only, length-capped, links validated
  by the same rules as homepage buttons; unknown keys dropped on save.
- **Read path:** `getPublishedThemeGlobals()` (service role, server only, cached 60 s under the `homepage-theme` tag)
  → storefront layout → header, footer, promotion bar on **every** page. Publish/restore now also expire the whole
  layout (`revalidatePath("/", "layout")`).
- **Count text kept honest:** "View all N products →" and the drawer "NEW" badge only appear while the label/link are
  at their defaults, so a renamed link never inherits a count or "NEW" claim it was not written for.
- **Nav behaviour by id (LH-009):** "Guides" hiding, the Support link destination and the active state now key off the
  navigation ids `h-guides` / `h-support` (label fallback for links saved without an id), so renaming a link in
  Navigation keeps its behaviour.
- **SEO title suffix (LH-010):** Settings → "SEO title suffix" now drives the page-title template
  (`"%s " + suffix`); empty keeps the V5 `"%s · Laptops HUB"`. Production value is empty (checked read-only), so titles
  do not change on deploy.
- **Editor:** "Header & footer · All pages" entry above the section list; same input/Reset/validation UI as section copy
  (shared `CopyInput`). Also fixed a race where clicking a panel before the draft finished loading was reset to the
  first section.
- **Known limitation:** the full draft preview renders the live header/footer (the storefront layout must stay static),
  so header/footer edits are seen in the editor fields and on the live site after publishing. Stated in the panel.

### Phase 2a acceptance (isolated, `p2-theme-globals-publish.spec.ts`, 3 tests)
unsafe link refused (400) · save without `globals` keeps stored text · owner edits 4 fields + invalid link + Reset →
draft survives reload → public `/collections/all` unchanged → publish → footer description, WhatsApp button, search
label and mega-menu link change on a non-home page → restore → original text back · SEO suffix changes `<title>`, empty
restores the V5 template. Screenshots: `docs/evidence/theme-globals/`.

## Phase 2b — page-template copy (`feat/theme-phase2b-page-copy-2026-11-24`)
- Same storage and workflow as 2a (`theme_settings.globals`, draft → publish → restore), 25 more fields in three new
  editor entries under **Site-wide text**: **Product pages** (spec and description headings/kickers, the "being prepared"
  note, three policy-link labels and their small text, related heading with a `{brand}` token, "View all"),
  **Collection pages** (no-matches heading/message/buttons, Load more, empty-Chromebooks heading/message/ask button),
  **Page not found** (page and product 404 headings/messages, button label and link).
- Deliberately **not** editable: prices, stock, variant options, buy/cart/WhatsApp buttons, specification rows, product
  descriptions, policy page destinations (labels only), the "What each listing shows" list (it describes listing
  content), filter/sort controls.
- All three 404 entry points read the published text (root `app/not-found.tsx` for unmatched URLs, the storefront
  404 and the product 404). Root 404 title now follows the SEO title suffix too.
- Render modes unchanged (`/`, `/_not-found` static; product/collection already dynamic with ISR data).
- Acceptance: `p2b-theme-templates-publish.spec.ts` (isolated) — owner edits 6 fields across the three panels, unsafe
  button link refused with "Page not found → Button goes to", Reset, draft private, publish → product page, collection
  no-matches, page 404 (status 404) and product 404 show the edits with `{brand}` substituted → restore → V5 text.
  Screenshots `docs/evidence/theme-templates/`.

## Phase 2c — product page layout + representative product preview (`feat/theme-phase2c-product-layout`)
- **Model** `src/lib/content/theme-layout.ts`, stored in `theme_versions.theme_settings.layout` (same draft → preview →
  publish → restore → version history as the homepage; no migration). Every value is normalised on read: unknown ids
  dropped, duplicates ignored, missing sections appended, unsupported counts → default, so a corrupt value can never
  break a product page. The API validates (`themeLayoutProblems`, 400) and stores only non-default layouts.
- **Controls** (Online Store → Page layout → *Product page layout*): order and visibility of *Specifications & about*,
  *Customer reviews*, *Related products*; key-spec tiles on/off; policy links on/off (only approved public policies ever
  show); related products 4 or 8. **Locked:** gallery, title, price, variants, quantity, Add to cart / WhatsApp /
  compare — business logic untouched. Hiding reviews also removes `aggregateRating` from the product JSON-LD.
- **Preview** `/preview/product?v=draft|published|default` (staff only, 404 for everyone else, never cached) picks a
  representative in-stock listing; `/preview/product/<handle>` previews any listing. The editor's preview frame and
  "Open full preview" follow the selected panel (product copy or product layout → product page).
- **Concurrency:** the draft fingerprint covers all theme settings, so a second editor gets the existing 409 conflict.
- **Refactor:** the product template is `ProductPageView`, shared by the live page and the preview.

### Phase 2c acceptance (isolated, `p2c-theme-product-layout.spec.ts`, 2 tests + unit `theme-layout.test.ts`)
Owner reorders/hides in the UI → saves → public page unchanged → staff preview shows the draft (`preview-draft.png`)
→ anonymous preview 404 → publish → public page follows (buy box present) → restore → V5 layout back. Tampered layout
→ 400; anonymous write → 401/403. Evidence: `docs/evidence/theme-product-layout/`.

## Phase 2c+ — not built yet (honest gap list)
1. (done above: header/footer 2a, product/collection/404 labels 2b)
2. **Content page template**: editable kicker/intro per page (today only title/body are editable).
3. **Product page template**: layout done in 2c; still to do: reviews block wording and buy-box microcopy — never
   price/stock/cart logic.
4. **Cart/compare/search-overlay templates**: headings and microcopy (collection and 404 done in 2b).
5. **Theme settings**: validated colour tokens and typography presets with contrast checks (V5 tokens as defaults).
6. **Collection page layout** (filters/sort defaults, grid density) and a **template selector** for content/blog pages;
   representative *product* preview is done (2c), collection preview not yet. Same draft/publish/
   rollback tables (new `theme_templates` keys — requires a small additive migration and owner approval to apply).
Each needs its own isolated acceptance run like the one above before it is called complete.
