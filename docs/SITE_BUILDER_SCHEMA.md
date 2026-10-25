# Site Builder Schema & Storefront Theme Architecture

**Status:** Fully implemented, hardened, and verified with comprehensive RLS and E2E browser tests (Phases 5-8).
**Verification Evidence:** 
- E2E: `tests/e2e/theme-publish-workflow.spec.ts` (8/8 passed)
- RLS & Immutability: `scripts/test-theme-rls-matrix.mjs` (7/7 security gates passed)
- Smoke Test: `scripts/test-theme-publish-smoke.mjs` (passed)
- Presets: `tests/e2e/homepage-presets.spec.ts` (passed, all 7 remote WebPs HTTP 200)

---

## 1. Core Architectural Principles

1. **Separation of Renderer and Content:**
   - React components (`src/components/storefront/home/cinematic-hero.tsx`, `product-story.tsx`, etc.) define structural presentation, responsive CSS, and visual animations.
   - Database section instances provide merchant-customizable content (headlines, subheadings, CTAs, product handles, image overrides, visibility flags, display ordering).
2. **Approved V5 Seed Defaults:**
   - Database migrations seed default instances directly matching the approved frozen V5 homepage. The storefront never renders an uninitialized or empty state.
3. **Draft vs. Published Isolation:**
   - Saving a draft updates only the `draft` theme version for the template.
   - The public storefront never sees draft changes until explicitly published.
   - Publishing creates an immutable published snapshot and atomically updates the `theme_publications` pointer.
4. **Security & Immutability by Design:**
   - Public anonymous users have zero direct table access to `theme_templates`, `theme_versions`, or `theme_publications`.
   - Storefront reading is restricted exclusively to the `SECURITY DEFINER` RPC `get_published_homepage_sections(p_template_key)`.
   - Database triggers enforce that once a theme version is published or archived, its section payload cannot be altered—even by `service_role` outside authorized internal RPCs.
5. **Rollback & Version History:**
   - Every publication creates a discrete version row with snapshot JSON and audit metadata (`published_by`, `published_at`, `version_number`).
   - Rollback re-points `theme_publications` to a prior published version without losing historical records.

---

## 2. Database Schema & Migrations

The theme subsystem is introduced and hardened across four dedicated migrations:

### Tables (`supabase/migrations/20261025130000_site_builder_sections.sql`)

| Table | Purpose | Access Control |
|---|---|---|
| `theme_templates` | Registry of theme templates (`key = 'homepage'`) | Read: Authenticated staff. Direct Write: Denied. |
| `theme_versions` | JSON section snapshots (`status = 'draft' \| 'published' \| 'archived'`) | Read: Authenticated staff. Direct Write: Denied (RPC only). |
| `theme_publications` | Pointer table referencing current published `version_id` per template key | Read: Authenticated staff. Direct Write: Denied (RPC only). |

### Stored Procedures / RPCs (`20261025140000`, `20261025150000`, `20261025160000`)

1. **`get_published_homepage_sections(p_template_key text)`**
   - **Access:** Granted to `anon`, `authenticated`, `service_role`.
   - **Contract:** Looks up the active published version from `theme_publications` and returns the validated `sections` JSON array. Returns empty array if no publication exists.
2. **`save_homepage_draft(p_template_key text, p_sections jsonb, p_actor_user_id uuid)`**
   - **Access:** Authenticated staff with role `owner`, `admin`, or `editor`.
   - **Contract:** Validates section schema and image URLs (must be valid HTTPS), updates or inserts the template's `draft` version.
3. **`publish_homepage_theme(p_template_key text, p_actor_user_id uuid, p_change_summary text)`**
   - **Access:** Authenticated staff with role `owner` or `admin` only (`editor`, `manager`, `fulfillment` strictly rejected).
   - **Contract:** Copies current draft sections into a new immutable `published` version row, archives previous published version, and atomically updates `theme_publications.published_version_id`.
4. **`rollback_homepage_theme(p_template_key text, p_target_version_id uuid, p_actor_user_id uuid)`**
   - **Access:** Authenticated staff with role `owner` or `admin` only.
   - **Contract:** Validates that `p_target_version_id` belongs to the template and has status `published` or `archived`, then atomically sets `theme_publications.published_version_id = p_target_version_id`.

---

## 3. Immutability & RLS Enforcement Matrix

Tightly locked down in `20261025150000_theme_rls_inventory_hardening.sql` and `20261025160000_theme_immutability_service_role.sql`:

- **Direct Table Grants:** Direct `INSERT`, `UPDATE`, `DELETE` revoked from `anon` and `authenticated` roles.
- **Service Role Trigger Guard:** Trigger `theme_immutability_guard` intercepts DML on `theme_versions` and `theme_publications`. If `app.theme_mutation` session variable is not set to `'authorized'`, updates or deletes to immutable rows fail immediately.
- **Actor Spoofing Prevention:** RPCs verify the calling user's membership and permissions against `public.staff_memberships` using `auth.uid()`, strictly preventing actor parameter forgery.

---

## 4. The Seven Approved Homepage WebP Presets

Preserved strictly in `src/lib/content/homepage-image-presets.ts`.

### Section 01: V5 Cinematic Hero
| Slot | Approved Remote WebP URL | Default Product Handle |
|---|---|---|
| Dell Main Hero | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111` | `dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage` |
| HP Supporting Hero | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111` | `hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage` |
| Lenovo Supporting Hero | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111` | `lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage` |

### Section 02: V5 Product Story (4 Angles)
| Angle | Approved Remote WebP URL |
|---|---|
| Front | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-front.webp?v=1792935242` |
| Left | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-left.webp?v=1792935243` |
| Right | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-right.webp?v=1792935242` |
| Rear | `https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-rear.webp?v=1792935243` |

### Image Resolution Hierarchy:
1. Explicit merchant-published URL in section settings (if valid HTTPS).
2. Canonical approved preset URL for the matched product/angle.
3. Catalog product media fallback.

---

## 5. Merchant Customization Interface

Location: `/admin/online-store`
- **Section Controls:** Enable/disable section visibility, re-order sections, modify headlines, subheadings, CTAs, product handles, and media URLs.
- **Preset Management:** One-click "Reset to approved preset" for each of the 7 hero and product story assets.
- **Live Preview:** Dedicated `/admin/online-store/preview` route rendered in an isolated sandbox iframe displaying real-time draft state before publishing.
- **Publish & Rollback Controls:** 
  - Owner/Admin can enter a change summary and click "Publish theme".
  - Full version history table showing version number, date, author, and an active badge on the currently published snapshot.
  - "Rollback to this version" button instantly activates any previous snapshot.
