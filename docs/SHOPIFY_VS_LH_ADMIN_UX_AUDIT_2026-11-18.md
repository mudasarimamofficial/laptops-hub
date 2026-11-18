# Shopify vs Laptops HUB Admin — Enterprise UX Audit & VNext Blueprint

**Date:** 2026-11-18  
**Shopify store (confirmed):** `laptopshub-2` · visible identity **LAPTOPS HUB** · URL `https://admin.shopify.com/store/laptopshub-2/`  
**Laptops HUB admin:** `https://www.laptopshub.pk/admin`  
**Code baseline inspected:** `origin/main` @ `a2ccdf248ac17eb2034b9dc4dd292bfbaff862ae`  
**Attached screenshots:** filenames `image(20261118-090115).png` / `image(20261118-090126).png` were **not found on disk** in Downloads/Desktop/workspace; live Shopify UI + repository source used instead.

### Session access status

| Surface | Status |
|--------|--------|
| Shopify `laptopshub-2` blog list + Add blog post | **VERIFIED** (browser + desktop Chrome) |
| Shopify Products / Settings nav | **VERIFIED** (nav tree); deep product editor **NOT TESTED** this pass |
| LH production admin UI | **BLOCKED** — authenticated session returns `/admin/forbidden` (role insufficient) |
| LH blog implementation | **VERIFIED** via source (`post-form.tsx`, `rich-text-editor.tsx`, blog routes, schema) |
| Production writes / Shopify mutations | **Not performed** (read-only audit) |

---

## Deliverable 1 — Executive comparison

**Shopify strengths (laptopshub-2, observed):** Two-column editor IA; contextual Visibility / Image / Organization / Theme cards; icon toolbar with paragraph styles, color, alignment, media, table, HTML toggle; empty-state list with primary CTA; scheduling UI (“Set visibility date”); Files/Menus under Content; dense keyboard shortcuts; sticky/global search (Ctrl K).

**Laptops HUB strengths (code-verified):** Catalog IA tailored to laptop retail (Products → variants/bulk/import, Inventory, Reviews, Reels, COD settings, backups); `--adm-*` token system and `AdminShell` already Shopify-inspired; SEO fields + search preview already exist; server-side HTML sanitization; article revisions **API** exists; templates for guides; role-gated nav.

**Where LH is weaker for merchants:** Blog **new/edit** pages force a single `max-w-3xl` column with settings interleaved in the writing flow; cover image is a raw URL (media library is product-CDN references only); text-button `contentEditable`/`execCommand` toolbar; DB columns `tags` / `scheduled_for` are **not** wired into the form/API schema; revisions API is **not** surfaced in the edit UI; list is a flat `<ul>` without search/filters/bulk.

**Highest merchant value:** Rebuild Blog editor layout + media picker + visibility/scheduling + surface revisions — Phase 1 — without copying Shopify branding or multi-blog complexity (keep single `/guides` blog + category/tags).

---

## Deliverable 2 — Feature parity matrix (relevant modules)

| Shopify feature | LH counterpart | Status | Evidence |
|-----------------|----------------|--------|----------|
| Home / setup tasks | Overview | PARTIAL | Shopify home VERIFIED; LH overview code exists, UI BLOCKED |
| Orders list/detail | `/admin/orders` | PARTIAL | Nav VERIFIED both; COD-focused LH; Shopify deep order UX NOT TESTED |
| Products list | `/admin/products` | PARTIAL | Shopify nav VERIFIED; LH has search/status/bulk/thumbnails in source |
| Collections | `/admin/collections` | PARTIAL | Both nav present |
| Inventory | `/admin/inventory` | PARTIAL | Both; LH global tracking toggle (Merchant OS) |
| Customers | `/admin/customers` | PARTIAL | Both |
| Discounts | — | NOT APPLICABLE | LH COD launch; no Shopify-style discounts required now |
| Markets / POS / Finance / Apps / Flow / Agentic | — | NOT APPLICABLE | Not laptop-ops value |
| Content → Blog posts list | `/admin/blog` | PARTIAL | Shopify empty state + Create CTA VERIFIED; LH list source VERIFIED (simple rows) |
| Add blog post two-column | `/admin/blog/new` | MISSING layout | Shopify VERIFIED; LH `max-w-3xl` single form VERIFIED in source |
| RTE icon toolbar | `RichTextEditor` | PARTIAL | Shopify icons/groups VERIFIED; LH text buttons + execCommand VERIFIED |
| Excerpt section | Summary input | PARTIAL | Shopify dedicated Excerpt VERIFIED; LH plain `maxLength=300` input |
| Visibility + schedule | Status select | PARTIAL / MISSING schedule UI | Shopify Visible/Hidden + date VERIFIED; LH draft/published only; `scheduled_for` column unused |
| Featured image upload | Cover image URL | MISSING upload | Shopify Add image VERIFIED; LH URL field; media page = product refs only |
| Author / tags / blog | Author + category | PARTIAL | Shopify Organization VERIFIED; LH author/category; tags column unused; multi-blog N/A |
| SEO listing + handle | SEO panel + `/guides/` slug | PARTIAL | Both have title/desc/preview; Shopify handle under SEO VERIFIED; LH slug near top |
| Theme template | templateKey templates | PARTIAL | Shopify theme template VERIFIED; LH content templates (different purpose) |
| Revisions UI | `article_revisions` API | PARTIAL | API VERIFIED; **no UI** in edit page |
| Files library | Media library | PARTIAL | Shopify Files VERIFIED nav; LH product media refs, no blog asset picker |
| Menus | Navigation | PARTIAL | Both |
| Online Store / Themes | Customize | PARTIAL | Both concepts; Shopify theme editor NOT TESTED |
| Settings | Settings (+ shipping/COD/backups) | PARTIAL | LH has COD-specific strengths |
| Staff | Staff | PARTIAL | Both |
| Inquiries / Reels / Badges | LH-only | N/A for Shopify | Keep |

