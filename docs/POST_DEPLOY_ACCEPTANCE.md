# Post-deployment merchant acceptance — 2026-11-17

Production now: merge `7e406df` (PR #11) → `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ`, regions `[sin1]`, aliased on `laptopshub.pk`
and `www.laptopshub.pk`. Previous release `772276b` (`dpl_ErqN6evfpCNXoidJrp5xGVAqiDnC`) remains in Vercel for rollback.
Database 29/29. Public COD disabled. `app.laptopshub.pk` CRM untouched (200).

Method: the owner's existing signed-in session in the desktop app's browser. **Read-only only.** No password was
requested, typed or stored. No production data was created, changed or deleted, because write tests need the owner's
specific authorization (see "Needs the owner").

## 1. Authenticated admin acceptance (read-only)

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
| Write journeys (create, publish, bulk apply, theme publish/rollback, staff invite/revoke) | **Not run on production**: needs owner authorization for test data. All covered on the isolated stack (36-step acceptance, 108/108) |

### Real authenticated latency (production, from Pakistan)

`docs/evidence/admin-perf/production-authenticated-2026-11-17.json`

- **Full page loads**, 26 admin pages × 8: TTFB p50 297–448 ms, p95 ≤ 581 ms. All 200, no error text.
- **Click navigation** (real sidebar clicks, 36 RSC requests): **p50 405 ms, p95 552 ms**, max 862 ms (first, cold
  product-list load).
- No interaction was reproducibly slow (none > 1 s), so no performance change was made. This replaces the modelled
  365 ms figure: the real figure includes the Pakistan ↔ Singapore network round trip.

### Production write tests (owner-authorized 2026-11-17, clearly named test data, cleaned up)

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
append-only audit history), plus the audit-log entries above.

Observations (not defects, no change made):
- "Open draft preview" opens a page that shows only the hero and product-story images. Other section edits (map,
  reviews, text) are visible only in the editor inspector, or on the storefront after a publish with
  `THEME_PUBLISHED_ENABLED=1`.
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

1. ~~Production write tests~~: done 2026-11-17 (see "Production write tests" above).
   a draft testimonial, a theme draft publish + rollback), or run them yourself. No customer notification can fire,
   because email is not configured and COD is off.
2. Approve **deleting the leftover test account** `cod-sandbox-…@lh-test.local` (deactivated; irreversible).
3. Decide on **leaked-password protection** in Supabase Auth (plan-dependent).
4. Sign out once and back in yourself to confirm logout on production. The agent won't, because it can't sign back in.
5. Supply genuine **reviews with consent**, the **email provider** and recipients, and the **COD inputs** in §5.
