# 22 — Admin self-service matrix: what the owner can change without code (2026-11-24)

**Method:** read-only code audit. No source files were edited, no server or test was run, no database was queried.
**Scope:** every page under `src/app/(admin)/admin/` and every route under `src/app/api/admin/`. Each control was traced
UI → `fetch` → API schema → DB write or RPC → storefront reader → cache tag or path.
**Code baseline:** working tree at `c5485fe` (branch `fix/whatsapp-contrast-lh026-2026-11-24`). These files had
uncommitted edits during the audit, so their line numbers may move by a few lines:
`src/app/(storefront)/products/[handle]/page.tsx`, `src/app/api/admin/theme/homepage/route.ts`,
`src/lib/catalog/v5-model.ts`, `src/lib/content/published-homepage.ts`.

**Already recorded, not repeated here as new findings:** LH-001…LH-026 in `02_DEFECT_REGISTER_AND_GAPS.md` and the
Phase 2c+ list in `05_THEME_EDITOR_SPEC_AND_ACCEPTANCE.md`. That covers the homepage editor, header/footer/promo-bar copy,
product/collection/404 labels, the SEO title suffix, the mega-menu and mobile drawer (LH-009), the empty sections (LH-011),
code-only cart/compare/checkout microcopy (LH-012) and the COD go-live gate (LH-017). Where a new finding refines a known
item, the item ID is given.

**Path abbreviations:** `A/` = `src/app/(admin)/admin/`, `API/` = `src/app/api/admin/`, `SF/` = `src/app/(storefront)/`,
`C/` = `src/components/`, `L/` = `src/lib/`, `M/` = `supabase/migrations/`.

**Evidence marks:**
- **V** — re-checked directly against the code. For the zod cases, this means running the project's own zod 4.6
  (`z.string().uuid().optional()` rejects `""`; `z.string().datetime()` rejects `+00:00`).
- **T** — traced by code reading during this audit but not independently re-run.
- **NOT VERIFIED** — could not be traced to a conclusion.

### Cache facts that apply throughout
- Home, products, collections, `/cart`, `/compare` and `/track-order` are ISR with a 60-second revalidate.
- `/pages/*`, `/guides/*`, `/checkout` and `/search` are dynamic.
- A save that does not revalidate is therefore a delay of 60 seconds or more, not a permanent miss. The exception is
  checkout, which reads the database live, so a delay there means the storefront and checkout can disagree.

---

## 0. Status of the P0/P1 gaps (updated 2026-11-25)

The audit text below is kept as written on 2026-11-24. This table records what has happened since. "Live" means
merged to `main` and deployed to production by Vercel; every fix was first proven on the isolated stack.

