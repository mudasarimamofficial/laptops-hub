# Architecture decisions

## 2026-10-21

1. **Independent platform, not Shopify** — Owner-mandated Next.js + Supabase + Vercel COD store. Shopify CSV is import-only.
2. **Checkout gated OFF** — `COD_CHECKOUT_ENABLED=false` until shipping zones + owner policies exist. No fake successful orders.
3. **Integer paisa** — All money stored as `bigint` paisa; CSV major PKR × 100.
4. **Public git hygiene** — CSV, `lh-catalog.js`, secrets, prototype ZIP/HTML stay local/gitignored.
5. **Service-role COD RPC** — `create_cod_order` is SECURITY DEFINER; anon cannot INSERT orders via Data API.
6. **No production promote** — Preview only until release gates + explicit go-live.

## 2026-10-22 — V5 reconstruction

7. **Port, don't reinterpret** — Storefront templates are near-verbatim React ports of `Laptops Hub Storefront v5.dc.html` / `ProductCard v5.dc.html` (inline styles copied from the source). V5's JS breakpoints (`w < 760` mobile, `< 1000` tablet, `≥ 1180` wide nav, `< 900` PDP/cart single column) are expressed as media queries in `src/styles/v5.css` so server HTML matches without a hydration jump.
8. **V5 data adapter** — `src/lib/catalog/v5-model.ts` maps live Supabase rows to the V5 product shape (chips, badge, model/config, catalog order = `products.created_at`). V5's sub-type taxonomy (Charger / Workstation / 2-in-1 …) is not in the DB yet; it ships as a generated handle map (`v5-taxonomy.ts`, `scripts/gen-v5-taxonomy.mjs`). Parity verified by `scripts/visual/verify-v5-data.mts` (226/226, 0 mismatches). Follow-up: move `sub` into `products.specs` with a reviewed migration.
9. **Server-side collections** — Filters/sort/paging are URL parameters evaluated on the server (V5 `match`/`sorted`), not a client-side catalog. Filtered URLs are `noindex, follow`.
10. **Fonts self-hosted, literal family names** — `next/font` loads V5's exact weights; tokens name the real families because the generated variable appends a metric-adjusted Arial that would render glyphs missing from the fonts (e.g. "→") differently from V5's `system-ui` fallback.
11. **Cutout media gate** — V5 hero/story cutouts load only from `V5_CUTOUT_BASE` (unset in Preview/Production until media rights are approved); otherwise catalog photos are shown. `stage.png` ("generated in project") is published as `public/v5/stage.webp`.
12. **Truthful copy over prototype copy** — Where V5 text describes the prototype ("Catalog snapshot from Shopify export", "Prototype cart…", "removed from the export"), the live site states the real situation; each case is listed in `docs/V5_PIXEL_DIFF_REPORT.md`.

## 2026-10-23 — security & COD integrity

13. **Emergency fix separable from policy changes** — the anon-executable staff RPCs are closed by a self-contained migration (`20261023110000`) that sorts before the broader grants migration and can be applied alone; the full pending set is listed with blast radius in `docs/MIGRATION_PRODUCTION_APPROVAL.md`.
14. **Server-only RPCs check the caller, not only grants** — SECURITY DEFINER functions that accept an actor id refuse JWT roles other than `service_role` (`auth.role()` guard), so a future grant regression cannot reopen them.
15. **Least-privilege defaults** — objects created by future migrations are not exposed to anon/authenticated; each migration grants explicitly (`20261023140000`, global revoke of PUBLIC EXECUTE because per-schema defaults cannot remove it).
16. **Idempotency key = one operation** — collection: (order, amount); checkout: (lines, zone). A replay must match; anything else is `idempotency_conflict` with nothing written. Only the specific idempotency index counts as a key race.
17. **Template publication needs explicit approval** — an empty CMS body publishes the V5 template only when the template has no pending sections and the publish request carries `approveTemplate: true`; no schema change.
18. **Pre-launch mode instead of platform protection** — the project is on Vercel Hobby (no production password protection); `SITE_PRELAUNCH=1` keeps the site reachable but non-indexable (X-Robots-Tag, robots `Disallow: /`, empty sitemap). Default off.
19. **Canonical host on production** — `siteUrl()` prefers `SITE_URL`, then `VERCEL_PROJECT_PRODUCTION_URL` on production; the per-deployment `VERCEL_URL` is behind SSO and must not be advertised.
20. **Same-origin check uses the request Host** — the contact API accepts an Origin equal to the request's Host / X-Forwarded-Host or the host in `request.url`; anything else is rejected (403).
21. **Option B is applied as one push with a tested rollback** — per-file transactions, every intermediate state verified safe; rollback SQL is generated from the previous migrations (`scripts/release/gen-option-b-rollback.py`).
22. **Pre-launch modes, crawlable noindex** — `SITE_PRELAUNCH=1` (storefront + notice) or `restricted` (coming-soon page, catalog APIs 503, no remote image optimisation). Both: `X-Robots-Tag: noindex` + meta `noindex, follow`, crawlable robots.txt (private routes still disallowed), no canonical, empty sitemap. Never `Disallow: /` together with noindex (crawlers could not see the rule). Pages set robots via `robotsFor()` because an explicit `robots: undefined` drops the layout's noindex.
23. **Untracked stock → confirmation workflow** — orders arrive *placed*; staff confirm availability by phone before *confirmed*; customer pages say so. No stock is promised (owner approval pending: inputs 4.1).
24. **Notifications via outbox + provider idempotency** — delivery is attempted right after an order (`after()`), retried by staff or a daily cron; a row is `sent` only after the provider accepts every message; provider `Idempotency-Key` per row and recipient prevents duplicates. Resend adapter; provider account is the owner's.
26. **Outbox lease (supersedes the claim part of 24)** — `claim_notifications()` leases rows with a token; all worker writes are token-conditional; recovery by lease age; per-recipient status; `accepted` (provider) ≠ delivered; max 5 attempts with backoff, automatic retries stop at 23 h (inside Resend's 24 h key retention); staff retry is manual and never resends an accepted recipient. `docs/NOTIFICATIONS.md`.
25. **Customer order access** — secret confirmation link, or order number + checkout phone (rate-limited). No address or email is shown.