---

## Deliverable 3 — Blog editor deep dive

### Shopify evidence (VERIFIED)

- **Store:** `laptopshub-2` / LAPTOPS HUB (sidebar chip).
- **List:** `/content/articles` — empty state “Write a blog post”, CTAs **Create blog post**, **Manage blogs**.
- **Editor:** `/content/articles/new` — H1 “Add blog post”; breadcrumb Blog posts.
- **Main column:** Title (placeholder *e.g., Blog about your latest products or deals*), Generate title/text; Content RTE toolbar: Paragraph, Bold, Italic, Underline, Color, Alignment, Link, Insert image/video/table, Bulleted/Numbered, Outdent/Indent, Clear formatting, Show HTML; Excerpt; Search engine listing (edit expands title/desc/handle).
- **Aside:** Visibility (Visible / Hidden, Hidden default) + Set visibility date; Image dropzone “Add image or drop…”; Organization (Author Mudasar Imam, Blog News, Tags); Theme template Default blog post.
- **Measured chrome (CDP, viewport ~1800×1125):** nav width ≈ **220px**; main content starts ≈ **x=220**; main surface white with **16px** radius on shell.

### Laptops HUB evidence (source VERIFIED; live UI BLOCKED)

| Aspect | Observation |
|--------|-------------|
| Page shell | `blog/new/page.tsx` & `blog/[id]/page.tsx` wrap in `lh-container max-w-3xl` (~768px) — **single column** |
| Form | One card `space-y-4`; templates → title → slug → summary → author/category → body → HTML details → SEO → status → Save |
| Toolbar | Text buttons Bold/Italic/… via `document.execCommand` |
| Cover | `Cover image URL` / `Social share image URL` text fields |
| Status | `<select>` draft \| published — no schedule UI |
| Revisions | `GET/POST …/revisions` exists; **edit page does not render history** |
| Schema gap | Migration adds `tags`, `scheduled_for`; `postInputSchema` omits them |

### Field-by-field

| Field | Shopify | LH | Gap ID |
|-------|---------|-----|--------|
| Layout | Main + aside | Single stack | BLOG-001 |
| Title | Large input + AI | Standard input | BLOG-002 (P3 AI N/A) |
| Body RTE | Icon toolbar, media/table | Text toolbar, URL prompts | BLOG-003 |
| Excerpt | Dedicated card | Single-line summary | BLOG-004 |
| Visibility | Radios + schedule | Dropdown | BLOG-005 |
| Image | Upload/drop | URL only | BLOG-006 |
| Tags | Combobox | Column unused | BLOG-007 |
| SEO | Listing card + handle | Panel + counters + preview | BLOG-008 (polish) |
| Revisions | (Shopify versioning N/A here) | API only | BLOG-009 |
| Save bar | Polaris pattern | Inline Save button | BLOG-010 |
| List UX | Empty CTA, Manage blogs | Simple list, New post | BLOG-011 |

### Recommended LH Blog VNext layout (desktop ≥1280)

```
[AdminShell sidebar 248px] [ Editor page fluid ]
  Header: breadcrumbs · title · View on site · primary Save
  grid: 1fr minmax(280px, 320px) gap 16–24
  Main: Title card · RichText · Excerpt (plain OK) · SEO preview card · Revisions
  Aside: Visibility (+ schedule) · Cover (MediaPicker) · Organization (author, category, tags)
```

Tablet: aside stacks under main. Phone: stack; sticky bottom SaveBar.