| Gap | Status | Where |
|---|---|---|
| G01 Discount create · G02 write guard · G03 stock overwrite | **FIXED, live** | PR #77 (LH-027, LH-028) |
| G04 Laptop specs and condition | **FIXED, live** | PR #82 (LH-033): Admin → product → *Specifications* |
| G05 Collection management | **FIXED, live** | PR #83 (LH-034): title, description, visibility and search text for merchant collections; built-in collections say what applies and take search text only. There is still no delete (hide instead). |
| G06 Draft activation · G07 Sell switch | **FIXED, live** | PR #77 (LH-029) |
| G08 Discount cache · G09 dated re-save · G10 fixed-amount units | **FIXED, live** | PR #77 (LH-027) |
| G18 Blog SEO fields | **FIXED, live** | PR #80 (search title, description, share image, dates) and PR #93 (2026-11-26): category, tags and template now show on the guide (chips), drive Article/NewsArticle `articleSection` and `keywords`, and filter `/guides?tag=` / `?category=` (filtered views noindex, canonical `/guides`). |
| G20 Site-wide SEO | **FIXED, live** | PR #80: homepage search appearance control and branded Organization / WebSite markup (see `seo-search/`). |
| G21 Order variant and saving | **FIXED, live** | PR #79 (LH-031) |
| G11 Brand/category free text | **FIXED, live (PR #84)** | Category is a select of the six storefront categories (an unrecognised stored value is kept and labelled); brand suggestions; saves fix the case of known names. Sub-type is still a code map (needs a data-model change). |
| G12 Collection rule vs pins | **FIXED, live** | PR #88 (2026-11-26): explicit manual / automated mode, merchant pin order, visible membership errors. |
| G13 Product media alt / primary / rights | **FIXED, live** (media migration: owner decision G13-M1) | PR #89 (2026-11-26): alt text edit (used publicly), set-primary, rights status, upload to a product. Moving the 964 Shopify-hosted images is a separate owner decision (`25`). |
| G14 Compare-at price | OPEN — **proposal ready, needs owner approval (G14-D)** | `27_G14_COMPARE_AT_PRICE_PROPOSAL.md` + mock. Not built, not deployed. 0 of 235 production variants have a compare-at value. |
| G15 Store details form unused | **FIXED, live (PR #84)** | Store details shows the Contact & Social identity read-only; Contact & Social is the single source. |
| G16 Inventory defaults unused | **FIXED (store-wide), live (PR #84)** | Inventory → Low uses the saved threshold (0 keeps the built-in 2, which production stores); Add product follows "tracked by default". Per-variant `low_stock_threshold` is still not read. |
| G17 Backup restore overwrites `cod_checkout` | **FIXED, live** | PR #84 (COD switch kept; restores work again) and PR #93 (2026-11-26): backup format v3 adds content pages (legal pages keep live text), reel product links and the published homepage theme; newer reel columns restored; notification settings kept live. |
| G19 Content page history / create / SEO | **PREPARED — code in draft PR #91; production migration `20261126160000` NOT applied** (owner decision G19-DB) | Plan: `26_G19_G22_PRODUCTION_MIGRATION_PLAN.md`. Proven on the isolated stack. |
| G22 COD collection corrections | **CODE LIVE (PR #90), production migration `20261126140000` NOT applied** (owner decision G22-DB) | Already live: collections are refused on cancelled or returned orders (409), and the collection form has its own note. Until the migration runs, reversal and correction show "available after the pending database update" and the adjust API answers 503. Plan: `26` §G22-4. |
| G23 Password change for editor / fulfillment | **FIXED, live (PR #84)** | Admin → *Your account* (every role), linked from the sidebar. |
| G24 Notifications env-only | **FIXED, live** | PR #92 (2026-11-26): Settings › Notifications (up to 5 staff recipients, customer copy off / test / on — "on" is owner-only, subject and intro wording, inquiry alerts), test-send button, recent delivery list. Falls back to the env address when nothing is saved. |
| G25 GET-time DB writes outside the write guard | **FIXED, live (PR #84)** | The one-time preset install returns without writing when the Preview→Production guard refuses. Production already has it installed. |

| G42 Dead code | **PARTLY FIXED, live** | PR #92: the notifications test route now has a button (Settings › Notifications). `src/lib/business.ts` (unused duplicate) is still in the tree. |
| G48 / LH-012 Storefront microcopy | **PARTLY FIXED, live** | PR #94 (2026-11-26): theme editor › *Cart & compare* (16 texts for the cart page, cart panel and compare page; draft → publish → rollback). Search, checkout, order pages, reviews, map, inquiry form and content-page labels are still code text. |
| G47 Cross-site origin checks | **FIXED, live (PR #96)** | One middleware check refuses cross-site POST/PUT/PATCH/DELETE on every `/api/admin/*` route (403 `forbidden_origin`); before, 31 of 42 write APIs relied on SameSite cookies only. |

**Counts now (2026-11-26):** P0: 5 of 5 fixed. P1: 17 fixed; G14 proposal awaiting approval; G19 and G22 waiting on owner-approved production migrations. P2: 21 open, 1 fixed (G47), 2 partly fixed (G42, G48).

## 1. Route-by-route matrix

The Gap column gives the issue IDs from §3 and their priority.

### Catalog

| Route | Controls | Saves? | Reaches storefront? | Evidence | Gap / priority |
|---|---|---|---|---|---|
| `/admin/products` | Search, status filter, bulk Set active / draft / archive / feature | **Partial.** Bulk writes `products.status` and `featured` only. | **Set active often does nothing visible.** Variants keep `purchasable=false`, and products with no purchasable variant are dropped. | `C/admin/product-selection.tsx:89-93` → `API/products/bulk/route.ts:47-57`; `L/catalog/queries.ts:65,86` (V) | G06 **P1** |
| `/admin/products/new` | Title, handle, price, brand, status, inventory mode, starting qty | Yes: `products` plus one variant | Only if active and price > 0. No specs or images at creation. | `C/admin/product-create-form.tsx:44-55` → `API/products/route.ts:84-134`, `:130` (V) | G04 **P0**, G11 P1 |
| `/admin/products/[handle]` | Title, description, status, featured, brand, type, category, SEO title and description | Yes | Title, description and status: yes. Category drives the V5 category only on an exact match. SEO is cut to 70/160 characters. | `C/admin/product-edit-form.tsx:120-136` → `API/products/[handle]/route.ts:8-30,98-118`; `L/catalog/v5-model.ts:83-85`; `L/seo/product-meta.ts:28-49` (T) | G03 **P0**, G07 P1, G11 P1, G34 P2 |
| ″ price / stock block | Price, inventory mode, quantity | Yes, but **always sends the stock count captured at page load.** It writes directly (no ledger, no expected-quantity check) and editors are allowed. | Yes | `product-edit-form.tsx:131-136`; `API/products/[handle]/route.ts:56,143-163` (V; no DB trigger guards it) | **G03 P0** |
| ″ variant matrix | Options, values, SKU, price, compare-at, mode, qty, Sell, Oversell | Yes, through the `sync_product_variants` RPC | Price and Sell: yes. **Compare-at: never rendered.** Qty is an absolute value from a client snapshot. | `C/admin/product-variant-matrix.tsx:151-173` → `API/products/[handle]/variants/route.ts:145-193` (T) | G14 P1, G03 |
| ″ media | Add URL and alt, reorder, remove | Yes | URL and order: yes. **Alt: not used** (gallery alt is built from the model name). No approve, set-primary or upload control. | `API/products/[handle]/media/route.ts:106-310`; `C/storefront/…/product-detail.tsx:48` (T) | G13 P1 |
| ″ danger zone, duplicate | Archive, soft delete, restore, duplicate | Yes | Yes | `C/admin/product-danger-zone.tsx:22-60`; `API/products/[handle]/duplicate/route.ts:88` (T) | G35 P2 |
| ″ *(no UI)* | Specs, condition, summary, tags, vendor, barcode, max per order, low-stock threshold | **No UI anywhere.** The API accepts `summary`, `tags` and `vendor`. | Specs feed spec chips, filters, the spec table, compare and menu counts. Without an editor they cannot be maintained. | `grep specs C/admin/*` → no writer; `L/catalog/v5-model.ts:83-128` (V) | **G04 P0** |
| `/admin/products/bulk` | Paste handles; status, price, featured per row | Partial: price goes to the first variant by `created_at`; variant errors are ignored | Partial, same problem as G06 | `C/admin/bulk-products-form.tsx:37-58`; `API/products/bulk/route.ts:63-85` (V) | G06 P1 |
| `/admin/products/import` | CSV, strategy, dry run, commit | Yes. Production commits are owner/admin only. | Yes, **except specs** (never mapped) | `API/products/import/route.ts:132-162`; `L/catalog/shopify-import-commit.ts:126-137` (T) | G04 **P0**, G27 P2 (nav shows Import to editors) |
| `/admin/products/export` | 5 CSV downloads | Read only | n/a | `API/products/export/route.ts:14-22` | G36 P2 (editors can export stock levels) |
| `/admin/inventory` | Filter, adjust or set count, reason, note | Yes: `adjust_inventory` RPC with expected quantity, audited, refreshes catalog | Yes (availability only) | `C/admin/inventory-adjust-form.tsx:28-31` → `API/inventory/adjust/route.ts:40-63` | G16 P1 (low-stock threshold hard-coded at 2) |
| `/admin/collections` | List | Read only | — | `A/collections/page.tsx` | G05 **P0** (no publish toggle, rename or delete; no DELETE route) |
| `/admin/collections/new` | Title, slug, description, manual or automated, rule seed, published | Yes | Title: yes. Description: in meta only. **Published can never be changed later.** Slugs that collide with `V5_COLS` are not reserved. | `C/admin/collection-create-form.tsx:20-60` → `API/collections/route.ts:59-124`; `C/storefront/collection-page.tsx:42` (T) | G05 **P0**, G44 P2 |
| `/admin/collections/[slug]` | Read-only description; rule builder; membership add, remove, reorder | Rules and membership: yes. **No form for title, description, published, SEO, image or sort**, although PATCH accepts them. | **For the 16 seeded slugs (laptops, dell, hp, chargers, under-40k, …) and any slug in `V5_COLS`, the code definition wins**, so admin edits are silent no-ops. Pin order is lost under the default "featured" sort. Adding rules to a manual collection with pins leaves `collection_type='manual'`. | `A/collections/[slug]/page.tsx:15-78` (V); `SF/collections/[slug]/page.tsx:35-41` (V); `L/catalog/v5-model.ts:142-184` (V); seed `M/20261021150000…sql:58-76` (V); `L/catalog/v5-collection.ts:46,75` (T) | **G05 P0**, G12 P1 |
| `/admin/media` | Upload store image and alt | Yes: `cms-media` bucket and `cms_media_assets` | Only through pickers (blog etc.). No copy-URL, delete or alt edit. | `C/admin/cms-media-upload-panel.tsx` → `API/media/upload/route.ts`; `A/media/page.tsx:44` (T) | G13 P1, G45 P2 |
| `/admin/merchandising` | Badge (product, kind, window); flame preset (enable, label, icon, restore, clear); social proof (activity, top seller, reels heading) | Yes | Yes: `product-badges`, `featured-flame-preset` and `social-proof` tags, plus the layout | `API/product-badges/route.ts:10-54`; `API/featured-flame-preset/route.ts:43-80`; `API/social-proof/route.ts:12-42` | G25 P1 (**the page render writes to the DB**, `A/merchandising/page.tsx:41`), G31 P2 |
| `/admin/reviews` | Status tabs; approve, reject, re-queue; note | Yes; revalidates `reviews` and the product path | Yes (approved only) | `C/admin/review-moderation.tsx:25-28` → `API/reviews/[id]/route.ts:18-38` | G37 P2 |

### Content and theme

| Route | Controls | Saves? | Reaches storefront? | Evidence | Gap / priority |
|---|---|---|---|---|---|
| `/admin/online-store` | Section order and visibility; 46 copy fields; images and alt; product handles; reviews and map settings; 36 site-wide fields; save draft, publish, restore | Yes: `save_homepage_draft`, `publish_homepage_theme` and `rollback_homepage_theme` RPCs | Yes: `homepage-theme` tag and layout path | `API/theme/homepage/route.ts:118-200`; `…/publish/route.ts:63,133-135`; `…/rollback/route.ts:57,87-89` | G28 P2 (editors see Publish and Restore and get a 403 after the draft is saved), G29 P2, G30 P2 |
| `/admin/online-store/preview` | Redirect to `/preview/homepage?v=draft` | — | Staff only | `A/online-store/preview/page.tsx:9-10` | Known: header and footer not shown in the draft preview |
| `/admin/content` | Title, status, legal approval, rich text, HTML source, template approval | Yes: `content_pages` | Title and body: yes; `content` tag and layout. **No SEO fields; the meta description is the code intro.** | `C/admin/content-edit-form.tsx:39-46` → `API/content/[slug]/route.ts:24-145`; `L/content/resolve.ts:56-69` (T) | G19 P1, G27 P2 (hidden from managers in the nav although the page and API allow them) |
| `/admin/blog` | Search, status filter, import guide drafts, add post | Import creates drafts | n/a | `API/posts/import-guide-drafts/route.ts:15-47` | — |
| `/admin/blog/new`, `/admin/blog/[id]` | Title, slug, body, excerpt, SEO title and description, schedule, cover, share image, author, category, tags, template, revisions, delete | Yes, every column | **Partial.** Only title, excerpt, body, status and schedule are read. SEO, cover, share image, author, category, tags and template are never read. | `L/content/blog.ts:25-30`; `L/content/pages.ts:42-46` (V); `SF/guides/[slug]/page.tsx:21` (T) | **G18 P1**, G32 P2, G33 P2 |
| `/admin/navigation` | Header links and footer columns: add, remove, move, "New" flag, column titles; save; reset to V5 | Yes: `store_settings.navigation` | Yes, but the save revalidates only `/`, not the layout. ISR pages keep the old header and footer for 60 s or more. An emptied menu falls back to code defaults. | `API/navigation/route.ts:80-155,173-216` (V: `revalidatePath("/")` at `:154,215`); `C/storefront/site-header.tsx:252`, `site-footer.tsx:97` (T) | G26 P2, G28 P2, G49 P2 |
| `/admin/seo` | **None.** Read-only checklist of products and collections missing SEO | No | n/a | `A/seo/page.tsx:16-27,73-76` (T) | **G20 P1** (site description, share image, organisation data are code-only) |
| `/admin/reels` | Title, caption, media source, video and HLS URLs, poster, avatar, products, link, rights, status, sort, creator name and consent, tag; seed presets | Yes: `reels` and `reel_products` | Title, caption, video, poster, products and link: yes. **Creator, avatar and tag are never rendered.** | `API/reels/route.ts:8-31`, `[id]/route.ts:12-57`; `L/content/reels-server.ts:41,74-80` (T) | G31 P2 |
| `/admin/reviews/testimonials` | Author, rating, body, date, source, URL, avatar, consent, homepage, featured, sort, status, delete, Google import | Yes. Validation matches the DB after LH-019. | Yes: `testimonials` tag | `API/testimonials/**`; `L/content/testimonials-server.ts:10-41` (V) | none found |
| `/admin/help` | Static text and links | — | — | `A/help/page.tsx:14,36-43` (V) | G41 P2 (contradicts Overview on COD), G27 P2 |
| `/admin` (Overview) | Counts and links | — | — | `A/page.tsx:86-96` (V: "COD is live" text is hard-coded) | G41 P2 |
| `/admin/[...missing]` | Admin 404 | — | — | `A/[...missing]/page.tsx` | — |

### Commerce, operations and access

| Route | Controls | Saves? | Reaches storefront / ops? | Evidence | Gap / priority |
|---|---|---|---|---|---|
| `/admin/settings` › Store details | Business name, support email, support phone → `business_identity` | Yes | **No.** No reader outside the settings page. Contact & Social overwrites the same key, and a stale form state can write old values back. | `API/store-settings/route.ts:127-141,218-234` (V); reader only `A/settings/page.tsx:56` (V) | **G15 P1** |
| ″ Inventory tracking | `inventory_tracking.enabled` | Yes | Yes: checkout quote, `create_cod_order`. The save does not expire the `catalog` tag. | `API/store-settings/route.ts:143-154,305-317` (T) | G43 P2 (NOT VERIFIED impact) |
| ″ Inventory defaults | New-product tracking default, default low-stock threshold | Yes | **Never read.** The new-product form ignores it; the low-stock view uses the constant `2`. | `API/store-settings/route.ts:157-169` (V); `L/commerce/inventory-adjust.ts:37` (T) | **G16 P1** |
| ″ PDP buy button, SEO suffix, storefront labels | `storefront_checkout.pdp_cta`, `seo_defaults.title_suffix`, `storefront_presentation.*` | Yes | Yes (`settings` tag and layout paths) | `API/store-settings/route.ts:171-211,312-317` | — |
| ″ Contact & Social | Name, address, email, phones (up to 8), social links, WhatsApp (URL, widget, ordering, label, sold-out, recipient digits, message template) | Yes | Yes: footer, WhatsApp float, PDP WhatsApp order, homepage inquiry phones (`settings` and `contact-social` tags) | `L/content/contact-social.ts:126-150`; `API/store-settings/route.ts:213-234` (T) | G39 P2 (one bad row fails the whole save with a generic message; address and email cannot be hidden) |
| ″ Security | Change own password | Yes | n/a | `A/settings/page.tsx:107-113`; `API/account/change-password/route.ts` | **G23 P1** (editor and fulfillment staff have no change-password page) |
| ″ Backups | Create (owner/admin), restore (owner) | Yes | Restore **upserts every `store_settings` row, including `cod_checkout`**. Policy pages, theme versions and `reel_products` are not in backups. | `L/admin/merchant-snapshots.ts:44-50` (V); `M/20261118081618…sql:44-53` (V) | **G17 P1** |
| ″ Shipping zones | Name, provinces, cities, excluded cities, flat fee, COD fee, free-over, active, notes | Yes; zod matches the DB CHECKs | Yes (live RPCs, no cache) | `API/shipping-zones/route.ts:7-37`, `[id]/route.ts:9-43` (T) | G40 P2 |
| ″ COD readiness | Read-only | — | Gates checkout | `L/commerce/checkout-readiness.ts:76-86` (T) | G41 P2 (the fix link goes to Settings, which has no `cod_checkout` control; known owner gate LH-017) |
| `/admin/discounts` | Name, description, percent or fixed, value, status, start, end, announcement, show-announcement; activate, disable | **Create: always fails.** Edit: works unless the campaign has dates. | Promo bar and prices (layout, PDP, home, cart), checkout quote, `active_automatic_discount` RPC. **The save never revalidates.** | Form sends `id: ""` (`C/admin/discount-campaign-form.tsx:23,109`) against `z.string().uuid().optional()` (`API/discounts/route.ts:13`) (V). Bare `requireStaff` at `:3,32,54` (V). No revalidate call (V). `z.string().datetime()` at `:23-24` rejects the stored `+00:00` (V). | **G01 P0, G02 P0**, G08 P1, G09 P1, G10 P1 |
| `/admin/orders` | Filter, search | Read only | — | `A/orders/page.tsx:19-55` | G38 P2 (200-row cap) |
| `/admin/orders/[orderNumber]` | Next status (carrier, tracking, note), record COD collection, retry notification | Yes: `transition_order_status` and `record_cod_collection` RPCs, write-guarded | Customer track and success pages read live | `C/admin/order-actions.tsx:73-119`; `A/orders/[orderNumber]/page.tsx:22-35,180-189` (T) | **G21 P1** (variant and discount not shown), **G22 P1** (collection allowed on cancelled orders, no reversal) |
| `/admin/customers` | Read only | — | — | `A/customers/page.tsx:13-20` (T) | G38 P2 (latest 50 orders, not de-duplicated customers) |
| `/admin/inquiries` | Status new, open, closed | Yes, write-guarded | Ops only | `API/inquiries/[id]/route.ts:9-27` | G27 P2 (nav shows it to editors, who are forbidden: `C/admin/shell/nav.ts:33` vs `L/auth/inquiry-roles.ts:4`, V); G24 P1 (no staff alert on a new inquiry) |
| `/admin/analytics`, `/admin/activity` | Read only | — | — | `A/activity/page.tsx:15-37` (T) | G38 P2 (actor shown as a truncated UUID; no time zone) |
| `/admin/staff` | Invite, role, activate or deactivate, resend | Yes; write-guarded; escalation rules in `L/auth/staff-admin.ts:17-48` | n/a | `API/staff/route.ts:30-80`, `[userId]/route.ts:29-90` | Invites need Resend env (`API/staff/route.ts:46-51`); ownership transfer is a DBA job by design. P2. |
| `/admin/login`, `/forgot-password`, `/reset-password`, `/forbidden` | Authentication | Yes. The user's own session; cross-site and public-write guards. | n/a | `API/account/*` (T) | G23 (the recovery message points to "Settings → Security", which some roles cannot open) |

### Authorization summary (all `API/**` routes)

Every write route uses `createAuthorizedStaffWriter`, which checks the role and applies the Preview→Production write
guard. There are two exceptions:
1. **`API/discounts/route.ts`** uses bare `requireStaff` for GET and POST (G02, V).
2. The `API/account/*` routes use the user's own session plus `publicWriteBlockedResponse` and `isCrossSite`. This is
   acceptable for self-service.

Reads use `createAuthorizedStaffClient` with a role list. Two read-side mismatches remain:
- Inventory export is open to editors (G36).
- `API/featured-flame-preset` GET uses the writer helper for a read (P2, cosmetic).

Two out-of-band writers sit outside the guard: the storefront layout (`SF/layout.tsx:105-110`) and the
`/admin/merchandising` render (`A/merchandising/page.tsx:41`). Both call `ensureFeaturedFlamePreset`
(`L/content/featured-flame-preset-server.ts:69-127`) with the raw service client (G25, V).

---

## 2. Hard-coded content inventory

Rule: none of these get invented values. Where wording or facts are missing, the entry says "needs owner content".
Items already in LH-012 are marked with "(LH-012)".

| File:line | What | Suggested admin home |
|---|---|---|
| `L/catalog/v5-model.ts:142-184` | Built-in collection titles and rules (brand lists, "Business lines" regex, Rs 40k/60k bands). These override DB collections with the same slug. | Collections: DB row wins, or seed as automated rules (G05) |
| `L/catalog/v5-model.ts:196-217`; `SF/layout.tsx:58` | Mega-menu groups and Help links; the mega-menu product is "first available laptop" (LH-009) | Navigation › mega-menu editor and featured-product picker |
| `L/catalog/v5-taxonomy.ts:3+` | Sub-type per handle (Charger, Workstation, 2-in-1 …), which drives badges and three collections | Product field "Sub-type" (G11) |
| `L/catalog/v5-model.ts:313-323,370` | PDP spec row order and labels; compare rows | Products › Specifications (G04) |
| `SF/products/[handle]/page.tsx:62-66,84,160`; `L/catalog/v5-model.ts:254` | Policy-link destinations (labels are editable); fallback intro "Listed in … by {brand}."; "Condition not listed" | Customize › Product pages |
| `C/…/product-detail.tsx:240-273` | "Buy now / Add to cart", "Sold out.", "Ask about this product", inquiry prompt, "Choose an option first" | Customize › Product pages (buy logic stays in code) |
| `C/commerce/whatsapp-order-cta.tsx:44-58,148-151` | Sold-out WhatsApp inquiry message (the order template is editable; this one is not); fallback dialog text | Settings › Contact & Social › sold-out message template |
| `C/…/product-reviews.tsx:22,52` | "Customer reviews", "No reviews yet for the {model}." | Customize › Product pages |
| `C/storefront/merch-badges.tsx:73`; `L/content/social-proof.ts:206,215` | Badge tooltips; "Featured / Popular pick / Staff pick / Top seller" | Merchandising |
| `C/storefront/collection-view.tsx:13-19,96-168` | Chromebook "what each listing shows" list (deliberately fixed, Phase 2b), "Filters", "Price", "Touchscreen", "Clear all", "Browse all products" | Customize › Collection pages (filter logic stays in code) |
| `C/storefront/search-overlay.tsx:11,80,97`; `C/storefront/collection-page.tsx:42` | Popular search terms, placeholder, "Popular", `Results for "q"` | Navigation › Search suggestions |
| `SF/compare/page.tsx:50-68` | Heading, "Up to 4…", empty state (LH-012) | Customize › Compare |
| `C/storefront/cart-drawer.tsx:50-106`; `SF/cart/page.tsx:20-93` | Empty state, Subtotal, "Storewide savings", "Shipping: Calculated at checkout", checkout notes (LH-012) | Customize › Cart |
| `SF/checkout/checkout-form.tsx:187-200,311-316` | COD explanation, "Online ordering opens soon", consent sentence and policy links (LH-012) | Customize › Checkout. **Needs owner content** (policy wording). |
| `SF/order/success/[token]/page.tsx:26-46`; `SF/track-order/track-form.tsx:27`; `L/orders/customer-view.ts:26-47` | Order success copy, track-order copy, customer-facing status labels | Customize › Order pages |
| `L/notify/templates.ts:35-69` | Staff alert and customer email subjects and bodies; sign-off fixed to "Laptops HUB" | Settings › Notifications (G24) |
| `L/notify/outbox.ts:113,145`; `L/notify/send-email.ts:9,39` | Staff alert recipient (`STORE_NOTIFY_EMAIL`, one address), customer email toggle (`NOTIFY_CUSTOMER_EMAIL`), sender (env) | Settings › Notifications (recipients, toggle); sender can stay in env |
| `C/storefront/json-ld-site.tsx:12,14,20` | Organisation name "Laptops HUB"; logo = `/favicon.ico`; no address, phone or social profiles | SEO › Organisation, read from `contact_social` (G20) |
| `SF/layout.tsx:34,37-39` | Default title; site meta description (known, LH-010 note) | SEO › Site defaults (G20) |
| *(missing)* site-wide Open Graph image; `src/app/favicon.ico`, `icon.png`, `apple-icon.png` | Default share image and icons are static files | SEO › Share image. **Needs owner content.** |
| `L/content/resolve.ts:56-63` | Content-page intros, which also serve as meta descriptions (LH-012) | Content › page intro and SEO fields (G19) |
| `L/content/pages.ts:101,122`; `C/…/content-page.tsx:59-255` | "Guide" kicker; "Not published yet", "Read guide →", "On this page", "Help & policies" | Customize › Content pages |
| `C/…/content-client.tsx:70-218`; `L/validation/contact.ts:6-8` | Contact form subjects, topics, budget bands, contact methods, success text | Settings › Inquiry form |
| `C/storefront/home/home-inquiry.tsx:187-284` | Homepage inquiry form labels, options and success message (headings are editable) | Customize › Inquiry section |
| `C/storefront/home/store-map.tsx:61-112` | "LOCATION", "Laptops HUB · Bahawalpur", "Open in Google Maps", iframe title | Customize › Map section. **Needs owner confirmation** of the location line. |
| `C/storefront/home/store-reviews.tsx:168-197` | "REVIEWS", "Read all reviews", "Our profile on Google" | Customize › Reviews section |
| `C/storefront/home/cinematic-hero.tsx:213-214`; `home-page-view.tsx:159`; `home-sections.tsx:197` | Hero Chromebook chip; no-Chromebooks text; "Shop this range" | Customize › matching section |
| `C/storefront/site-footer.tsx:15-70,291`; `site-header.tsx:32-39` | Fallback menus used when navigation is saved empty; "{n} products in the catalog" | Navigation (allow empty), footer settings |
| `C/storefront/prelaunch-notice.tsx:10-12`; `SF/coming-soon/page.tsx:10-46` | Pre-launch bar and coming-soon text | Settings › Launch mode |
| `L/commerce/inventory-adjust.ts:37` | `LOW_STOCK_AT = 2` | Settings › Inventory defaults (G16) |
| `L/business.ts:8-18` | Unused duplicate of phones and address marked `confirmed:false`, which contradicts the live defaults | Delete (G42) |
| `A/page.tsx:90`; `A/help/page.tsx:14` | Contradictory COD status text | Derive from checkout readiness (G41) |
| `L/commerce/cart-limits.ts:2`; order number format; currency | Cart max of 20, which mirrors a DB CHECK | Keep in code (by design) |

---

## 3. Prioritised gap list

Size: **S** ≤ half a day · **M** 1–3 days · **L** more than 3 days, or needs schema or design approval.
Anything that needs a migration needs owner approval before it is applied to production. Anything that changes the
V5 look (for example showing compare-at prices) needs design approval because the V5 design is frozen.

### P0 — owner blocked, data loss or security (5)

| ID | Gap | Evidence | Fix | Size |
|---|---|---|---|---|
| **G01** | **No new discount can be created.** "Create discount" opens a draft with `id: ""`. The API schema `z.string().uuid().optional()` rejects `""`, so every create returns 400 `validation_failed`. No test covers create. | `C/admin/discount-campaign-form.tsx:23,109`; `API/discounts/route.ts:13` (V) | Send `id` only when it is non-empty, or `z.preprocess` `""`→`undefined`. Add an isolated e2e that creates, edits and activates a campaign. | S |
| **G02** | **Discounts API skips the Preview→Production write guard.** It is the only merchant write route on bare `requireStaff`, so a staff session on a Preview deployment can change live prices. | `API/discounts/route.ts:3,32,54` (V); compare `L/auth/staff.ts` `createAuthorizedStaffWriter` | Use `createAuthorizedStaffWriter(["owner","admin","manager"])` for POST and `createAuthorizedStaffClient` for GET; return `staffErrorResponse`. | S |
| **G03** | **Saving a product overwrites its stock count.** Each save sends `inventoryMode` and `quantityOnHand` from page load. The API writes them directly: no ledger, no expected-quantity check, and editors are allowed. A sale between page load and save is undone, which can lead to overselling. The variant matrix does the same with absolute quantities. | `C/admin/product-edit-form.tsx:131-136`; `API/products/[handle]/route.ts:56,143-163` (V; no DB trigger) | Send inventory fields only when changed. Route quantity changes through `adjust_inventory` with the expected quantity. Restrict them to `INVENTORY_ADJUST_ROLES`. | S–M |
| **G04** | **Laptop specs and condition cannot be edited anywhere.** Specs drive the storefront chips, filters, key-spec tiles, spec table, compare rows and menu counts. No admin form writes `products.specs`, only duplicate copies them, and the Shopify import does not map them. A new laptop gets no specs. | `grep` of `C/admin/*`: no specs writer; `L/catalog/v5-model.ts:83-128`; `L/catalog/shopify-import-commit.ts` (V) | Add a typed specifications editor (processor, generation, RAM, storage, screen, touch, condition) that writes `specs` with the same keys the V5 model reads, plus import column mapping. Product facts come from the owner; the editor does not invent them. | L |
| **G05** | **Collections cannot be managed after creation, and seeded collections ignore admin edits.** There is no rename, description, publish or unpublish, SEO, image, sort or delete control (and no DELETE route); "published" is set once at creation. Separately, the storefront serves the `V5_COLS` code definition first, so all 16 seeded slugs (and any new slug that collides) silently ignore rule and membership edits. | `A/collections/[slug]/page.tsx:15-78`; `SF/collections/[slug]/page.tsx:35-41`; `L/catalog/v5-model.ts:142-184`; `M/20261021150000…sql:58-76` (V) | (a) Collection settings form using the existing PATCH (`API/collections/[slug]/route.ts:17-27`), plus a DELETE or archive route. (b) Precedence rule: a DB row that the owner has edited wins over `V5_COLS`, or the editor is locked for built-in slugs with an explicit message. (c) Reserve `V5_COLS` slugs on create. | M |

### P1 — material self-service gap (20)

| ID | Gap | Evidence | Fix | Size |
|---|---|---|---|---|
| G06 | Bulk and list "Set active" change only `products.status`. Variants created as draft stay `purchasable=false`, and the catalog drops products with no purchasable variant, so the product never appears. | `API/products/bulk/route.ts:47-85`; `API/products/route.ts:130`; `L/catalog/queries.ts:65,86` (V) | Recompute `purchasable` for all variants on any status change (bulk, list and edit). | S |
| G07 | The product edit save forces `purchasable = price>0 && active`, overriding the matrix's per-variant Sell switch. | `API/products/[handle]/route.ts:141` (T) | Touch `purchasable` only on a status or price change, and respect the explicit Sell value. | S |
| G08 | Discount saves never revalidate. ISR pages show the old price and promo bar for 60 s or more while checkout already charges the new price. | `API/discounts/route.ts` (no `revalidate*`, V); `SF/layout.tsx:118` | `revalidatePath("/", "layout")` after a successful write. | S |
| G09 | Re-saving a campaign that has a start or end date fails: stored timestamps come back as `+00:00`, which zod 4 `z.string().datetime()` rejects. The inputs are labelled "UTC" but parsed as browser-local time. | `API/discounts/route.ts:23-24`; `C/admin/discount-campaign-form.tsx:190-215` (V) | `z.string().datetime({ offset: true })`; label the inputs as Pakistan time and convert explicitly. | S |
| G10 | A fixed discount is entered in paisa ("500" = Rs 5) with no upper bound; integer overflow comes back as a raw 500. Errors show raw codes. | `API/discounts/route.ts:16,60-62`; `C/admin/discount-campaign-form.tsx:39` (T) | Enter rupees, convert server-side, add a maximum, show readable errors. | S |
| G11 | Brand and category are free text but must match the taxonomy exactly (case-sensitive brand; laptop / accessory / gaming / chromebook / macbook / tablet). Any other value shows a raw facet or falls back to "laptop". Sub-type is a code map. | `C/admin/product-edit-form.tsx:279-285`; `L/catalog/v5-model.ts:84-85,154-168`; `L/catalog/v5-taxonomy.ts` (T) | Selects for brand and category; a "sub-type" field replacing the handle map. | M |
| G12 | Collection rules do not update `collection_type`: a manual collection with pins keeps using pins while the admin shows "Automated". Pin order is ignored by the default sort. Membership remove and reorder errors are unchecked. | `C/admin/collection-rule-builder.tsx:72-75`; `L/collections/storefront.ts:36`; `L/catalog/v5-collection.ts:46,75` (T) | Set the type when rules are saved or cleared; a "Manual order" sort that honours `position`; check errors. | S–M |
| G13 | Product media: no alt edit (and alt is not used publicly), no set-primary (the API's primary path collides with the unique `(product_id, position)` index), no rights-approval control, no upload to a product. The Media page cannot attach uploads to products. | `API/products/[handle]/media/route.ts:197-266`; `C/…/product-detail.tsx:48`; `A/media/page.tsx:44` (T) | Alt edit and render, position swap for primary, upload to product, approval toggle. Media rights are an owner decision. | M |
| G14 | Compare-at price is saved but never rendered (only in the reels modal). | `C/admin/product-variant-matrix.tsx`; the V5 product model has no compare-at field (T) | Map it into the V5 model and render it. **Needs design approval** (frozen V5). | M |
| G15 | Settings › Store details (`business_identity`) is saved but nothing reads it. Contact & Social writes the same key, and the other form's stale state can write old values back. | `API/store-settings/route.ts:127-141,218-234`; reader only `A/settings/page.tsx:56` (V) | Remove the panel and make `contact_social` the single source, or wire JSON-LD and emails to it. | S |
| G16 | Settings › Inventory defaults (tracked by default, low-stock threshold) and the per-variant `low_stock_threshold` are never read; the inventory desk uses the constant `2`. | `API/store-settings/route.ts:157-169` (V); `L/commerce/inventory-adjust.ts:37` (T) | Read the setting in the new-product form and the low-stock filter, with the per-variant override. | S–M |
| G17 | Backups: restore upserts every `store_settings` row, including the `cod_checkout` go-live gate and `navigation`, so an old snapshot can switch COD on or off. Policy pages (`content_pages`), theme versions and `reel_products` are not backed up. Newer reel columns are dropped. Restore does not expire `testimonials`. | `L/admin/merchant-snapshots.ts:44-50`; `M/20261118081618…sql:44-53,105-137` (V); `API/backups/[id]/restore/route.ts:23-30` (T) | Exclude gate keys (`cod_checkout`) from restore or require explicit confirmation; add `content_pages` and theme to the snapshot (**migration, needs owner approval**); expire `testimonials`. | S (exclude) / M (scope) |
| G18 | Blog SEO title and description, cover image, share image, author, category, tags and template are saved but never read. `/admin/seo` tells the owner "Blog SEO is set on each post". | `L/content/blog.ts:25-30`; `L/content/pages.ts:42-46` (V); `A/seo/page.tsx:73-76` (T) | Select them in the reader; use them in `generateMetadata`, the guide header and cards. | M |
| G19 | Content pages: no revision history (overwriting policy text cannot be undone, and pages are not in backups), no way to create a page, no SEO fields. | `API/content/[slug]/route.ts:87-134`; `L/content/pages.ts:63-64`; `M/20261021120000…sql:145-152` (T) | `content_page_revisions` and restore; SEO columns; optional new pages. **Migration needs owner approval.** Legal text: **needs owner content.** | M–L |
| G20 | Site-wide SEO is code-only: meta description, default share image, Organisation JSON-LD (name, logo = favicon, no contact or social). `/admin/seo` saves nothing. | `SF/layout.tsx:34-39`; `C/storefront/json-ld-site.tsx:12-20`; `A/seo/page.tsx:16-27` (V/T) | `seo_defaults` fields (description, share image) and JSON-LD built from `contact_social`. Wording and image: **needs owner content.** | M |
| G21 | Admin order detail shows the title and handle but not the variant (`variant_title_snapshot` is selected but not rendered) or the discount, so staff cannot see which configuration to pack. | `A/orders/[orderNumber]/page.tsx:22-35,180-189` (T) | Render the variant and discount lines (also in emails). | S |
| G22 | COD collection can be recorded on cancelled or returned orders; there is no reversal or correction, and `refunded_or_adjusted` is unreachable. The collection form silently reuses the fulfilment note. | `M/20261023150000…sql:62-90`; `C/admin/order-actions.tsx:117` (T) | Block on terminal statuses; add an adjust or reversal RPC with audit. **Migration, needs owner approval.** | M |
| G23 | Change-password is only on Settings (owner, admin, manager). Editor and fulfillment staff cannot change their password, yet the recovery throttle message sends them to "Settings → Security". | `A/settings/page.tsx:107-113`; `API/account/recover/route.ts:21` (T) | `/admin/account` page open to all staff roles. | S |
| G24 | Notifications are env and code only: templates, staff recipient (one env address), customer-email toggle (env). There is no staff alert for a new inquiry. | `L/notify/templates.ts:35-69`; `L/notify/outbox.ts:113,145` (V/T) | Settings › Notifications (recipient list, toggle, editable subject and intro; the sender stays in env); inquiry alert template. | M–L |
| G25 | The storefront layout and the `/admin/merchandising` render write to the DB (`ensureFeaturedFlamePreset`, raw service client) outside the Preview→Production write guard; a GET page render has side effects. | `SF/layout.tsx:105-110`; `A/merchandising/page.tsx:41`; `L/content/featured-flame-preset-server.ts:69-127` (V) | Run the one-time install only through the guarded PATCH (`action: "ensure"`), or wrap it in `assertMerchantMutationAllowedAsync`. | S |

### P2 — nice to have (24)

| ID | Gap | Evidence | Fix | Size |
|---|---|---|---|---|
| G26 | Navigation save revalidates `/` only; product, collection, cart and compare pages show the old header and footer for up to about 60 s. | `API/navigation/route.ts:154,215` (V) | `revalidatePath("/", "layout")` | S |
| G27 | Nav and role mismatches: Inquiries shown to editors (forbidden); Import shown to editors (forbidden); Content hidden from managers (allowed); Settings hub links Staff and Activity for managers; Help links to pages some roles cannot open. | `C/admin/shell/nav.ts:33,48,98` vs `L/auth/inquiry-roles.ts:4`, `A/products/import/page.tsx:9`, `A/content/page.tsx:13` (V); `A/settings/page.tsx:41-42` (T) | Derive the nav from the same role constants as pages and APIs. | S |
| G28 | Editors see Publish and Restore (online store) and Reset to V5 (navigation), then get a 403; publish fails only after the draft has saved. | `C/admin/homepage-section-editor.tsx:696,917-924`; `C/admin/navigation-editor.tsx:260-267` (T) | Hide or disable by role. | S |
| G29 | Reviews and map heading/intro have no length limit in the editor or API and are silently truncated at render (90 / 240 / 300). | `C/admin/homepage-section-editor.tsx:555-581`; `L/content/home-sections.ts:70-109` (T) | Same caps in the UI and API. | S |
| G30 | The theme draft API accepts unknown keys in section settings (`z.record(unknown)`). | `API/theme/homepage/route.ts:25` (T) | Strict per-section schema. | S |
| G31 | Reels: creator name, consent, avatar and tag are saved but never rendered. The reels heading lives in Merchandising (owner/admin/manager), while reels are owner/admin/editor, and the admin label differs from the storefront default. A DB-blocked media host gives a generic "Could not save". | `L/content/reels-server.ts:41,74-80`; `A/reels/page.tsx:70`; `L/content/social-proof.ts:65`; `M/20261115100000…sql:33-36` (T) | Render or remove the fields; move the heading next to the reels; validate hosts in the form. | S |
| G32 | Guides on a V5 template slug ignore the edited excerpt, and the `/guides` card shows the template title. | `L/content/resolve.ts:63`; `L/content/pages.ts:125` (T) | Prefer the CMS values when set. | S |
| G33 | Blog revision restore can republish an empty body; renaming a slug leaves no redirect. | `API/posts/[id]/revisions/route.ts:59-70` (T) | Run the publish checks on restore; store a redirect from the old slug. | S–M |
| G34 | Product SEO inputs allow 200 / 500 characters; output is cut to 70 / 160. | `C/admin/product-edit-form.tsx:243-247`; `L/seo/product-meta.ts:28-49` (T) | Counters and caps that match the output. | S |
| G35 | A soft-deleted product can be set active again through status (RLS checks only status); duplicate copies the tracked stock count; the import fingerprint check is skipped when the client omits it. | `API/products/[handle]/route.ts:98-118`; `…/duplicate/route.ts:88`; `API/products/import/route.ts:162` (T) | Guard `deleted_at`; zero stock on duplicate; make the fingerprint mandatory. | S |
| G36 | Editors can export inventory quantities although the Inventory page denies them. | `API/products/export/route.ts:14-22` (T) | Role-gate `format=inventory`. | S |
| G37 | Review moderation: each action overwrites the stored note with an empty one; lists capped at 100. | `C/admin/review-moderation.tsx:25-28` (T) | Prefill the note; paginate. | S |
| G38 | Ops readability: activity shows a truncated UUID; admin dates have no time zone (server UTC); Customers is the latest 50 orders, not customers; orders capped at 200, inquiries at 100. | `A/activity/page.tsx:37`; `A/customers/page.tsx:13-20`; `A/orders/page.tsx` (T) | Resolve actor email; `timeZone: "Asia/Karachi"`; de-duplicate customers; paginate. | S–M |
| G39 | Contact & Social: one invalid row (for example a blank added phone) fails the whole save with "Invalid settings payload"; address and email are required, so they cannot be hidden from the footer. | `L/content/contact-social.ts:126-150` (T) | Field-level errors; optional address and email with a show toggle. | S |
| G40 | Shipping-zone provinces are not restricted server-side (the UI uses `PK_PROVINCES`); zones cannot be deleted (by design). | `L/commerce/zone-input.ts:4-15` (T) | `z.enum(PK_PROVINCES)`. | S |
| G41 | Contradictory COD text: Overview says "COD is live", Help says "COD stays off". The readiness fix link points to Settings, which has no `cod_checkout` control (known owner gate LH-017). | `A/page.tsx:90`; `A/help/page.tsx:14` (V) | Derive the text from `checkout-readiness`; link to the runbook. | S |
| G42 | Dead code: `API/notifications/test` has no UI; `L/business.ts` duplicates contact facts marked unconfirmed. | (T) | Remove, or add a "Send test email" button. | S |
| G43 | The inventory-tracking toggle does not expire the `catalog` tag (availability badges). Impact NOT VERIFIED (`revalidatePath` layout may cover it). | `API/store-settings/route.ts:305-317` (T) | Add `revalidateTag("catalog")`. | S |
| G44 | Collection description, image and `sort_order` are never rendered on the storefront. | `C/storefront/collection-page.tsx:42` (T) | Render under the heading. Design approval for the image. | S–M |
| G45 | The Media page empty state says customers never see pending-rights images, but the storefront does not check `approval`. No delete or copy-URL. | `A/media/page.tsx:44` (T) | Correct the text; add actions. Media rights: owner decision. | S |
| G46 | The rich-text editor may strip `aside`, `details` and `h4` that the sanitizer allows (the Callout button and FAQ accordions). **NOT VERIFIED** at runtime. | `C/admin/rich-text-editor.tsx:21-56`; `L/security/sanitize-html.ts:3-32` | Add TipTap extensions or remove the button. | S |
| G47 | Cross-site origin checks are present on testimonials and staff but not on the content, posts, navigation, theme or reels APIs. SameSite cookie protection **NOT VERIFIED**. | `API/testimonials/route.ts:13` vs others (T) | Shared `isCrossSite` guard in the writer helper. | S |
| G48 | Storefront microcopy not in theme globals (see §2: cart, compare, search, checkout, order pages, reviews, map, inquiry form, content-page labels). Extends LH-012. | §2 | Phase 2c globals panels; checkout and policy wording **needs owner content.** | M |
| G49 | Navigation: links cannot be edited in place (only added, removed, moved); an emptied menu falls back to code defaults; saves publish immediately with no draft or history. | `C/admin/navigation-editor.tsx:70-90`; `C/storefront/site-header.tsx:252`; `site-footer.tsx:97` (T) | Inline edit; respect an empty menu; optional draft. | S–M |

**Counts:** P0 = 5 · P1 = 20 · P2 = 24 (49 gaps).

## 4. What is fully self-service today
- Homepage editor: sections, copy, images, publish and restore.
- Site-wide header, footer, promo-bar, product, collection and 404 labels.
- Testimonials.
- Reels (core fields).
- Product reviews moderation.
- Badges, flame preset and social proof.
- Inventory desk adjustments.
- Shipping zones.
- Contact & Social, including WhatsApp recipient, order template, footer and inquiry phones.
- PDP buy button, SEO title suffix and storefront labels.
- Order status, COD collection and notification retry.
- Staff management.
- Content-page title and body.

Each of these was traced to a storefront or ops reader. Except where §1 notes otherwise, each also revalidates the
right cache.

## 5. Not verified in this pass
- Runtime behaviour of any flow; no server or test was run.
- Live DB grants on `discount_campaigns`.
- Whether `revalidatePath("/", "layout")` also expires `unstable_cache` entries tagged `catalog` (G43, and flame preset → rule collections).
- Rich-text stripping (G46).
- SameSite cookie behaviour (G47).
- Every line of `sync_product_variants` (only its ledger and quantity paths were read).
