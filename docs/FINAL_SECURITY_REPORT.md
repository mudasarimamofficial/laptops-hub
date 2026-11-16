# Final security report — release 2026-11-16

Scope: changes in this release plus the standing security suites (isolated stack only — no destructive probes were run
against production; production checks were read-only).

## Changes in this release

| Area | Control | Verified by |
|---|---|---|
| Store testimonials table | RLS: public may select only `status='published'`; **column grants** expose only public columns (no consent flags, notes, staff ids); `revoke all` from anon/authenticated, so no direct writes; staff write only through server routes after `requireStaff` (service role, same model as migration 28) | SQL matrix 19/19 |
| Testimonial content rules in the DB | publish requires consent; avatar requires permission; Google source requires a **host-anchored** Google Maps link; https-only URLs; length/rating checks | SQL matrix; unit tests |
| Look-alike hosts | `google.com.evil.example/maps` was accepted by the first regex — found by the new unit test and fixed in the DB check, zod schema and settings validator | unit + SQL tests |
| XSS | review text rendered as React text; E2E stores `<img src=x onerror=…>` and checks it is shown literally and never executes | E2E |
| Roles | editors: draft/submit only; publish/hide/delete = owner/admin/manager (UI + API 403 + `canTransition`) | E2E (API 403s), unit |
| CSRF | testimonial routes and the **bulk products API** (newly) refuse cross-site requests (`isCrossSite`) | E2E (403 with foreign Origin) |
| Map embed | only `https://www.google.com/maps/embed?pb=…` with a safe character set; other links fall back to defaults and the theme API refuses to save them | unit tests |
| Middleware session check | verifies the JWT signature + expiry locally (ES256 JWKS, cached) as a coarse gate. **Authorisation still uses the Auth server** in `requireStaff()` so signed-out sessions are refused immediately | `p0-admin-sign-out` 4/4 (replayed cookies refused) |
| Service-role key | not present in any client bundle (full-key scan of `.next/static`: 0 files) | scan, 2026-11-16 |
| Audit | testimonial create/edit (changed fields only; internal notes redacted)/status/delete; bulk product changes | E2E (history), code |

## Standing suites (final run)

See `docs/evidence/final-run/summary.json` for the exact run: static (lint, tsc, `npm audit --omit=dev`), unit, SQL
matrices (shipping/COD, merchandising, reels/reviews, testimonials), P0 probe, auth matrix, role matrix, role HTTP,
direct staff access, theme RLS, COD concurrency/checkout, inventory, and the isolated + cross-browser E2E suites.

## Production (read-only observations, 2026-11-16)

- Functions in iad1 today; release moves them to sin1 (same region as the DB). No security impact.
- `app.laptopshub.pk` (CRM) resolves to `45.130.228.253`, separate from Vercel — unchanged.
- **Email authentication records absent** (no MX, SPF, DMARC, DKIM). Until the owner sets up a provider and verified
  domain, store email can be spoofed more easily and transactional email is not configured. Owner action.
- Production env has no `CRON_SECRET`; the notifications cron endpoint refuses requests without it (fail-closed).

## Residual risks / accepted

- Middleware coarse gate accepts a signed-out token until it expires (≤ 1 h); every admin page and API re-checks with
  the Auth server, so no data or action is reachable with it.
- Testimonial avatars are third-party https images chosen by staff (rendered with `referrerPolicy=no-referrer`,
  `loading=lazy`); only staff can set them.
