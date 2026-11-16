# Homepage customer reviews ("What our customers say")

Status: **implemented and verified on the isolated stack (2026-11-16)**. Not yet in production. It ships with
migration 29 (`20261118100000_store_testimonials_and_home_sections.sql`), which must be applied first.

## What the visitor sees

- A full-width section, two rows of review cards moving in opposite directions. The section is 100% width with no
  `100vw` overflow; measured: no horizontal scroll at 320, 390, 768 and 1440 px.
- **Pause / Play** button (`aria-pressed`). Rows also pause on hover, on keyboard focus inside a row, and while the
  section is off screen (IntersectionObserver).
- **Read all reviews** opens a native `<dialog>` listing each review once; Escape or the close button closes it.
- **Our profile on Google** links to the store's Google Maps listing (setting; can be removed).
- **Reduced motion:** rows do not move; they become swipeable rows, and the visual repeats are not rendered.
- Fewer than 4 reviews per row → that row stays still (it is never padded with repeats). Fewer than 6 reviews → one
  row. **Zero published reviews → the section does not render at all.**
- The visual repeats needed for a seamless loop are `aria-hidden`, `inert` and unfocusable, so screen readers and
  keyboard users meet each review once.

## Honesty rules (enforced in code and in the database)

| Rule | Where enforced |
|---|---|
| Only entries the merchant marks **Google** and links to the review on Google Maps show the Google "G" and "Posted on Google · View". Others say "Review sent to Laptops HUB" or "Customer testimonial". | DB check `google_needs_link` (host-anchored Google Maps link), zod schema, card renderer |
| Look-alike hosts such as `google.com.evil.example` are refused | Same regex in DB, zod, and settings validator; unit + SQL tests |
| Nothing is public until **published**, and publishing requires recorded customer **consent** | DB check `publish_needs_consent`, RLS (public select only `status='published'`), API |
| A customer photo needs recorded **permission** | DB check `avatar_needs_permission`, zod |
| **No aggregate rating, no review count, no review schema markup.** The 4.9 / 157 figures in the supplied HTML were not used. | No such code; unit test greps the modules; E2E checks JSON-LD |
| No invented reviews. The supplied HTML's reviews were **not imported**; the owner enters genuine ones. | Section hidden until the owner publishes |
| Review text is shown as plain text (HTML is never interpreted) | React text rendering; E2E posts `<img onerror>` and checks it is shown literally and not executed |
| Internal verification notes, consent flags and staff ids are never sent to visitors | Column-level grants: anon/authenticated can select only public columns |

## Admin: Reviews → Store testimonials (`/admin/reviews/testimonials`)

- Add / edit with a live preview of the homepage card; field-level error messages.
- Source (Google / sent to Laptops HUB / customer testimonial), Google review link, rating (optional — "No rating
  given" is the default, never assumed 5), review date (optional, no future dates), photo link + permission, consent,
  internal verification note, show on homepage, featured, display order.
- Workflow: **Draft → Waiting for approval → Published → Hidden**, with **Back to draft**. Delete (owner/admin/manager)
  asks for confirmation and keeps a copy in the audit log; Hide is the reversible option.
- Roles: owner/admin/manager can publish, hide and delete. **Editors** can add, edit drafts and submit for approval;
  they cannot publish, hide, edit published entries, or delete (UI hides the controls; API returns 403).
- Search, filter by status/source, sort (recently changed / homepage order / review date), status counts.
- **History** per entry from `audit_logs` (added, edited — changed fields only, submitted, published, hidden).
- Changes to published entries refresh the homepage immediately (`revalidateTag("testimonials")`); otherwise the
  public list is cached for 60 s.

## Theme editor (Online store → Customize)

Section **Customer reviews** (`v5_store_reviews`): on/off, heading, intro, **Position** (before the enquiry form —
default; after featured laptops; after the comparison section), Google profile link (Google Maps links only; empty
removes the button). The V5 order of the other sections stays fixed by design. Older saved drafts gain the new section
automatically (`withLaterSections`).

## Files

- `supabase/migrations/20261118100000_store_testimonials_and_home_sections.sql` — table, checks, RLS, column grants,
  theme-function whitelist update (and a fix for a pre-existing `RAISE … MESSAGE` defect in the two theme functions).
- `src/lib/content/testimonials.ts`, `testimonials-server.ts`, `home-sections.ts`
- `src/components/storefront/home/store-reviews.tsx` + `.module.css`
- `src/app/api/admin/testimonials/route.ts`, `[id]/route.ts`
- `src/app/(admin)/admin/reviews/testimonials/page.tsx`, `src/components/admin/testimonial-manager.tsx`

## Evidence

- `scripts/db-tests/testimonials-matrix.sql` — 19/19 (constraints, look-alike host, anon visibility and column
  privileges, no direct writes, theme draft accepts the new section types and refuses unknown ones).
- `tests/unit/testimonials-map.test.ts` — validation, roles, display helpers, settings sanitising, registry upgrade.
- `tests/e2e-isolated/p1-store-testimonials-map.spec.ts` — 5/5: editor submit-only (UI + API 403), owner approve →
  homepage shows it, provenance labels, HTML as text, no review JSON-LD, pause/play, dialog, widths 320–1440, hide →
  removed, reduced motion.

## Owner actions before this is visible

1. Enter genuine reviews (copy the customer's words exactly; for Google reviews paste the link to the review).
2. Record consent for each, then publish. Until then the section stays hidden.