**Do not** add multi-blog assignment — keep `/guides` + category/tags.

### Source mapping

| Change | Files |
|--------|-------|
| Remove `max-w-3xl` / use editor shell | `blog/new/page.tsx`, `blog/[id]/page.tsx` |
| Split form | `post-form.tsx` → compose `AdminEditorMain` / `AdminEditorAside` |
| RTE upgrade or icon toolbar | `rich-text-editor.tsx` |
| Media picker | New component + reuse storage/upload if exists; wire cover |
| Schema API | `blog.ts` `postInputSchema`, `posts/shared.ts`, revisions UI component |
| Schedule | UI + job/cron or publish-at read path — column alone insufficient |

---

## Deliverable 4 — Visual design system audit

### Shopify (observed)

- Dark sidebar, light canvas, white cards, soft grey borders, ~8–12px radii, 13px body, generous card gaps.
- Sidebar ~220px (measured); LH tokens already use `--adm-sidebar-w: 248px`.

### LH tokens (`src/styles/admin.css`) — keep

`--adm-canvas #f3f6fb`, `--adm-surface #fff`, `--adm-border #d7e2ef`, `--adm-ink #102039`, `--adm-focus #2159d4`, `--adm-radius-lg 14px`, `--adm-shadow`, sidebar dark navy.

### Inconsistencies (VERIFIED in blog pages)

- Blog editor uses **`lh-container` / `--lh-border` / rounded-full pills** instead of `AdminPageHeader` + `--adm-*` (list page is better).
- Mixed storefront chrome tokens on an admin desk.

### Recommendations

1. Blog editor must use admin tokens only (no storefront container).
2. Card: `border: 1px solid var(--adm-border); border-radius: var(--adm-radius-lg); padding: 16–20px; gap: 16px`.
3. Inputs: min-height 40px; focus `outline: 2px solid var(--adm-focus)`.
4. Primary button: `--adm-action` rectangle (match list CTA), not only pills.
5. Toolbar: icon buttons 36×36, grouped with dividers; aria-pressed for active formats.

---

## Deliverable 5 — Prioritized gap register

| ID | Module | Severity | Gap | Impact | Effort | Confidence | Test |
|----|--------|----------|-----|--------|--------|------------|------|
| BLOG-001 | Blog | P1 | Single-column `max-w-3xl` vs Shopify main+aside | Merchants bury publish/image/SEO while writing | M | Confirmed | Visual 1280/768; a11y landmarks |
| BLOG-003 | Blog | P1 | Fragile execCommand text toolbar | Formatting/selection loss; weak a11y | L | Confirmed | Keyboard format; paste; sanitize |
| BLOG-006 | Blog | P1 | Cover URL vs upload/picker | Non-technical merchants stuck | M | Confirmed | Pick existing + upload isolated |
| BLOG-005 | Blog | P1 | No schedule UI despite `scheduled_for` | Cannot plan publish | M | Confirmed | Set future; verify not public early |
| BLOG-009 | Blog | P2 | Revisions API not in UI | Overwrite risk; recovery hidden | S | Confirmed | Restore → reload |
| BLOG-007 | Blog | P2 | Tags unused | Organization incomplete | S | Confirmed | Save/reload tags |
| BLOG-011 | Blog | P2 | List lacks search/filter/status | Hard to find posts as catalog grows | M | Confirmed | Filter draft/published |
| BLOG-010 | Blog | P2 | No sticky save / dirty guard | Accidental navigation loss | S | Confirmed | beforeunload / confirm |
| BLOG-004 | Blog | P3 | Excerpt not rich | Low value if list uses plain text | S | Confirmed | Keep plain unless design needs rich |
| BLOG-008 | Blog | P2 | Slug change no redirect | Broken backlinks | M | Probable | Change slug → 301 |
| ADMIN-001 | Shell | P2 | Blog pages bypass AdminPageHeader pattern | Inconsistent desk | S | Confirmed | Screenshot parity with Products |
| NAV-001 | Nav | P3 | Shopify Content grouping vs LH Online store | Discoverability OK if labels clear | S | Confirmed | IA review only |
| MEDIA-001 | Media | P1 | Library is product CDN refs; no CMS asset upload | Blocks BLOG-006 | L | Confirmed | Isolated upload ACL |
| PRODUCT-001 | Products | P2 | Shopify denser filters/bulk patterns | Task speed | M | Probable | NOT TESTED live LH |
| A11Y-001 | Blog | P2 | Toolbar buttons lack pressed state / tooltips | WCAG / discoverability | S | Confirmed | axe + keyboard |

---

## Deliverable 6 — Implementation roadmap

