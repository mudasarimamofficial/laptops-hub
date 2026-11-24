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

## Phase 2 — not built yet (honest gap list)
Shopify-style "Online Store → Themes → Customize" across templates needs, in order of merchant value:
1. **Global/footer/header settings**: footer tagline and headings, WhatsApp link label, announcement link, header
   "Laptops" trigger label; nav behaviour keyed by link id instead of label (LH-009).
2. **Content page template**: editable kicker/intro per page (today only title/body are editable).
3. **Product page template**: section labels (Specifications, About this listing, More from brand), policy link labels,
   section order/visibility — never price/stock/cart logic.
4. **Collection/search/cart/compare/404 templates**: headings and microcopy.
5. **Theme settings**: validated colour tokens and typography presets with contrast checks (V5 tokens as defaults).
6. **Template selector + representative product/collection picker** in the editor, using the same draft/publish/
   rollback tables (new `theme_templates` keys — requires a small additive migration and owner approval to apply).
Each needs its own isolated acceptance run like the one above before it is called complete.
