# 12 — Security hardening report

**Date:** 2026-11-17  
**Scope:** Production `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` @ `585c8e9` + local codebase

## HTTP security headers

| Header | Status | Recommendation |
|---|---|---|
| `Strict-Transport-Security` | PASS (`max-age=63072000`) | Vercel default; keep |
| `X-Content-Type-Options` | MISSING | Add `nosniff` |
| `X-Frame-Options` | MISSING | Add `DENY` (no iframe embedding needed) |
| `Content-Security-Policy` | MISSING | P2 — **do not** ship a generic lock-down CSP without testing Maps embeds, Cloudinary/images, fonts, video, and admin. Prefer staged headers (`X-Content-Type-Options`, `Referrer-Policy`, `poweredByHeader: false`) first. |
| `Referrer-Policy` | MISSING | Add `strict-origin-when-cross-origin` |
| `Permissions-Policy` | MISSING | Restrict camera, microphone, geolocation |
| `X-Powered-By` | LEAKS `Next.js` | Set `poweredByHeader: false` in `next.config.js` |

## Authentication security

| Check | Result |
|---|---|
| Admin route protection | PASS — `/admin` redirects to `/admin/login` |
| Admin registration | PASS — "No public admin registration" displayed |
| Sign-out endpoint | PASS — POST-only (GET → 405), CSRF-safe |
| COD checkout gate | PASS — 403 `checkout_disabled` |
| Supabase leaked-password protection | BLOCKED — owner toggle needed |

## API endpoint security

| Endpoint | Method | Unauthenticated result | Assessment |
|---|---|---|---|
| `/api/checkout/cod` | POST | 403 `checkout_disabled` | PASS |
| `/api/admin/account/sign-out` | GET | 405 Method Not Allowed | PASS |
| `/admin/*` | GET | 302 → `/admin/login` | PASS |

## `robots.txt` hardening

Admin, API, cart, checkout, orders, preview and search paths all disallowed. PASS.

## Prior security work (from engineering closeout)

- Migration 28: staff direct Data API write escalation closed
- Media rights metadata hidden from public
- Raw DB errors removed from COD route and admin order list
- Admin search terms no longer alter PostgREST filters
- Direct-access security: 193/193 passed
- Role HTTP: 126/126 passed
- Auth matrix: 24/24 passed
- P0 probe: 9/9 passed
- Role matrix: 15/15 passed

## Remediation priority

1. **P2:** Add non-CSP headers + `poweredByHeader: false` first; verify storefront/admin
2. **P2:** Design CSP allowlists for Google Maps, image/CDN hosts, fonts, video — then test
3. **P2:** Owner enable Supabase leaked-password protection (dashboard toggle)
4. **P3:** Consider Vercel WAF rules for production (paid — needs approval)
5. **Do not** revoke storefront RPC grants indiscriminately; migration 28 already least-privileged staff writes

## Verdict

**PASS** for authentication, authorization, API gates, and prior security fixes.  
**PARTIAL** for HTTP security headers (5 missing, 1 info leak). Fixable in a single `next.config.js` change.