### Phase 1 — Blog editorial excellence (FIRST RELEASE)

**Scope:** Editor shell two-column; aside Visibility/Image/Organization; media picker for cover; icon toolbar (or Tiptap if execCommand fails acceptance); wire tags; schedule UI + publish path; revisions panel; AdminPageHeader; sticky SaveBar; list search/status filter.  
**Benefit:** Matches Shopify task efficiency for the owner’s #1 gap.  
**Risk:** Medium (editor swap); migrate additive only.  
**Rollback:** Feature-flag layout; keep API backward compatible.  
**Acceptance:** Create draft → add cover via picker → set schedule or publish → SEO preview → reload persists → revision restore works → 360/768/1280 no overflow → sanitize XSS.

### Phase 2 — Shared admin design system

Standardize page shells, cards, forms, tables, save feedback across Products/Orders/Settings. Remove leftover `--lh-*` on admin desks.

### Phase 3 — Products & inventory

Shopify-like density: sticky bulk bar, clearer variant matrix, inventory adjustment UX (respect tracking OFF default).

### Phase 4 — Orders / COD ops / settings

Confirmation-before-dispatch clarity; shipping zone editing; settings search.

### Phase 5 — Media CMS + productivity

True CMS file library (not only product refs); nav/menu polish; optional SEO redirects.

---

## Deliverable 7 — Verdict & first implementation brief

**Verdict:** Laptops HUB admin IA and commerce ops are directionally strong; the **blog editor is the clearest Shopify gap** (layout, media, visibility, toolbar quality, unused schema). Do not chase Markets/POS/Discounts.

**First ship:** Phase 1 Blog VNext only.

### Cursor / Claude Code brief (copy-ready)

1. Confirm owner role session before visual QA; use isolated DB for mutating tests.  
2. Refactor `admin/blog/new` + `admin/blog/[id]` to full-width admin canvas (drop `lh-container max-w-3xl`).  
3. Split `PostForm` into main + aside; reuse `--adm-*` cards.  
4. Add `AdminMediaPicker` for cover (upload to Blob/Supabase storage **or** pick approved URL); stop requiring merchants to paste URLs as the only path.  
5. Extend `postInputSchema` with `tags: string[]`, `scheduledFor: string | null`; persist columns; document publish scheduler behavior.  
6. Surface revisions from `/api/admin/posts/[id]/revisions` on edit page.  
7. Replace or harden RTE: prefer maintained editor if execCommand fails keyboard/paste/selection tests; keep `sanitizeCmsHtml` on save.  
8. Add Playwright isolated tests: draft save, cover, SEO, publish, revision restore, mobile 390.  
9. Do not deploy Shopify assets/Polaris; do not mutate production content during build.

---

## Scorecard (1–10, evidence-weighted)

| Dimension | Shopify | LH | Confidence | Notes |
|-----------|---------|-----|------------|-------|
| Information architecture | 9 | 8 | High | LH nav strong; blog page IA weak |
| Navigation / discoverability | 9 | 8 | High | Both solid |
| Visual consistency | 9 | 6 | High | Blog uses storefront tokens |
| Typography / hierarchy | 9 | 7 | Med | Source + Shopify screenshots |
| Spacing / layout | 9 | 5 | High | max-w-3xl vs two-column |
| Form usability | 9 | 6 | High | |
| Rich content editing | 9 | 4 | High | |
| Product management | 8 | 7 | Med | LH code strong; live BLOCKED |
| Order management | 8 | 7 | Med | COD specialization |
| Settings organization | 8 | 8 | Med | LH COD/shipping advantage |
| Feedback / errors | 8 | 6 | Med | |
| Accessibility | 8 | 5 | Med | Toolbar/a11y gaps |
| Responsive | 8 | 5 | Low | Blog responsive NOT TESTED live |
| Performance | 8 | 7 | Low | NOT TESTED metrics |
| Task efficiency | 9 | 5 | High | Blog path |
| Operational reliability | 8 | 7 | Med | Revisions API unused |

**Weighted overall (workflow 30 / visual 25 / interaction 20 / a11y-responsive 15 / reliability 10):**  
Shopify ≈ **8.7** · Laptops HUB ≈ **6.1** (blog-weighted). Re-score after Phase 1.

---

## Testing blueprint (Phase 1)

- Same-viewport screenshots 1440 / 1280 / 768 / 390 (100% zoom).  
- Keyboard-only format + tab order.  
- Paste from Word/Google Docs → sanitize.  
- Cover picker success/fail.  
- Draft → published → unpublish.  
- Schedule future (assert not public).  
- Revision restore.  
- Slug change redirect (if implemented).  
- Role editor can write; fulfillment cannot.  
- Isolated DB only for mutations.
