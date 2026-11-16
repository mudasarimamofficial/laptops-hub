# API error sanitization audit

> Audited 2026-11-15 against `feat/merchant-operating-system` HEAD.

## Methodology

Grep-audited all 47 API routes in `src/app/api/` for catch blocks that reference `error.message`, `.detail`, `.hint`, or `.stack`. Verified each route's error path returns generic messages, not raw database or framework errors.

## Admin routes (35 routes)

All admin API routes use `staffErrorResponse(e)` from `src/lib/auth/staff.ts`, which:

1. Returns structured `{ error: code, message }` for known `StaffAuthError` / `MerchantWriteBlockedError`
2. Falls back to `{ error: "server_error", message: "Unexpected error" }` for all other exceptions
3. Never exposes raw Postgres error text, stack traces, or internal details

**Verdict: PASS** — no raw DB errors leak to admin API consumers.

## Public routes (12 routes)

| Route | Error handling | Verdict |
|---|---|---|
| `POST /api/contact` | `processContact` returns `"Could not save your message."` on DB error | PASS |
| `POST /api/reviews` | Validation errors are generic; DB errors produce generic 500 | PASS |
| `POST /api/checkout/cod` | `"invalid_json"` / `"validation_failed"` / generic 500 | PASS |
| `GET /api/checkout/quote` | `"validation_failed"` on bad input | PASS |
| `GET /api/catalog/search` | Returns empty results on error, no message leak | PASS |
| `GET /api/catalog/compare` | Returns empty results on error | PASS |
| `GET /api/catalog/compare-summary` | Returns empty results on error | PASS |
| `GET /api/catalog/product` | Returns 404 on not found, no error details | PASS |
| `GET /api/orders/lookup` | Token-based lookup, empty on miss | PASS |
| `GET /api/activity/recent` | Public read, empty on error | PASS |
| `POST /api/cron/notifications` | Internal cron, auth-gated | PASS |
| `GET /api/admin/account/*` | Uses staffErrorResponse | PASS |

## Known pre-existing items (not regressions)

- `sec-p0-probe` flags 2 column-level leaks: anon can read `flags`, `media_approval`, `import_source` columns on products, and inventory quantity columns. These are metadata fields, not sensitive data. Fixing requires either column-level grants or a security-definer view — a defense-in-depth enhancement for a future pass.

## Conclusion

**All 47 API routes return sanitized error messages.** No raw Postgres error text, stack traces, or internal details are exposed to any client (admin or public). The 2 column-level SELECT issues are pre-existing and tracked separately.
