# LAPTOPS HUB — PRODUCTION ENGINEERING MASTER PROMPT & COMPLETE PROJECT BIBLE

**Read this entire file before touching code. This file is both a comprehensive product specification and your autonomous implementation instruction.**

**Your role:** Act as principal full-stack architect, senior Next.js/React engineer, e-commerce operations architect, PostgreSQL/database engineer, Supabase specialist, Vercel/DevOps engineer, security engineer, visual QA engineer, accessibility engineer, Pakistan COD commerce specialist, and technical writer. Execute as one coordinated engineering team. Think carefully, write real code, test it, ship verified increments, and produce a genuinely operable store, not another design-only prototype.

**Business:** Laptops HUB — an independent Pakistan-focused online electronics retailer selling laptops, Chromebooks, MacBooks, tablets, gaming devices, chargers and computer accessories.

**Nonnegotiable deliverable:** A production-quality, full-stack, merchant-operated e-commerce business deployed on the EXISTING Vercel project, backed by the EXISTING Supabase project and version-controlled in the EXISTING GitHub repository. **Cash on Delivery (COD) is the ONLY customer checkout payment method.** Preserve the approved Claude Design V5 storefront's visual identity and interaction quality to the closest achievable, evidence-verified fidelity.

**Project connections supplied by owner:**
- GitHub: `https://github.com/mudasarimamofficial/laptops-hub.git` (`mudasarimamofficial/laptops-hub`, default branch `main`). At initial inspection, this repo was public and EMPTY. Do not assume it still is; verify the current state.
- Supabase project ID/ref: `xvmmjkrkgznnakcobmww`
- Supabase URL: `https://xvmmjkrkgznnakcobmww.supabase.co`
- Vercel project ID: `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`
- Vercel project name (provided by owner): `laptops-hub`; verify project ownership, team and link before deploying.
- Owner reports GitHub/Supabase/Vercel CLIs authenticated in their LOCAL Cursor/PowerShell environment. **Check, do not assume, which accounts, projects and permissions the running shell actually has.**
- Authoritative design/reference archive currently open in this Cursor workspace: `Laptops Hub storefront.zip` (locate the exact local path; do not assume `/mnt/data` exists on the owner's computer).
- Locale and currency: Pakistan, English-first, `en-PK`, timezone `Asia/Karachi`, `PKR`. Respect the option to extend localization later.
- Launch domain: not provided; operate initially on a Vercel preview URL. Request the actual custom domain and DNS authorization before configuring it. Never invent a final public URL.

## ABSOLUTE ARCHITECTURAL DECISION

This project is **NOT** a Shopify theme implementation. The owner has explicitly chosen **an independent web business hosted on Vercel and operated through a custom admin dashboard**, with Supabase as its application database. The original Shopify CSV is the one-time catalog import reference, **not a live Shopify API dependency**. DO NOT create Shopify Liquid templates, Shopify carts, or Shopify checkout, and do not require a Shopify subscription, gateway or payment provider for ordinary COD order placement. The final buyer experience must be **Next.js storefront → secure order request → atomic database commit in Supabase → real order record → merchant COD fulfillment dashboard → notifications and reporting**.

Use a modern, supported stable stack: Next.js App Router, React, TypeScript (strict), Node runtime for server-only commerce operations, Tailwind CSS or scoped CSS as appropriate for faithful V5 porting, Supabase Postgres/Auth/Storage, Zod (or equivalent runtime validation), and Playwright for end-to-end/browser visual testing. Select compatible **current stable package versions after checking the existing repository and official documentation**; do not assert a version number without confirming it. Prefer a simple cohesive system, not an enormous pile of overlapping state libraries, ORMs and CMSes. You may use a type-safe data access layer, but commit SQL migrations and generated DB types. `@supabase/ssr` is a supported SSR option but watch for API changes. Use Supabase Auth for merchant/customer sessions, server-side role checks for ALL admin operations, and careful RLS/grants for exposed database tables.

**Safety and operational contract:** Never push secrets or raw internal-cost/CRM CSV to the public repository; never execute destructive database operations without a backup, a concrete impact assessment and owner consent; never publish a production checkout before all release gates pass; never claim payments or messages were delivered without proof. No need to ask approval for routine reversible code changes, but ask before destructive mutations, secrets/billing/configuration changes that impact the business, sending live messages, enabling real order acceptance, changing domains/DNS, or public production launch if approval is not otherwise explicit.

---

# PART I — AUTHORITY, PROJECT RECOVERY, AND FORENSIC AUDIT

## 1. Project source priority and preservation

1. The ORIGINAL **final** Claude Design V5 source in the attached ZIP is the authoritative VISUAL and INTERACTION baseline; it is NOT the production technology architecture.
2. The uploaded final Shopify CSV (`data/source/products_export_final.csv`, or its verified local counterpart) is the authoritative ORIGINAL IMPORT snapshot for handles/titles/prices/images/publication status. AFTER initial reconciliation, Supabase becomes the operational live source of truth.
3. The approved business rules in this prompt override prototype conveniences, e.g. use real COD ordering rather than local fake cart, and do not publicly display stock counts.
4. Original package `docs/` documents intended routes, design tokens, elements and known limitations. Audit and resolve contradictions instead of blindly copying past Shopify-only assumptions.
5. Keep all original source files read-only in a local `reference/` directory that is NOT served publicly, or in a separate archived folder outside repo. Extract needed, cleared assets into appropriately named public assets. Don't copy the entire ZIP into `public/` or the git repository.
6. Do not erase the existing working directory, Git history, or production configuration. Inventory current files first. If repo is empty, initialize carefully and create the baseline commit without private data.
7. Use a feature/development branch and atomic commits. Confirm the correct repository remote and permissions before pushing. Don't force-push `main`.

## 2. Read actual archive, don't guess

Inventory paths and inspect the following where available:
- `Laptops Hub Storefront v5.dc.html` (about 202 KB)
- `ProductCard v5.dc.html`, `LHImg.dc.html`
- `support.js` (custom Claude Design runtime; **do not rely on it in production**)
- `data/lh-catalog.js` (`window.LH_CATALOG` catalog snapshot)
- `data/lh-content.js` (info pages, navigation and drafts)
- `data/source/products_export_final.csv`
- `assets/cut/`, `assets/src/`, `assets/scene/`, `assets/cutouts/`
- `docs/DESIGN_SYSTEM.md`, `COMPONENT_INVENTORY.md`, `INTERACTION_MATRIX.md`, `ROUTE_INVENTORY.md`, `PRODUCT_DATA_MODEL.md`, `MEDIA_ASSET_MANIFEST.md`, `OWNER_APPROVAL_CHECKLIST.md`, `RELEASE_GATE.md`, `FINAL_QA_REPORT.md`, `RESPONSIVE_QA.md`, `BUSINESS_CONTENT_REQUIREMENTS.md`
- `qa/` and `QA Catalog.html`, `QA Functional.html`, `QA Viewports.html`.

**Important facts verified from uploaded ZIP:** It is a hash-routed `.dc.html` prototype with custom `<sc-if>`, `<sc-for>` components and `{{ }}` expressions, not ordinary React/Next.js. The previous e-commerce cart/compare are browser local, checkout disabled, and many forms demos. You must rewrite this into production React/Next.js components, server APIs and a real database. Do not simply serve `.dc.html` with `support.js` as the final site. All routes must become SEO-readable ordinary URLs without `#/`.

**Known source baseline:** CSV has **968 rows** representing **232 unique products**, of which **226 are active + published**, **6 are drafts**, with **964 product media URL rows**. The original 50 handles are retained; there are 182 additional unique handles. Catalog includes Dell, HP, Lenovo, Apple, Microsoft and other brands, accessories, gaming laptops, tablets, and one genuine HP Chromebook 14 G5 (4GB/32GB). The Chromebook Type-C charger is an accessory, never a Chromebook laptop. Price range observed in CSV from Rs 0 draft to Rs 270,000; Rs 0 cannot become a public sellable checkout line. Product export has no inventory tracker value for any product. Do not infer zero inventory implies sold out or that every item is physically in stock. Product media rights previously reported as unverified; verify authorization with the owner before launching.

**Initial repository finding:** GitHub repository is public and was empty at inspection. Because CSV fields include internal notes and `Cost per item`, **never commit original CSV, unredacted `lh-catalog.js` if containing private notes, internal compliance flags, real customer data, .env files, database dumps or admin credentials to public git**. Either work with sanitized seed data checked into Git or use secured local ingestion; document the exact provenance and how to rerun import. An alternative is to make the repository private after owner approval. Public assets should contain only rights-cleared media. This is a release/security gate.

## 3. Preflight commands and read-only verification

Using PowerShell / terminal INSIDE the actual Cursor project:
- `git status`, `git remote -v`, `git branch --show-current`, inspect `.gitignore`.
- `node --version`, `npm --version` (or existing pnpm), `npx next --version` only if installed.
- `gh auth status` if GitHub CLI is installed.
- `vercel whoami`, `vercel project ls`, `vercel link` **only to existing project** after verifying the owner/team/project ID.
- `supabase projects list`, `supabase link --project-ref xvmmjkrkgznnakcobmww` after verifying correct account. `supabase db remote commit/push` or SQL migrations must NOT run until migration review and backup procedures are ready.
- Confirm the Vercel project ID matches `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`; refuse to deploy to a mismatched project.
- Inspect the existing Supabase schema, Auth settings, storage buckets, existing migrations and data non-destructively before designing tables or running anything.
- Check whether Vercel Git integration for `mudasarimamofficial/laptops-hub` is already configured; connect it if authorized, without creating another redundant project.
- Check current account/plan limits, Supabase idle/pausing behavior, Vercel function limits, cron and backup entitlements. Do not assume a free plan is sufficient for a continuously available revenue-generating store.

Produce `docs/00_FORENSIC_AUDIT.md` covering source shape, file inventory, supported rendering/runtime, pages/features, original asset dependencies, test evidence limitations, repository status, cloud linkage, unresolved security/data issues and a concrete implementation strategy. Produce a complete design-route/interaction parity matrix and keep updating it.

---

# PART II — NON-NEGOTIABLE PRODUCT & EXPERIENCE BIBLE

## 4. Business model and key commercial behavior

This is a **real independent online store**, not a localStorage mockup, catalog landing page, one-off form, Shopify skin, or payment-page demo. It sells physical products in Pakistan. A buyer can browse, find products, compare, add to cart, enter their delivery details, see a fully recomputed final price, and place a genuine **Cash on Delivery** order. The order is committed durably to Supabase; the customer gets an order number and appropriate confirmation; the merchant sees it in a secure admin dashboard and can fulfill, cancel, track, export and reconcile COD collection.

**Only payment method:** Cash on Delivery. Do not display or activate Stripe, PayPal, JazzCash, Easypaisa, bank transfer, credit cards, installments, prepaid discounts, online payment redirects, wallet, or fake payment collection. Do not introduce a payment provider because the engineering stack supports it. If the source design has payment-related messaging, replace it with truthful COD-only messaging approved by the owner. No 'Pay now' button. Checkout CTA should be **Place COD Order** or owner-approved equivalent. COD 'payable amount' = customer owes courier/merchant at delivery, never marked as paid until collection is confirmed by admin.

**Guest checkout is required**. Customers must NOT need to create an account to buy. Optional customer accounts/order history can be implemented if it does not disrupt guest checkout. Merchant admin authentication IS required. The business must work with a browser and admin dashboard; the merchant should not need code to manage daily operations.

**No public stock counts/badges:** Never render "2 in stock", "only N left", warehouse quantity, tracker names, remaining stock filters, etc. Inventory management may exist privately in admin; default imported products should be `untracked` unless verified otherwise. Actual cart acceptance must still follow merchant-approved availability/publishing/business rules. 'Untracked' is not a license to accept unrealistic or fraudulent bulk orders; set configurable quantity and anti-abuse limits without inventing stock counts. If merchant turns on tracked inventory later, enforce it transactionally.

**Truth-in-advertising:** no fake testimonials, business addresses, warranties, returns, delivery dates, merchant credentials, discounted prices, inventory or Chromebook specs. Missing data should lead to admin content blockers or non-misleading customer display, not invented claims.

## 5. Absolute V5 pixel-fidelity contract

The **approved V5** appearance must remain as close as technically possible to the reference across all key routes and states. This is a **surgical implementation**, not a redesign. Do not simplify the cinematic hero into a stock photo and button. Preserve aesthetic identity while replacing prototype internals:
- Laptops HUB wordmark: `Laptops` + WHITE `HUB` on SOLID RED background `#E52434`, radius ~6px. NO cyan/violet HUB badge.
- Primary action Sapphire `#2159D4` (hover `#1748B5`), canvas `#F6F9FE`, titanium `#DFEAF7`, ice `#EAF3FE`, navy `#0A1730`, cyan lighting `#1CB9E8`, violet ambiance `#6574D5`, ink `#102039`, secondary ink `#52637B`, borders `#DAE5F2`.
- Font system: Sora (display/headings/prices), Hanken Grotesk (body/UI), JetBrains Mono (kickers/SKUs), using legal/optimized font delivery.
- Commerce max container ~1360px, content ~1200px, edge gutter clamp(16px, 3vw, 32px), original corner-radius/spacing hierarchy.
- Light premium retail sections + precisely chosen dark cinematic hero/story/footer sections; sapphire CTAs, red section-line signatures, restrained cyan/violet lighting. No random new palette.
- Sticky translucent header, mega menu, accessible mobile drawer, predictive search experience, compare counter, live cart counter and drawer.
- Original layered cinematic hero, responsive desk/mobile backdrops, laptop cutouts, ring, stage, parallax/entrance, skip intro, reduced-motion behavior.
- Pinned **Find your next machine** scroll product story: four distinct real Dell Latitude 7420 photographic views; smooth scroll progress, specs, price and CTA; when live database data changes, validate the showcased product exists and its imagery/price matches. If no longer present, switch to an owner-selected valid featured product; do not hardcode stale price/quantity.
- Avoid the previously fixed clipping at ~1897×860; product story price, actions, spec cards must remain accessible at 1366×680, 1024×768, 768×1024, and mobile 390×844. Compare tray must not cover story CTA on mobile. Fixed/pinned scenes must release correctly. Do not make mobile scrolling janky.
- Chromebook visual campaign featuring only verified HP Chromebook 14 G5 if still public, plus a scalable collection for future additions. No charger misclassified as Chromebook computer.
- Strong Dell/HP/Lenovo brand tiles, featured product carousels, spec/budget sections, compare teaser, product cards and galleries. Match actual source hierarchy/animations in screenshot and code where evidence exists.
- Collections/search filter and sort interface, product-page gallery and spec table, compare table up to four, content pages/FAQ, support, cart, all responsive states.
- Real checkout pages must be newly designed **in the existing V5 design language**; apply the same tokens, typography, cards, accessible forms. Do not downgrade to an unrelated generic form.
- Admin dashboard may use a coherent professional variation of the same identity; it does not need a cinematic scroll hero, but MUST be efficient, usable, accessible and responsive.

**Visual QA:** Use the original reference served locally (e.g. `npx serve` in reference/), and the Next.js app side by side at identical viewports, scroll points and UI states. Take baseline and implementation screenshots; diff them, note objective deviations, correct iteratively. Test at 1920/1897, 1440, 1366×680, 1280, 1024, 905, 768, 430, 390, 360. Use Playwright screenshot tests with animation synchronization, real viewport sizes and reduced-motion variants. Design frozen ≠ no fixes: improve robustness without gratuitous changes. Where actual image resolution/rights prevent fidelity, record the exact blocker and provide an honest fallback.

## 6. Route and information architecture

Create **normal server-routable URLs** with per-page metadata, e.g.:
- `/` Home.
- `/shop` or `/collections/all` All public items, with a canonical convention.
- `/collections/[slug]` collections (laptops, accessories, chargers, Dell, HP, Lenovo, workstations, 2-in-1, price tiers, memory/CPU, gaming, MacBooks, tablets, Chromebooks, relevant manufacturer groups) based on verified category membership and saved filter rules.
- `/products/[handle]` all 226 public product pages; drafts must not be indexable or exposed.
- `/search?q=...` and optional live accessible predictive search overlay.
- `/compare`, `/cart`, `/checkout`, `/order/success/[opaque-token-or-number]` (private confirmation, never public by guessable ID).
- `/track-order` (secure lookup; phone/OTP or expiring signed link to prevent enumeration).
- `/pages/about`, `/pages/why-laptops-hub`, `/pages/contact`, `/pages/faq`, `/pages/shipping`, `/pages/returns`, `/pages/warranty`, `/pages/condition-guide`, `/pages/how-to-choose`, `/pages/comparison-guide`, `/pages/order-inquiries`, `/pages/privacy`, `/pages/terms` (or an equivalent clean canonical mapping and redirects).
- `/guides`, `/guides/[slug]` with the four draft articles only published after editorial approval.
- `/account` (optional buyer account and orders); admin separated under `/admin/*`.
- 404, loading, error, empty state and server unavailable fallbacks.

Audit every route from `docs/ROUTE_INVENTORY.md` and map all links. Source has ~39 catalog collections, 226 public PDPs, info/support pages, guides and FAQ. Preserve public 226/232 initial visibility. Create a full mapping/redirect plan from prototype hash URLs to canonical URLs. Use no public `#` hash-routing for pages; hash anchors may be used for in-page chapters only. Data-driven filters must be indexed, correct, and no random product duplication.

## 7. Catalog rules / 232-product preservation

1. Parse the exported CSV by Shopify `Handle`, not one row per image. All 968 raw rows produce 232 unique products, NOT 968 products. Use the nonempty `Title` product row and all related variant/image rows. Each product has a stable unique handle. Validate duplicates and variants explicitly. 232 products should be represented in DB/admin; only 226 are initially customer-visible; 6 drafts remain hidden until owner approval.
2. Preserve original titles, handles, prices in PKR, SKUs (when present), product type, vendor, tag flags, image order/alt and original metadata. Import must be **idempotent**: repeat import updates permitted fields without creating duplicates, preserves admin edits unless explicit overwrite chosen, generates reconciliation report and supports dry-run/diff/rollback.
3. More than one product may legitimately share the same title; handle/SKU or stable import source ID, not title, is the primary key. Never merge same-titled devices without owner approval.
4. The import has **one `Option1 Name=Title` row per product**, but model variants in DB in a general way for future selectable options. For now a product can have one standard variant. Do not invent attributes or variants absent from CSV.
5. Preserve 964 image references, ordered by `Image Position`; prefer remote URLs only for preview if rights/availability permit. For production, store authorized assets in suitable storage/CDN, with responsive derivatives, alt text, cache controls and organized media relations. Do not hotlink forever without a delivery/rights/availability plan.
6. The original `Body (HTML)` contains internal CRM notes, and some early curated descriptions also do. Never display those. Parse, sanitize and segregate internal raw notes into access-restricted import audit files rather than public product JSON or HTML. New products with unverified specs display only verified facts from title/owner.
7. Product condition: present when verified; do not assume all devices are Used or New. Build optional merchant-defined condition grading after owner supplies actual grading policy.
8. One real HP Chromebook 14 G5 is in catalog; its missing processor/display/condition remain unknown until owner confirms. A Chromebook Type-C charger belongs under accessories.
9. Unbranded accessories with Vendor `Laptops HUB` must not appear as a laptop manufacturer. Provide separate normalized `manufacturer` nullable field vs `merchant_vendor` / seller. Avoid inventing OEM brands.
10. 6 drafts remain private; 2 public products carry identity/configuration review flags. Keep a private review queue so admin can correct/withdraw without fake claims.
11. Prices: store integer PKR minor units (paisa) or a deliberate exact-decimal NUMERIC strategy with precise integer math; never floats for totals. CSV `Variant Price` is in PKR **major units** (`16000.00` means Rs 16,000); convert consistently. If integer paisa is used, multiply parsed decimal by 100 exactly. Formatting shows PKR Rs 16,000, with consistent locale. Price must be >=0 in DB; prevent public checkout of zero/invalid-price lines. Compare-at, discounts and taxes only from verified rules.
12. Product state must include `draft`, `active`, `archived`, `featured`, and media/content approval statuses where needed. Public query must fail closed to active + published + approved media/policy requirements established for launch. Distinguish internal editorial status from purchase eligibility.
13. Once database is authoritative, admin edits must update product pages/search/collections promptly via safe cache invalidation/revalidation. Don't ask merchant to edit JS files. Provide bulk CSV import/export with validation preview; archive/delete with confirmation and reversible handling.

---

# PART III — E-COMMERCE CORE: TRUE CASH ON DELIVERY, END TO END

## 8. Customer shopping journey — nonnegotiable acceptance scenario

A real buyer on mobile should be able to:
1. Open the deployed Vercel storefront and browse live products with real images/prices.
2. Search/filter/sort, inspect true specs, select an available purchasable product, change quantity within the merchant's rules, compare up to four.
3. Add/remove/update cart lines and retain a cart between navigation/reloads; if using guest cookie/local cart as UI cache, the **server MUST reprice and revalidate everything at checkout**. Never accept browser-computed totals, prices, quantities, shipping, coupon values or product availability.
4. Open a polished COD-only checkout (same V5 design); enter customer name, Pakistan mobile, optional email, complete delivery street/address, city, province/region, postcode if required by chosen courier, landmark optional, note optional; shipping district/zone must be validated.
5. See a transparent final order summary: line subtotal, genuine approved discounts, shipping fee, taxes if legally applicable/configured, COD service fee only if approved, grand total **cash due at delivery**. No hidden fees. Avoid inventing free shipping or tax rates. Disable checkout for regions not served or where mandatory merchant settings are unconfigured; clearly communicate this.
6. Explicitly confirm the cash-on-delivery commitment; submit once; see a loading state and duplicate-click protection.
7. Receive **genuine success only after the database has committed the complete order** and server returned authoritative order number/totals; refresh/retry safely without duplicate order creation.
8. Receive appropriate confirmation (onscreen always; email/SMS/WhatsApp ONLY when an approved and actually configured delivery provider confirms sending). If no provider exists, do not falsely say SMS/email was sent.
9. View order confirmation/track status securely without exposing private customer data to anyone guessing a sequential order ID; see cancellation/contact policy if approved.
10. Merchant sees the order in admin instantly, accepts/confirms, packs, assigns courier/tracking, marks out for delivery, delivered and **COD cash actually collected**, or cancels/returns with reason; order history and totals are auditable.

## 9. COD-only payment state and fulfillment state — SEPARATE them

**Payment method enum: `cod` only. Payment status** must not be conflated with shipping. Suggested statuses: `unpaid_cod`, `collection_pending`, `collected`, `partially_collected` (only if business permits), `collection_failed`, `refunded_or_adjusted` (manual reconciliation). The initial placed COD order is NOT `paid`. If the merchant marks order Delivered, do not automatically mark collected unless approved operational flow explicitly records collection at delivery; use an explicit protected action for COD collection with amount, collector/reference, timestamp and audit trail.

**Fulfillment/order status** needs documented state machine: `placed` → `pending_confirmation`/`confirmed` → `packing` → `shipped` → `out_for_delivery` → `delivered`, plus `cancelled`, `delivery_failed`, `returned`, `return_requested` (if policy approved). Define allowed transitions, authorization, reason-required terminal states, and immutable event history. Admin cannot bypass validation with direct client UPDATE. Include partial fulfillment only if actual business needs; don't invent extra shipping workflow complexity before MVP.

**Money accounting:** separate line prices, order-level discounts, shipping/tax/COD fee, amount due, amount collected, outstanding balance, manual refunds/adjustments. Persist order-time snapshots so historical orders remain correct even when product titles or prices later change. COD is not online capture; don't introduce Stripe/payment gateway secrets or card storage.

## 10. Secure, atomic order creation

Implement a server-only `POST /api/checkout/cod` or equivalent server action, plus a transactional PostgreSQL function/procedure. The entire durable operation must be atomic:
- Validate Zod payload and rate limits/captcha strategy.
- Determine authenticated customer or secure guest identity.
- Validate every line (positive integer quantity, same variant, published/allowed, reasonable max order qty, price and currency). Fetch CURRENT authoritative DB data server-side.
- Re-evaluate all line totals, coupon rules if any, shipping zone, delivery eligibility, fees/taxes, and total with exact arithmetic.
- Enforce stock check/reservation atomically IF tracking is enabled for that product (row lock or safe conditional update); don't oversell. For untracked products, apply configured per-order limits and merchant restrictions without showing stock badges. If reservations exist, define expiration/release on cancel/failure/timeout; do not implement indefinite locks.
- Insert order, order address and immutable order item price snapshots, initial status event, optional reservation and notification outbox entry IN ONE DATABASE TRANSACTION.
- Protect with unique idempotency key scoped to cart/session/customer. Duplicate button press, retry, network timeout or serverless replay must return the SAME existing order rather than create another.
- Use database-generated internal IDs (UUID) plus a human-friendly unique order number (collision-safe). Do not make lookup possible via predictable numbers alone.
- Commit, then return success, do NOT call email/SMS as part of critical transaction. Queue notification outbox; retry asynchronously with deduplication and delivery status.
- On any failure, rollback entirely and return safe human-readable error. Never insert half an order or show a fake success.

**Concurrency acceptance test:** two buyers racing for last tracked unit cannot both buy it if overselling is disabled. Five duplicate concurrent COD submits with the same idempotency key create ONE order. A browser request tampering a product price or shipping fee cannot lower the database-computed total. Unauthenticated public users must never be able to create orders by direct `orders` table inserts via Supabase publishable key.

## 11. Checkout validation specific to Pakistan

- `PKR` only and display `Rs` consistently. Apply business-approved tax calculation/configuration; don't hardcode legal tax rules or claim tax-inclusive/exclusive without approval.
- Pakistan mobile numbers: normalize and accept common valid national/international forms such as `03XXXXXXXXX` and `+923XXXXXXXXX`. Use a tested phone utility, validate syntax and preserve full normalized number securely. Never assume a phone is verified unless actual OTP is used.
- Shipping: collect street and city, select province/region, postcode when required by courier; recipient and alternative number optional as configured. Support configurable city/district coverage, flat/zone-based courier fees, pickup only if merchant offers it. Unknown or unsupported service area should fail safely at checkout, with meaningful message.
- COD confirmation text: "Place order — pay [amount] on delivery"; display terms only after legal approval. Store the exact reviewed confirmation version/time.
- Privacy: minimize PII, encrypt transit, access control, limit retention, redact logs and exports, never expose full phone/address in public APIs.
- Fraud/abuse: rate limiting by IP + normalized phone + session, honeypot and/or approved CAPTCHA, duplicate order cooldown, suspicious order queue, optional OTP if real provider configured, merchant review queue and manual cancellation. Avoid blocking genuine customers because of shared IPs; log false positives.
- Courier integration: start with usable manual tracking and carrier name/tracking number; do not assert third-party courier API integration unless credentials and tests exist. Provide configurable integration adapters for later authorized courier connections.

## 12. Cart and quote logic

Frontend cart UX matches V5 (drawer, full page, quantity controls, cross-sell, empty state, persistent compare tray). Cart can be in localStorage for convenience ONLY as an untrusted user preference; server is authoritative for availability/prices and order submission. Prefer cookie/session-bound cart with optional DB-backed account persistence if complexity is justified. Guest cart works without login. Handle unavailable/archived product between adding and checkout gracefully. Valid quantity controls must not default to 99 as a universal allowed stock promise. Server always recalculates subtotal and total, and changes must be communicated to buyer before final confirmation. Promotion codes only if genuine owner-approved rules exist; otherwise omit.

---

# PART IV — MERCHANT-READY NO-CODE ADMIN PLATFORM

## 13. Complete secure operations dashboard (`/admin`)

Deliver a real, protected and attractive back office. After initial deployment, the merchant must be able to operate daily business without touching Git, Supabase SQL, code, SSH or Vercel. Supabase is the database and auth system; the merchant primarily uses the custom admin UI.

**Admin modules required:**
- **Overview:** COD orders today, orders by status, gross placed value vs collected cash vs outstanding, actual confirmed revenue separately, product counts, recent inquiries, cancellations/returns, actionable alerts. Do not confuse placed COD amount with collected revenue.
- **Orders:** paginated/searchable/filterable orders, date/status/phone/order ID, detail drawer/page, item/variant snapshots, address, notes, audit history, allowed status transitions, confirm/cancel/reject, print packing slip/invoice/dispatch note, shipping/courier details, mark COD collected with date/amount/reference, configurable export with PII safeguards, return/failed delivery management.
- **Catalog:** create/edit/clone/archive products, variants, images, reorder galleries, prices, compare-at, brand/category, verified specs, tags, draft/published states, media rights/approval flags, 6 draft review queue and 2 flagged public records, CSV bulk import/export with dry run and error list, promote featured products. Don't permit public zero-price product accidentally.
- **Categories/Collections:** create/update hierarchy, assigned products, rule-based collections, ordering, featured navigation, verified count. Keep same V5 discoverability and all 226 public products at initial migration.
- **Inventory/Availability (private only):** merchant switch tracked vs untracked per variant; optional quantities/reservation; business-approved purchase eligibility and per-order quantity limits; no public quantities. Never turn on tracking for existing items silently.
- **Customers:** guest order directory, optional account profiles, contact info privacy, order history, notes (staff-only), ability to correct typos with audit trails. No unsolicited marketing consent.
- **Contact & inquiries:** genuine stored inquiries, staff assignment, status, replies via verified email provider if configured, privacy/compliance. A valid form submits to database and appears in dashboard; no localStorage-only inquiries.
- **Content/CMS:** homepage hero promos, section titles/links, navigation and footer, FAQ, buying guides/blog posts, contact info, about, policy pages, banner images, announcement bar. Owner can edit publish/draft/schedule if implemented safely, no fake marketing copy.
- **Store settings:** brand basics, logo, contact channels, owner-approved shipping zones/fees, COD enablement (COD only), minimum/maximum order rules, invoice text, business hours, SEO, social links, legal pages, product photo approval, store-wide maintenance/pause ordering. Prices/fees changes logged.
- **Fulfillment/Courier:** shipping labels/packing slips, carrier, tracking ID, dispatch date, delivery/failure, COD collected/reconciled.
- **Reports:** order counts, COD collected/outstanding, cancellations/returns, product sales, order exports and period/date filters; understand paid vs placed distinction.
- **Staff & security:** admin and manager/editor/fulfillment roles as truly needed; protect every operation. No public ability to self-register as admin. Bootstrap first owner through secure allowlist/manual admin action, never via open `/admin/setup?secret=...` endpoint. Audit logs for sensitive changes. Owner can invite/revoke staff if implemented securely.
- **Health/operations:** imports, failed notifications, missing assets, delivery failures, inventory concerns, data approval issues; show clear actionable errors.

Every admin mutation must enforce authentication AND authorization on server, validate inputs, and record who changed what/when. A hidden UI button is NOT security. Add confirmation for destructive actions. Protect admin from indexing. Admin supports keyboard and responsive layouts, can export data and manage content without source edits.

## 14. Customer accounts (optional but sensible)

Prefer guest checkout as primary. Provide optional Supabase Auth-based customer sign-in and order history if implementation/test budget permits; never block COD checkout. Guest order lookup requires phone verification or secure expiring token. No PII in public product endpoints. Account page must not show another customer's order based on user-supplied ID; RLS + server policy required. Support consent handling and account deletion/export process once approved.

---

# PART V — DATABASE, MIGRATIONS, AUTH AND SECURITY

## 15. Database schema — normalized, operational and auditable

Use SQL migrations under `supabase/migrations/`, generated types, sensible indexes, FK constraints and `CHECK` constraints. Final names can differ, but cover at least:

**Catalog and content:**
- `products` (UUID PK, unique handle, title, safe description, merchant vendor, normalized manufacturer, product type, category, publication and media-approval status, SEO fields, timestamps)
- `product_variants` (UUID PK, product FK, SKU if present, options JSON/normalized model, price minor units or exact numeric, compare-at, purchasable state, tracked/untracked availability, per-order limit, timestamps)
- `product_media` (FK, URL/storage key, alt, position, approval status, resolution/source)
- `categories`, `collections`, `collection_product_memberships` or rules schema, `product_specs` typed columns/metafields or JSON with validated schema, `product_tags`
- `content_pages`, `faq_entries`, `articles/guides`, `banners/promotions`, `navigation_menus`, `store_settings` and `shipping_zones/rates`

**Commerce:**
- `carts/cart_items` if persistent server cart chosen (or encrypted session tokens), `orders`, `order_items` (immutable snapshot), `order_addresses` (access-restricted PII), `order_events`, `order_adjustments`, `fulfillments/shipments`, `cod_collections`, `inventory_reservations` if tracking enabled, `idempotency_keys`, `notification_outbox`, `notification_delivery_attempts`
- `customers/customer_profiles` and/or guest contact indexes, `contact_inquiries`, `audit_logs`, `import_jobs/import_errors`
- `admin_memberships`, role grants, and status tables/enums where helpful

**Invariants:** Every order total matches sum of price snapshots + shipping + configured fees/tax − discounts. Currency PKR. Immutable order item unit price after placement. Foreign keys and indexes on handles, SKUs, order number, created_at, phone hash/normalized phone with appropriate privacy, statuses, and customer ID. Audit events append-only to normal app roles. No hard deletes of completed financial records; use retention policies and controlled redaction/archive operations.

Design for small-business simplicity and serverless reliability. Do not overbuild accounting modules or multiwarehouse forecasting absent user need. Implement all state transitions with business validations.

## 16. RLS, secrets and secure server execution

**Never expose a Supabase secret/service-role key in the browser or in a `NEXT_PUBLIC_*` variable.** Keep elevated credentials only in Vercel server environment and local ignored `.env.local`. Supabase publishable key may be exposed only with deliberately configured RLS and grants. Prefer server-only checkout RPC with restricted EXECUTE grants and security-definer audit, or a trusted server-only DB transaction path. Never allow anonymous `INSERT` into protected orders/admin tables through generic Supabase Data API.

**Policy model:**
- Public/anon: SELECT only explicitly published/safe product projections, approved content, publicly visible media, publicly visible non-sensitive category data. No secrets/internal review flags/private cost or order data.
- Authenticated customers: own profile and own authorized order views; no ability to arbitrarily update order totals, statuses or delivery payment states.
- Admin: server-verified membership/role grants; use server endpoints or carefully written policies, not client-supplied `is_admin`.
- Secret/service role: server-only minimum set of trusted jobs. Don't trust `getSession()` user data without server verification for privileged actions; use appropriate validated Supabase Auth JWT/user checks.
- Private storage for sensitive uploads/exports; public storage only for approved commercial assets.
- Add explicit RLS tests (including negative tests: anonymous buyer cannot read orders, change prices, make self admin, see other customers, see internal cost/CRM fields or enumerate customers).

**Threat model:** SQL injection, XSS from rich text (sanitize editor HTML), CSRF and untrusted server actions, SSRF via media URLs, insecure redirects, public API abuse, auth bypass/IDOR, order manipulation, replay, rate-limit bypass, leaked secrets, arbitrary uploads, malicious file types, stale-cache pricing, coupon abuse, double fulfillment, duplicate cash recording, mass assignment and privilege escalation. Protect forms/admin with server validation, origin validation, strict content security policy where feasible, safe file upload validation, secure cookies, dependency scanning, rate limits, audit trails and least privilege. Hide no secrets in client bundles, generated reports or logs.

**Data privacy:** Store only what shipping/support requires; real customer names/phones/addresses are sensitive. Configure retention policies, PII access logs, database backups, staff least privilege and privacy/legal content for approval. No real customer data in test fixtures/screenshots/repo. Use masking in admin lists where appropriate. Never dump production DB into GitHub.

## 17. Supabase migrations and backups

- Link to supplied project ID after verifying account; inspect existing schema first. Don't DROP, TRUNCATE or overwrite tables without impact assessment.
- Develop migrations locally in order, test on local/staging database before remote application; provide rollback/recovery plan for nonreversible migrations. Where a separate staging Supabase project is possible, prefer it over experimenting on production.
- Migration scripts must be idempotent as appropriate (seeds/import by handle) and safe to rerun; structural migrations are versioned.
- Review and validate migrations before remote `supabase db push`. Do not casually execute remote changes because CLI is authenticated.
- Backup and restore procedure documented and **tested**; note plan-specific automated backup limitations, consider a scheduled offsite encrypted export with restore exercise if appropriate. Plan for uptime/auto-pausing and monitor database exhaustion.
- Use server-side migrations and type generation in CI; never push database service keys into repo or GitHub Actions logs.

---

# PART VI — IMPLEMENTATION STRUCTURE AND DEPLOYMENT

## 18. Recommended Next.js folder architecture

```text
laptops-hub/
├── src/
│   ├── app/
│   │   ├── (store)/
│   │   │   ├── page.tsx
│   │   │   ├── shop/page.tsx
│   │   │   ├── collections/[slug]/page.tsx
│   │   │   ├── products/[handle]/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── order/success/[token]/page.tsx
│   │   │   ├── track-order/page.tsx
│   │   │   ├── pages/[slug]/page.tsx
│   │   │   ├── guides/page.tsx
│   │   │   └── guides/[slug]/page.tsx
│   │   ├── admin/(protected)/[...routes]/
│   │   ├── api/checkout/cod/route.ts
│   │   ├── api/cart/[...routes]/
│   │   ├── api/search/route.ts
│   │   ├── api/orders/[...routes]/
│   │   ├── api/contact/route.ts
│   │   ├── api/admin/[...routes]/
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── storefront/{header,mega-menu,footer,hero,story,...}/
│   │   ├── commerce/{product-card,gallery,cart,compare,checkout,...}/
│   │   ├── admin/{tables,forms,charts,status,...}/
│   │   └── ui/
│   ├── lib/{supabase,auth,permissions,catalog,commerce,cod,shipping,validation,security,media,seo}/
│   ├── styles/{tokens,global,components}.css
│   └── types/
├── public/approved-assets/
├── supabase/{migrations,seed,tests}/
├── scripts/{import-catalog,reconcile,check-secrets,generate-types}/
├── tests/{unit,integration,e2e,visual,security}/
├── docs/{architecture,operations,testing,release,owner-guide}/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── ...
```

This is a suggested clean organization, not a demand for empty folders. Use domain modules and real implementation, remove redundant layers. Never make a 200 KB JSX page by machine-translating the prototype template one-to-one.

## 19. Public storefront SSR, SEO and performance

- Use Next.js SSR/server rendering for public products/collections with appropriate caching and explicit revalidation after merchant updates. Initial SEO HTML should contain real visible product title, safe description, price and accessible images. No hash-only SPA URLs.
- Unique metadata/title/description/structured data where applicable, canonical URLs, dynamic sitemap of published products and public content, robots excluding admin, customer order screens and search clutter as appropriate. Draft/hidden/blocked content non-indexable. Correct `Product`/`Offer` schema only for verified information; do not claim in-stock or paid status by guessing.
- Accessibility: real labels, live regions, focus traps, reduced motion, keyboard and touch support, meaningful alt text, skip links, WCAG 2.2 AA-oriented tests (avoid claims of automatic certification).
- Images: Next.js `Image`/appropriate optimization for verified CDN hosts and responsive source sizes, prevent layout shifts, prioritize hero image, lazy-load offscreen; handle 404 images with graceful fallback; original V5 cutouts were only ~600–870px, so avoid extreme enlargement without owner-supplied higher resolution. Image rights are a launch gate.
- Motion: requestAnimationFrame/IntersectionObserver/scroll timeline or optimized motion library only when needed; avoid loading animation code on collection/PDP routes unnecessarily. Maintain pinned chapters, reduced-motion static complete content, chapter navigation, mobile alternative and smooth teardown. Fix short viewport clipping.
- Verify measurable performance with Lighthouse, Web Vitals and slow/mobile emulation. Set targets (aspirational): LCP <= 2.5s, CLS <= 0.1, INP <= 200ms at field p75 where realistically measurable; don't claim field metrics from local lab alone. Optimize without erasing cinematic design.
- International-ready phone/address/currency formatting; timezone Pakistan for business dashboards, UTC DB timestamps.

## 20. Authentication and role-based admin

- Supabase Auth for staff; protect all `/admin/*` pages and APIs server-side.
- First admin bootstrapped with a secure explicit owner-controlled process (invite or manual SQL using verified UID, audited), no default password in git or self-elevating user flow.
- Staff role grants enforced on server and database. Audit every order status, COD collection amount, product price, media approval and policy edit.
- Session renewal and logout done securely; MFA for admin where available and feasible. Use secure cookie sessions, protect against unauthorized server actions.
- Optional buyer accounts do not block guest COD checkout; no direct clients exposing private customer orders.

## 21. Messaging, notifications and operational reliability

- Choose an actual transactional email provider based on owner's approved account if messages are required. Supabase Auth emails are not a general-purpose bulk order notification delivery system by themselves. Configure verified sending domain and secrets, delivery records, retries, dead-letter handling, spam protection and sender reputation.
- Customer order success **UI always**; email or SMS confirmations only once provider is configured and send verified. Admin new-order notifications via configured channels. Courier/WhatsApp/SMS integration optional depending on credentials and merchant choice; do not misrepresent automatic WhatsApp messaging.
- Transactional `notification_outbox` populated with the order in the same DB transaction. Background worker/cron drains safely with locks, idempotent sends and attempts log. Use Vercel Cron or supported job runner based on verified account plan limits; no endless background process in request handlers.
- Structured server logging with request IDs, redaction, Sentry/approved telemetry optional. Alert on checkout errors, failed notifications, order anomalies, DB auth errors and downtime. Document incident recovery and rollback.
- Secure backup/restore of data and assets, dependency updates, Vercel deployment rollback. Vercel serverless functions must not depend on in-memory process persistence or writable local filesystem.

## 22. GitHub + Vercel integration contract

- Verify repo `mudasarimamofficial/laptops-hub`, its public/private status and remote. Create appropriate `.gitignore`, secret scanning and CI. GitHub repo was initially empty; respect any newer commits.
- Prefer protected development branch + PR review, then merge to `main` only after quality gates. Avoid force pushes or leaking unredacted catalog exports. Configure GitHub Actions for typecheck, lint, unit/integration tests, Playwright smoke, dependency/secret scanning and build where secrets not needed.
- Verify existing Vercel project ID `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`; link this directory to that project, not a newly created project. Ensure framework Next.js, root directory and Git repo integration are correct.
- Environment separation: Local / Preview / Production. Set public `NEXT_PUBLIC_SUPABASE_URL=https://xvmmjkrkgznnakcobmww.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (must fetch from authorized project), `SUPABASE_SECRET_KEY` (server only, if justified), `SITE_URL`, notification credentials, security/rate limit keys etc. Keep them in Vercel env settings and ignored local env, never in commit. For older key environments, use actual supported variables; don't invent values. Verify Supabase allowed redirect/site URLs for Auth.
- Prefer isolated staging data so Preview deployment cannot silently create real customer COD orders in production DB. If shared Supabase project is unavoidable, use environment-isolation safeguards and synthetic/order test flags that cannot be mistaken for live transactions. No real customer PII in preview/test data.
- Deploy a working Preview URL early for owner acceptance. Test end-to-end through the deployed URL with server actions and DB; preview working is NOT automatically proof of production-ready.
- Before Production: owner-approved policies/content, image rights, COD shipping settings, notifications, auth/RLS, complete order tests, backup/restore, domain/DNS, device/browser checks, accessibility, performance, tax/legal approvals. Then deploy to the existing Vercel production project after explicit go-live approval, with rollback plan and a monitored genuine end-to-end test (avoid generating an unapproved real COD shipment).
- Confirm no real card gateways are configured. Set COD-only branding and shipping/availability transparency.

---

# PART VII — QA, SECURITY ASSURANCE AND TESTING BIBLE

## 23. Mandatory automated tests

**Unit:** Money math (PKR parsing, rounding), shipping eligibility and fees, phone normalization, cart merge/max limits, product classification (Chromebook vs charger), collection rules, search tokenization, role checks, state transitions, order total invariants, idempotency state.

**Database/integration:** Migration success, grants/RLS positive/negative, all products imported exactly once, draft visibility, same-titled products distinct, image positions preserved, owner-only endpoints, COD transaction atomicity, concurrent limited stock, failed transaction rollback, order events, notifications outbox, administrative COD collection reconciliation, secure order lookup, customer PII isolation.

**Storefront E2E:** 226 PDPs have matching handle/title/price/images; published product counts correct; six drafts not accessible; 964 references all associated; no public stock counts; all collections/brands; filters AND/OR, sorting, search, compare 4; cart add/update/remove/persistence, available/unavailable items; true COD checkout from cart to real DB order; no duplicate from double click/refresh; order confirmation details, secure tracking; actual admin order visibility and fulfillment; real contact form stored/visible; content routes, navigation, 404.

**Admin E2E:** sign in, anonymous refusal, staff permission checks, product create/edit/hide, approval and media flow, collection edit, settings changes, shipping zone change, real order receive/confirm/ship/collect/cancel, form inbox; audit logs and exports. Verify merchant actions don't require code edits.

**Negative/adversarial:** falsified price, crafted shipping fee, order quantity tampering, inactive product, draft product, unauthorized status mutation, order enumeration, 5–20 repeated concurrent submit requests, cross-customer access, admin role forging, CSRF, malicious HTML in content, oversized uploads, SQL injection attempts, request rate limits and abuse handling.

**Visual:** screenshots at 1920/1897×860, 1440, 1366×680, 1280, 1024, 905, 768, 430, 390, 360. Test pinned scroll at 0/25/50/75/100, hero intro, reduced motion, mega-menu, collection, 3 varied product cards, PDP gallery, compare, cart drawer, checkout and admin. Compare with reference and log deviations. No hidden clipped price/CTA on short displays.

**Reliability:** deploy without runtime errors, DNS/HTTPS, correct next/image domains, broken links, not-found handling, serverless cold starts, database availability, data migrations, rate limit availability, recovery if email provider fails (order still commits), uptime monitor, backup restore verification.

**Manual owner checklist:** brand appearance approved, catalog prices/products approved, six drafts reviewed, image rights confirmed, actual business shipping/returns/warranty/COD terms approved, mail/SMS provider configured, admin access works, actual COD order test accepted, customer contacts correct, shipping fee/serviceability configured, domain approved.

## 24. Concrete acceptance matrix

Only report **COMPLETE** on a row when supported by evidence:

| Gate | Must actually pass |
|---|---|
| Source | original V5 design audit, no runtime copy shortcut |
| Repo | correct GitHub target, no committed secrets/CRM/cost data |
| Environment | correct existing Supabase and Vercel IDs verified |
| Catalog | 232 total, 226 public, 6 drafts; 964 ordered media; no duplication |
| Website | every public page and 226 PDPs routable as real URLs |
| Visual | screenshot parity on major views, cinematic interactions preserved |
| COD | buyer can truly place ONE durable unpaid COD order with correct server totals |
| Admin | merchant can manage orders, catalog, content, COD collection and shipping in UI |
| Security | tested RLS/grants, admin RBAC, untrusted data tampering fails |
| Privacy | contact/order PII protected, never in public/static data |
| Notifications | actual delivery verified if promised; failure never loses order |
| Operations | backup/restore, logging, rate limits, live monitoring and rollback |
| QA | unit, integration, E2E, visual, accessibility, performance and security tests |
| Content | owner-approved shipping/returns/warranty/privacy/contact/COD policies |
| Media | verified rights/authorization and clear launch-safe CDN strategy |
| Deploy | preview working; production deployed only after launch gates and approval |

**Hard blockers:** No checkout success before DB commit; no leaking Supabase secret; no public customer info; no fake COD paid state; no invented shipping fees or policies; no unapproved public product media; no bypass of admin auth; no source-code-only shopping forms; no application relying permanently on prototype local storage; no claims of 'production ready' without live E2E tests and owner approval.

## 25. Defect triage and zero-regression working style

Prioritize P0 security/financial errors, P1 broken COD/order/data/accessibility, P2 visual/responsive, P3 enhancements. After each major phase, run relevant tests and capture before/after evidence. Use explicit feature flags for incomplete components; never present a nonfunctional 'Place order' button on public production. Keep exact original design tokens in a single module. If the original V5 visual implementation has code duplication or insecure hacks, rebuild behavior cleanly but visually reproduce it. No silent omissions; report blockers and realistic status.

---

# PART VIII — EXECUTION PLAYBOOK, PHASES AND NONSTOP RESUMABILITY

## 26. Execute in this exact order

**Phase 0 — Forensic recovery:** Inspect ZIP, code, docs, CSV, current local workspace and repository; confirm correct connected GitHub, Supabase and Vercel projects. Produce inventory and risks, protect sensitive files; secure branch and baseline. No deployment or DB mutation until project identity verified.

**Phase 1 — Architecture + DB design:** Establish ADRs, schema, RLS/grants, checkout state machine, COD order transaction, migrations, seed/import pipeline, typed DB API, env template, backup/rollback plan. Verify local/staging migration and security first.

**Phase 2 — Catalog ingestion:** Import and reconcile all 232 by handle; 226 public, six drafts, media association/order; normalize brands/categories and safe descriptions; no stock-count public exposure. Build admin editing and media approval.

**Phase 3 — Exact storefront reconstruction:** Port global layout, header/mega/mobile, hero/story, sections, product cards, galleries, collections, search, compare, cart, informational routes. Perform responsive screenshot diffs before continuing. Do not use placeholder product photos when approved actual assets available.

**Phase 4 — Real COD checkout and order lifecycle:** Implement secure validated guest checkout, shipping configuration, atomic idempotent transactions, order confirmation/tracking, admin order details/fulfillment/COD reconciliation, abuse controls and private PII. E2E proven against DB.

**Phase 5 — Full merchant CMS and operations:** Admin products/categories/media, content pages/policies, messages/inquiries, shipping settings, customer support, basic accurate analytics/reporting, staff roles, exports and print documents. Do not require developer for routine updates.

**Phase 6 — Cloud wiring:** Use authenticated CLI in owner's local shell to configure existing projects, connect repo, preview deploy, configure env, migrate carefully. Verify deployed UI/API/DB/auth and order workflow. Ensure no orphan duplicate projects.

**Phase 7 — Testing and hardening:** Complete unit/integration/e2e, concurrency/security, all routes, visual match, real mobile, WCAG-oriented checks, accessibility, performance, data backups, monitoring, no broken links/images, no console errors.

**Phase 8 — Owner approvals and final live launch:** Obtain actual business/contact/shipping/COD/return/warranty/privacy information; resolve media rights and product flags; confirm domain; run owner acceptance; deploy production to linked Vercel project after all gates. Verify purchase with controlled COD test and prevent real accidental dispatch; monitor post-launch and document rollback.

At EACH phase completion, commit tested code, record status and next steps in `docs/PROGRESS.md`, `docs/RESUME.md`, and `docs/DECISIONS.md`. Resume without rereading the entire chat if interrupted. Do not repeatedly ask to continue routine authorized work. When missing critical facts, implement admin configuration and a safely BLOCKED state, clearly request owner decision, then continue other feasible tasks. **You cannot override model/tool/session limits**; write truthful checkpoints and never claim work continues after session stops. Never skip tests to create the appearance of speed.

## 27. Required documented owner inputs and freeze rules

Ask for owner decisions only when needed and preferably consolidate into ONE short approval checklist:
- Official public domain, store contact email/WhatsApp/phone/address/business identity.
- Cities/provinces served; shipping rate model, COD fee (if any), courier(s), dispatch timeline, delivery policy; tax calculation rule approved by accountant/legal advisor.
- COD verification approach: guest confirmation only vs SMS OTP; approved email/SMS provider credentials and sender.
- Cancellation, refund/return/exchange/warranty policy; condition grading and fulfillment process.
- Admin owner identity for secure staff invitation; actual support recipients.
- Media rights/licensing for the 964 images and hero/story derivatives; owner-approved replacement of unclear assets.
- Review of 6 draft records, 2 identity/config flags, duplicate-title devices, 182 description/technical-detail gaps, real Chromebook specs.
- Data retention/privacy and transactional messaging/marketing opt-in.

The site may run safely in PREVIEW with approved demo/sandbox mode and without fake business information. Do not make the store publicly accept orders until shipping/taxes/COD fees/business policies and operational notifications are determined and tested.

## 28. Deliverables before you say this work is finished

1. Fully working Next.js TypeScript source repository, pushed to the verified existing GitHub repo with clean history and no secrets/private CSV.
2. Supabase schema migrations, secure RLS/grants, type generation, import/seeding/reconciliation scripts, backup instructions.
3. All public storefront routes and approved V5 responsive/cinematic design, backed by Supabase products/prices/media.
4. Real, persisted, tamper-resistant COD checkout/orders/guest tracking with admin COD collection reconciliation.
5. Secure merchant dashboard for products, categories, orders, customers, media, content, policies, shipping settings, inquiries and reporting.
6. Local development setup, `.env.example` (names only), secure roles/bootstrap, README and operator manual illustrated with real screens.
7. Unit, integration, security, E2E and visual regression tests with results/screenshots and documented limitations.
8. Existing Vercel project linked correctly and a verified deployable preview; working server/API/DB/auth flows with no false success.
9. Production readiness report with owners' unresolved approvals and true completion state. Production URL and actual deployed commit only if successfully deployed and verified.
10. One complete `PROJECT_BIBLE.md`/docs set: architecture, business rules, data model, all routes, APIs, COD state machines, admin workflow, security, shipping, environment configuration, maintenance, backup, recovery, QA matrix, and merchant guide.

**Final report format:** Clearly state exact Git commit, Vercel project ID and preview URL verified, Supabase project ID, migrations applied/remaining, imported/public/draft product counts, critical flow E2E results, role/RLS tests, checkout transaction results, screenshot fidelity summary, actual outstanding owner inputs, and one next action if truly blocked. Do not invent URLs or verification outcomes.

---

# FINAL COMMAND — START REAL IMPLEMENTATION

You are not being asked to brainstorm a possible site. You are being tasked to **ENGINEER, TEST, CONNECT, AND DELIVER AN INDEPENDENT FULL-STACK COD-ONLY E-COMMERCE BUSINESS** based on this exact reference and these existing cloud projects. Keep the customer-facing V5 design near pixel-perfect; convert simulated UI into real workflows; preserve all approved products and media relationships; give the merchant an easy no-code operations dashboard; secure every order and admin operation; deploy through GitHub to the existing Vercel project with the existing Supabase project; complete all testable engineering work before declaring completion. Do not cut scope down to an elegant homepage and a cart mockup.

**FIRST ACTIONS TO PERFORM IMMEDIATELY:** Inspect project files and current Git repository. Verify the correct linked GitHub/Supabase/Vercel contexts. Produce `docs/00_FORENSIC_AUDIT.md` and initial `docs/PROGRESS.md`; identify credentials/business-owner blockers without exposing secrets. Then implement the real platform in the phased order above. You have permission for routine reversible development work; seek approval before data-destructive actions or enabling public acceptance of real COD orders.

**Launch acceptance definition:** The buyer can complete a genuine COD order that is stored once, calculated correctly, visible/manageable by the merchant, auditable to courier collection, while the storefront visibly matches the approved V5 reference. Everything else is scaffolding until this is true.
