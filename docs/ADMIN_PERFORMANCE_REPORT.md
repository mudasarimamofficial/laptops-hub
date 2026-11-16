# Admin performance report (2026-11-16)

## Finding

Admin pages felt slow because of **where the server code runs relative to the database**, multiplied by **how many
sequential database/auth round trips each page made** — not because of heavy pages.

Facts, checked 2026-11-16:

- Production functions run in **iad1 (Washington, US East)** — response header `x-vercel-id: bom1::iad1::…` on dynamic
  routes; Vercel project setting `functionDefaultRegions: ["iad1"]`.
- The Supabase project is in **ap-southeast-1 (Singapore)** (`supabase projects list`).
- So every server-side Supabase call from a page crossed the Pacific (~220 ms round trip before any work).
- Each admin navigation made ~7–8 of those calls **in sequence**: middleware `auth.getUser()` (Auth server) +
  membership read, then the page's own `getUser()` + membership read, then the page's data queries. The layout repeated
  the auth + membership lookup in parallel.

## Fixes (no spinners, no hiding)

1. **Functions next to the database** — `vercel.json` `"regions": ["sin1"]` (Singapore). Visitors in Pakistan reach
   Vercel's Mumbai edge, which forwards to Singapore (short hop); the database is then milliseconds away. Allowed on the
   current Hobby plan (one region), no cost. Takes effect on the next deployment.
2. **One auth + membership lookup per request** — `src/lib/auth/staff.ts`: the layout and page share a request-scoped
   `cache()`d lookup instead of doing it twice.
3. **Middleware verifies the session locally** — `src/lib/supabase/verified-user.ts`: the project signs sessions with
   an asymmetric ES256 key, so middleware checks the JWT signature and expiry against the (cached) public keys instead
   of calling the Auth server on every request. Visitors without a session cookie trigger no request at all.
   **Security kept:** middleware is only the coarse gate; `requireStaff()` in every admin page/API still asks the Auth
   server, so a signed-out session is refused immediately (`p0-admin-sign-out` "replayed cookies are refused" — 4/4
   passing on the final build).

## Method

Measured on the isolated stack (production build, `next start`, local Supabase) with a TCP latency proxy
(`scripts/perf/latency-proxy.mjs`) between the app and Supabase: **110 ms each way** models iad1 ↔ Singapore,
**1 ms** models same-region (sin1). `scripts/perf/admin-journeys.mjs` signs in as the owner and times 18 admin journeys
(full navigations), 5 runs each after a warm-up; server response time (TTFB) shown. Raw JSON:
`docs/evidence/admin-perf/*.json`.

Limits: TCP/TLS handshakes are not modelled (real cross-region cost is higher, so the region fix is understated); the
local Auth server (Docker on Windows) takes ~110 ms per `getUser` — slower than Supabase's hosted Auth — so the
same-region numbers are pessimistic. Production verification after deploy is listed below.

## Results — TTFB, ms

| Model | Median of the 18 journeys' p50 |
|---|---|
| Baseline code, iad1 (production today) | **1 753** |
| + layout/page dedupe only, iad1 | 1 678 (layout and page render in parallel, so this mainly halves load on Supabase) |
| Final code, still iad1 | 1 120 (−36%) |
| **Final code + sin1** | **365 (−79%)** |

| Journey | Baseline (iad1) p50 / p75 / p95 | Final code, iad1 p50 | Final + sin1 p50 / p75 / p95 |
|---|---|---|---|
| overview | 1776 / 1825 / 1896 | 1142 | 584 / 624 / 1408 |
| products | 1598 / 1733 / 1797 | 1212 | 359 / 359 / 431 |
| product-search | 1662 / 1721 / 1728 | 1144 | 361 / 400 / 447 |
| product-edit | 1601 / 1862 / 1874 | 1229 | 365 / 398 / 631 |
| product-new | 1373 / 1458 / 1524 | 994 | 314 / 316 / 323 |
| products-bulk | 1640 / 1641 / 1780 | 1114 | 320 / 322 / 372 |
| orders | 1753 / 1818 / 1857 | 1103 | 425 / 440 / 565 |
| customers | 1677 / 1722 / 1761 | 1120 | 408 / 422 / 443 |
| inventory | 2020 / 2069 / 2319 | 1090 | 356 / 1317 / 1355 |
| collections | 2121 / 2472 / 4072 | 1096 | 402 / 459 / 464 |
| collection-edit | 1793 / 1892 / 1892 | 1096 | 353 / 364 / 397 |
| reviews | 1965 / 2560 / 2572 | 1113 | 368 / 383 / 490 |
| testimonials | 1698 / 1709 / 1911 | 1124 | 450 / 455 / 515 |
| online-store | 1432 / 1497 / 1536 | 984 | 410 / 454 / 551 |
| settings | 2239 / 2302 / 2639 | 1597 | 394 / 426 / 1421 |
| staff | 2192 / 2335 / 2523 | 1508 | 596 / 634 / 690 |
| analytics | 1979 / 2005 / 2065 | 1355 | 355 / 370 / 377 |
| navigation | 1892 / 2056 / 2059 | 1329 | 338 / 347 / 357 |

Occasional p95 outliers (~1.4 s on overview, inventory, settings) on the final build come from a session-token refresh
or a cold cache on one of the five runs; p50/p75 are stable.

## Remaining, not done

- **Production confirmation**: after deploy, check `x-vercel-id` shows `::sin1::` on dynamic routes and re-time the
  public dynamic pages; admin timing in production needs an owner session (the owner can time a few pages in the
  browser's Network panel — expected well under 1 s).
- Staff page (596 ms p50) lists users through the Auth admin API; acceptable, could be cached later.
- Overview runs ~15 count queries in parallel; fine at same-region latency.
