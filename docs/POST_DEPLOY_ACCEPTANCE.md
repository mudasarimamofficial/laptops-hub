# Post-deployment merchant acceptance — 2026-11-17

Production now: merge `7e406df` (PR #11) → `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ`, regions `[sin1]`, aliased on `laptopshub.pk`
and `www.laptopshub.pk`. Previous release `772276b` (`dpl_ErqN6evfpCNXoidJrp5xGVAqiDnC`) remains in Vercel for rollback.
Database 29/29. Public COD disabled. `app.laptopshub.pk` CRM untouched (200).

Method: the owner's existing signed-in session in the desktop app's browser. No password was requested, typed or
stored, and the session was never ended. The acceptance ran in two separate passes:

- **Pass A, read-only audit** (§1.1): page loads, navigation, search and timings. Nothing was created, changed or
  deleted.
- **Pass B, authorized write tests** (§1.2), after the owner's specific approval on 2026-11-17: clearly named
  "QA TEST" data only, run through the real admin UI, then cleaned up.

### State after both passes (read back from the production database, 2026-11-17)

| Item | State |
|---|---|
| Catalog | Unchanged: 226 active products and 6 drafts, as before the tests |
| Test product "QA TEST — do not sell" | **Archived and soft-deleted, not erased.** Its row and its 3 stock-ledger rows remain, because the ledger is append-only audit history. It is not purchasable (`create_cod_order` refuses non-active products), its page answers 404 and it is not in the sitemap |
| Audit log | Every test action is recorded (`product.create`, `products.variants.sync`, `inventory.adjust`, `products.bulk_patch`, `testimonial.*`, `post.*`, `theme.homepage.draft_save`, `product.soft_delete`) |
| Orders | 0. No order was created |
| Public COD | Disabled. No live COD test was run |
| Store testimonials | 0. The QA draft was deleted; nothing was ever published |
| Theme | Nothing published (0 publications) and nothing activated: `THEME_PUBLISHED_ENABLED` is not set, so visitors see the V5 default |
| Owner session | Preserved (never signed out) |

## 1. Authenticated admin acceptance

### 1.1 Pass A: read-only audit

| Department | Result |
|---|---|
| Dashboard / COD readiness | Renders live counts. Readiness panel shows 4 blocking gates (see §5) |
| Analytics, Activity | 200, renders |
| Products list, editor, new, bulk, import/export | 232 products listed; editor shows variant picker, per-variant price and inventory mode; checkbox column present |
| Inventory, Collections | 200; 16 automated collections; all 226 purchasable variants "untracked" |
| Orders | Empty state (0 orders) with filters |
| Settings / shipping zones | Business identity, inventory defaults, labels, zone form; 1 zone "All Over PK" |
| Reviews: product reviews and store testimonials | Both render; testimonials empty state explains the homepage section stays hidden |
| Reels, Blog, Media, Merchandising, Navigation, SEO, Content, Help | 200, render |
| Theme editor (Customize homepage) | Renders the draft/preview/publish controls. Production runs without `THEME_PUBLISHED_ENABLED`, so visitors see the V5 defaults whatever is published |
| Staff | Owner active. **Finding:** a leftover test account `cod-sandbox-…@lh-test.local` (manager, deactivated, never signed in, 0 sessions) |
| Global search (Ctrl+K) and keyboard | Ctrl+K opens search; "dell 5400" finds the product; Enter opens it |
| Logout / cookie replay | **Not run on production**: it would end the owner's session. Verified on the isolated stack (4/4) |
| Write journeys | Not part of this pass; see §1.2 |

#### Real authenticated latency (production, from Pakistan)

`docs/evidence/admin-perf/production-authenticated-2026-11-17.json`

- **Full page loads**, 26 admin pages × 8: TTFB p50 297–448 ms, p95 ≤ 581 ms. All 200, no error text.
- **Click navigation** (real sidebar clicks, 36 RSC requests): **p50 405 ms, p95 552 ms**, max 862 ms (first, cold
  product-list load).
- No interaction was reproducibly slow (none > 1 s), so no performance change was made. This replaces the modelled
  365 ms figure: the real figure includes the Pakistan ↔ Singapore network round trip.

### 1.2 Pass B: production write tests (owner-authorized 2026-11-17, clearly named test data, cleaned up)

Run in the owner's session through the real admin UI. No customer-facing change; email not configured; COD off.

| Journey | Result | Evidence |
|---|---|---|
| Create product "QA TEST — do not sell" (draft, PKR 1,000, tracked qty 3) | PASS: saved as draft, not purchasable, storefront PDP 404, not in search | DB row; audit `product.create` |
| Variants: option RAM = 8GB / 16GB, own SKUs, prices PKR 1,000 / 1,200, qty 2 / 1 | PASS: "Saved 2 variants"; exact prices (100 000 / 120 000 paisa) and quantities stored; ledger `initial_stock` +2 / +1 | `products.variants.sync` |
| Inventory desk: +3 "Stock received" on QA-TEST-8 | PASS: 2 → 5; ledger row; low-stock badge updated | `inventory.adjust` |
| Bulk actions: select only the test row → Feature, then Unfeature | PASS: "1 selected", "Feature: 1 updated", "Unfeature: 1 updated"; no other product touched (featured count 0 after) | `products.bulk_patch` ×2 |
| Testimonial: draft "QA TEST" (not on homepage, no consent) → Submit for approval → Delete (confirmation dialog) | PASS: never visible to anonymous visitors (REST `[]`); deleted | `testimonial.create/status.pending/delete` |
| Blog: draft post with a `<script>` tag → Delete | PASS: saved as draft, script stripped by server sanitizer, `/guides/<slug>` 404; deleted after confirmation | `post.create/delete` |
| Theme editor: change map heading in the draft → Save draft → reload → restore → Save draft | PASS: draft persisted; live homepage unchanged; restored. The working draft equals the original for all 11 original sections, with map/reviews sections added at their defaults. **Nothing published** (0 publications) | `theme.homepage.draft_save` ×2 |
| Cleanup: Danger zone → type handle → Soft-delete | PASS: product archived + soft-deleted, PDP 404, not in sitemap; `create_cod_order` refuses non-active products | `product.soft_delete` |

Left on production by design: the archived, soft-deleted test product row and its 3 stock-ledger rows (the ledger is
append-only audit history), plus the audit-log entries above. The product was not erased.

Observations:
- "Open draft preview" showed only the hero and product-story images. Other section edits (map, reviews, text, order)
  were visible only after a publish. **Followed up in §7** (full preview, real ordering).
- Not tested on production: theme **publish/rollback** (the first publish would become the live pointer if the theme
  flag is ever turned on), staff invite/revoke (needs email; the only other account is the deactivated test account),
  order lifecycle (no orders; COD off), collections create (no delete path, so it would leave permanent data). All are
  covered on the isolated stack.

## 2. Production security review

Supabase advisors (`docs/evidence/security/advisors_prod_2026-11-17.json`): 62 findings, 0 ERROR.

| Finding | Verdict |
|---|---|
| 6 SECURITY DEFINER functions executable by `anon` (and the same + 4 theme RPCs by `authenticated`) | **Reviewed, not vulnerabilities.** `is_staff`, `has_staff_role`, `staff_can_edit_theme_drafts` answer only for the caller (`auth.uid()`; anon → false). `storefront_variant_availability` returns a boolean, never quantities, for active products. `get_order_confirmation_by_token` needs the order's random UUID token (random token → `[]`). `quote_cod_shipping` and `get_published_homepage_sections` are the storefront quote and homepage. Theme RPCs check owner/admin/editor role and reject a spoofed actor (isolated theme-rls test). Revoking them would break checkout and storefront |
| `auth_leaked_password_protection` off | **Owner setting.** Supabase Auth → Passwords → leaked-password protection (HaveIBeenPwned). Plan-dependent; not changed without approval |
| `rate_limit_buckets` RLS with no policy | Intended: service-role only, so all client access is denied |
| `auth_rls_initplan` ×2, `multiple_permissive_policies` ×14, `unused_index` ×28 | Performance hints on very small tables; no measurable impact at current volume. Not changed |

Direct API probes as anonymous visitor (production REST, read-only GETs):
- **Refused (42501):** orders, order_items, order_addresses, order_events, contact_inquiries, admin_memberships,
  audit_logs, inventory_ledger, notification_outbox, cod_collections, rate_limit_buckets, theme_versions,
  theme_publications, import_jobs, `product_variants.quantity_on_hand`, and the private columns of reviews and
  testimonials (author email, consent, verification note, created_by).
- **Allowed by design:** catalog (products, variant id/price), store_settings (brand, SEO, COD off, inventory policy;
  no secrets), shipping zones, published reviews and testimonials (display columns only).
- Anon table writes: `contact_inquiries` INSERT only. RLS on every public table; no unvalidated constraints.

Secrets: the live client JavaScript (20 chunks) contains exactly one Supabase JWT, role `anon` (public by design). No
service-role key. Production env vars: 2 COD flags, Supabase URL, anon key, service-role key (server only).

Sessions: the owner has 6 active sessions (one per browser/device signed in). Deactivating a staff member revokes their
sessions (isolated test). The test account above has none.

**No vulnerability was proven, so no security change was deployed.**

## 3. Reviews and map (live)

| Check | Result |
|---|---|
| Reviews section | Hidden (0 published). Wiring verified: published testimonials are read with the anon key (display columns only); every publish/unpublish clears the cache tag; homepage revalidates ≤ 60 s. With the theme flag off, the section renders automatically once a genuine testimonial is published |
| Old 4.9 / 157 rating | Absent from the live page |
| Attribution | Only `google` entries show "Posted on Google", and they require the link to the original review. Website and store-given entries are labelled as such. No aggregate rating is computed |
| Zero reviews | Intentional: nothing renders (no placeholder), on the homepage and in the theme preview |
| Unpublished reviews | Staff see each entry as the homepage card while editing (Reviews → Store testimonials). The theme preview shows published entries only, as customers would. Tests use synthetic "QA" entries on the isolated stack only; none were published on production |
| Carousel (isolated, 8 synthetic entries) | Full viewport width, no horizontal overflow, pause button, "all reviews" dialog with Escape; 5 browser projects |
| Map embed | `google.com/maps/embed?pb=…` pin "LAPTOPS HUB", Bahawalpur; "Open in Google Maps" → `maps.google.com/?cid=7987323353592411341` |
| Mouse / scroll reveal | PASS (3 browsers × desktop + phone) |
| Touch (phone, hasTouch) | PASS: link tappable at the bottom |
| Reduced motion | PASS: plain section, not sticky |
| **Keyboard** | **Defect found and fixed.** Focus entering the map stayed under the footer (WCAG 2.4.11). Fix in PR #11 (`7e406df`); the regression test failed on the old build in 5/5 browser projects and passes with the fix; live check now PASS in Chromium and WebKit |

## 4. Notifications and email

- Flow: `create_cod_order` writes one `notification_outbox` row per order. The order API then delivers it right after
  the response (`after()`). Delivery uses a lease (`claim_notifications`, SKIP LOCKED), backoff 1/5/30/120/360 min,
  max 5 attempts, a provider idempotency key per recipient, and a staff "Retry sending" button on the order page. A
  daily Vercel cron (`/api/cron/notifications`, 06:00 UTC, Hobby plan limit) is the safety net and needs `CRON_SECRET`.
- Provider: Resend REST API. Needs `RESEND_API_KEY`, `STORE_FROM_EMAIL` (verified sender), `STORE_NOTIFY_EMAIL`
  (alert inbox), and optionally `NOTIFY_CUSTOMER_EMAIL=1`. Staff invitations use the same transport.
- **Production today: none of these variables exist**, so nothing is sent, nothing is reported as sent, and staff
  invitations cannot be delivered.
- DNS: no MX (no inbound mail to @laptopshub.pk), no SPF, no DMARC, no Resend DKIM. Inbound mail needs a mailbox
  provider's MX records. Outbound needs Resend's issued DKIM/SPF records. These are separate decisions. No records were
  added, and no test email was sent (no provider, no confirmed recipient).

## 5. COD go-live checklist (production state)

| Requirement | State |
|---|---|
| Legal policies (shipping, returns, warranty, privacy, terms) approved and published | **Missing**: owner text and legal approval |
| Real delivery zones and courier serviceability | 1 zone "All Over PK"; **fees not confirmed** as courier tariffs |
| Approved shipping and COD fees | **Missing** |
| Real inventory quantities / tracking policy | **Missing**: all 226 purchasable variants untracked |
| Merchant order-handling responsibility | **Missing**: who confirms, packs and ships, and the response time |
| Notifications working | **Missing**: no email provider (§4) |
| Client staff access | Owner only; invitations need email |
| Controlled real COD order | **Not run**: needs specific approval after the above |

Public COD stays **disabled** (env flags off, store setting off). The admin readiness panel shows the same 4 blocking
gates.

## 6. Needs the owner

1. ~~Production write tests~~: done 2026-11-17 (§1.2).
2. Approve **deleting the leftover test account** `cod-sandbox-…@lh-test.local` (deactivated; irreversible).
3. Decide on **leaked-password protection** in Supabase Auth (plan-dependent).
4. Sign out once and back in yourself to confirm logout on production. The agent won't, because it can't sign back in.
5. Supply genuine **reviews with consent**, the **email provider** and recipients, and the **COD inputs** in §5.

## 7. Theme editor: findings and fixes (deployed 2026-11-17 in `7abb680`, `dpl_2gJc3wmKpE5hxJrQywnCrLRBrcay`)

Found while preparing the theme for the owner. Fixed and tested on the isolated stack. Released with the Next 16.4.5
security patch (PR #12). The live QA record is in `FINAL_CLIENT_HANDOVER.md`. One further admin layout fix (editor
overflow at 1024–1279 px) is in PR #13 and awaits owner approval.

| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | The draft preview showed only hero/story images, on a separate admin page | `/preview/homepage` shows the real storefront: header, footer, every section, and the map after the footer. It is rendered by the same code as the homepage. Draft / Published / V5 default switch, "Back to editor", works at phone width. Also embedded in the editor at desktop, tablet and phone width | `docs/evidence/theme/*.png` |
| 2 | Preview privacy | 404 for visitors and for staff without theme rights (manager, fulfillment). `X-Robots-Tag: noindex, nofollow`; `Cache-Control: private, no-store`; disallowed in `robots.txt`. Drafts are read only after the staff check | isolated E2E "preview is private" |
| 3 | Section order was fixed in code; the editor showed a numbered list it could not change. Reviews had a separate "position" setting | Real ordering: Move up/down buttons (keyboard focus kept, screen-reader announcement) and hide/show. Preview, publish and rollback all use the order. The hero stays first and the map stays after the footer (structural). The API refuses other placements. Removed two controls that had no effect: the promo "headline", and the reviews "position" (replaced by moving the section) | isolated E2E "invalid placements", "reorder + hide + edit → … → rollback" |
| 4 | Older drafts stored the registry order, which never matched the page | Layouts saved before ordering existed are read in the approved V5 order, so publishing one cannot reshuffle the homepage | unit `homepage-layout.test.ts` |
| 5 | **Defect:** with `THEME_PUBLISHED_ENABLED=1`, regenerating the cached homepage failed ("static to dynamic at runtime, reason: cookies"). Building with the flag on would instead have left the homepage uncached on every request | Published sections are read without cookies (anon key) and cached under a `homepage-theme` tag. Publish and rollback expire that tag, so changes show immediately and `/` stays cached | server log before/after; publish → public check in E2E; build route table shows `/` static with the flag on |
| 6 | The admin did not explain whether the flag is on | The editor states whether customers see the published version or the V5 default, and what publishing does in each case | `editor-desktop.png` |

No visual change: with the flag off and with the flag on, the homepage HTML from the new code equals the previous
build. Only React's generated element ids differ. The V5 default, saved and published as a theme, renders exactly like
the built-in default (isolated E2E "publishing the default layout changes nothing visible").

Activation is an owner decision and has not been done. Deploying this code changes nothing for customers while
`THEME_PUBLISHED_ENABLED` is unset. Turning the flag on also changes nothing until a version is published. The first
publish then becomes what customers see.

Admin UX inspection (read-only, production, 2026-11-17) covered products, inventory, collections, reviews,
testimonials, blog, theme, staff, settings and orders:
- no console errors, and all API requests returned 200;
- no horizontal overflow at 375 px;
- the search dialog moves focus inside, closes on Escape and returns focus to its trigger.

No reproducible defect was found, so nothing was changed.
