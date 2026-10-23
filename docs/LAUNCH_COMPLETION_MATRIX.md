# Launch completion matrix

Updated 2026-10-23. Three separate states — never reported as one another:

- **Engineering ready** — built and verified (local isolated stack and/or protected Preview).
- **Business ready** — owner facts, approvals and configuration in place (`docs/FINAL_LAUNCH_OWNER_INPUTS.md`).
- **Launched** — running on `laptops-hub.vercel.app` with COD enabled. **Not launched.**

Priority: **P0** needed to accept real orders safely · **P1** essential operations, can run alongside · **P2** after launch.

## Customer journey

| # | Capability | P | Engineering | Business | Evidence |
|---|---|---|---|---|---|
| 1 | Browse catalog (226 public products), collections, filters, sort, pagination | P0 | ✅ | — | routes 226/226 · 39/39; pagination 5/5; data parity 0 mismatches; e2e |
| 2 | Product pages: specs, price, gallery, limits, related | P0 | ✅ | prices confirmed by owner ❌ | e2e; data parity |
| 3 | Search, compare (max 4), cart (limits, persistence) | P0 | ✅ | — | e2e 39/1 skipped |
| 4 | COD checkout: Pakistani phone, address, province list, zone quote, server totals, consent | P0 | ✅ | zones + fees ❌ · policies ❌ | isolated journey "customer" + checkout 31/31 |
| 5 | Duplicate submit / concurrency / no overselling of tracked stock | P0 | ✅ | — | checkout 31/31, journey "duplicate submit" |
| 6 | Availability-confirmation workflow (untracked stock: order *placed* → staff confirm) | P0 | ✅ copy + statuses | approval of workflow ❌ (owner input 4.1) | confirmation copy; admin transitions |
| 7 | Order confirmation page (items, charges, status, tracking) | P0 | ✅ | — | isolated journey |
| 8 | Track order (order number + phone, rate-limited) | P0 | ✅ | — | isolated journey; 403 cross-site; 429 after 10 guesses |
| 9 | Business pages (contact, shipping, returns, warranty, privacy, terms…) | P0 | ✅ templates + gates | facts + legal approval ❌ | CMS gates, role HTTP 113/113 |
| 10 | Pre-launch protection until launch | P0 | ✅ modes A/B | activation approval ❌ | `docs/PUBLIC_SITE_PLAN.md` |

## Operations (admin)

| # | Capability | P | Engineering | Business | Evidence |
|---|---|---|---|---|---|
| 11 | Staff sign-in, role enforcement on every page/API | P0 | ✅ | owner account ❌ · staff list ❌ | role HTTP 113/113; auth matrix 24/24 |
| 12 | Order list/detail, confirm → pack → dispatch (tracking) → deliver; cancel; failed delivery; return | P0 | ✅ | staff trained ❌ | isolated journeys "admin" + "cancellation" |
| 13 | COD cash collection (exactly-once, conflicts, history) | P0 | ✅ | — | collection matrix 16/16; journey |
| 14 | Shipping zones: create, **edit, (de)activate** | P0 | ✅ (new) | real zones ❌ | role HTTP (PATCH) |
| 15 | New-order alert to the store + optional customer email; lease-based claims, per-recipient state, bounded retries, no duplicates | P0 | ✅ code · ✅ DB migration `20261024100000` applied (2026-10-23) | email provider + inbox ❌ (owner 5.1–5.2) | outbox reliability 11/11; journeys "notifications" ×3 (stand-in provider); `docs/NOTIFICATIONS.md` |
| 16 | Dashboard: orders to confirm, unsent notifications | P1 | ✅ (new) | — | admin overview |
| 17 | Product edit (price, status, purchasable) | P1 | ✅ | — | role HTTP |
| 18 | CMS edit / publish / withdraw, separate legal approval | P1 | ✅ | content ❌ | role HTTP |
| 19 | Inquiries inbox | P1 | ✅ (view) | inbox owner ❌ | — |
| 20 | Staff invite UI | P2 | ❌ (manual bootstrap documented) | — | `docs/STAFF_HANDBOOK.md` |
| 21 | SMS / WhatsApp notifications | P2 | ❌ | provider ❌ | — |
| 22 | Free-delivery threshold rule | P2 | ❌ | decision ❌ | — |

## Platform

| # | Capability | P | Engineering | Business | Evidence |
|---|---|---|---|---|---|
| 23 | Database security (RLS, server-only RPCs, least privilege) | P0 | ✅ applied on production | — | `docs/MIGRATION_PRODUCTION_APPROVAL.md` |
| 24 | Kill switches: COD (env + DB setting), pre-launch mode, Instant Rollback | P0 | ✅ | — | `docs/RELEASE_PLAN.md` |
| 25 | Backups / recovery | P0 | ✅ schema backup procedure; data backups = Supabase plan | confirm plan's backup retention ❌ | `docs/RELEASE_PLAN.md` |
| 26 | Monitoring | P1 | ✅ Vercel runtime logs; dashboard counters | who watches ❌ | — |
| 27 | Accessibility / console / overflow | P1 | ✅ axe 0 (10 routes), console clean | — | sweeps |
| 28 | Media rights (964 photos on Shopify CDN, all pending) | P0 | ✅ inventory + gates | rights ❌ | `docs/MEDIA_INVENTORY.md` |
| 29 | Real-device testing (iOS Safari, Android Chrome) | P1 | ❌ not available here | owner/manual | — |

## Verdict

- **Engineering ready (release candidate):** yes for every P0 above, with evidence (local isolated stack; protected
  Preview), migration `20261024100000` applied on production 2026-10-23. Preview of `140bc31`
  (`dpl_3YJhthM3LkiAE1rbSQn3oom7b2NX`): e2e 39 passed / 1 skipped, `/` 200, `/admin` 307, COD POST 403, cron 503
  (no secret set), staff retry 401 without session, no runtime errors. The lease path itself is verified locally
  (it needs the migration and email configuration, neither present on the shared database).
- **Business ready:** **no** — open: owner account, zones/fees, policies + legal approval, contact facts, email
  provider, media rights, workflow approval (4.1), staff list.
- **Launched:** **no** — production runs the release candidate (`5139ff0`, 2026-10-23) with COD off and email not configured.
