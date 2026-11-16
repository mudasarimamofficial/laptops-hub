# Laptops HUB — Staging Certification Report (2026-11-16)

## Verdict

**Not certified on staging — no staging environment exists.** Creating one (a separate Supabase project and a
protected Vercel Preview) needs the owner's approval because it creates cloud resources. What *is* certified is the
**local isolated stack**, which is a full stand-in for staging. The details follow.

## What was certified (local isolated stack)

| Layer | Setup |
|---|---|
| Database | Local Supabase (Docker), `supabase db reset --local` from all 28 migrations; refuses non-local URLs (`assertLocalOnly`) |
| Data | `scripts/test-fixtures/seed-isolated.mjs`: synthetic products/variants/stock, one Pakistan delivery zone, staff of each role; local test orders cleared first |
| App | Production build (`next build`, `THEME_PUBLISHED_ENABLED=1`) served by `next start -p 3001` |
| Email | Fake Resend on `127.0.0.1:4599` (no real email can be sent) |
| Runner | `bash scripts/release/run-final-suite.sh <label>` — 26 suites; the verdict is PASS only if every suite exits 0 |

Results: `docs/evidence/final-run/summary.json` and the logs beside it. The run table is in
`LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md` §C.

Also rehearsed locally:
- **Migration upgrade:** 1–14 plus data, then 15–28. The result is byte-identical to a clean install (schema sha256 `66a6e5f7…`, identical grants). Evidence: `docs/evidence/migrations/`.
- **Backup/restore:** per-table counts and checksums are identical. Evidence: `LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md`.

## What a real staging run must still prove (owner approval needed)

1. Migrations 15–28 apply cleanly on a copy of production data (not synthetic data).
2. Vercel build and environment variables are correct on a protected Preview. `MERCHANT_MUTATIONS_DISABLED` is unset there, and the Preview points at the staging database, never production.
3. Real email delivery from the owner's verified Resend sender, to an address the owner controls.
4. `run-final-suite.sh` against the staging URL, plus a manual pass of `LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md` §A by the owner.
5. Supabase security and performance advisors read after migration.

## Limits of the local certification

- Lighthouse numbers are lab measurements on a developer machine. They are not field Core Web Vitals.
- Supabase Auth email templates, SMTP limits and dashboard settings (e.g. leaked-password protection) cannot be checked locally.
- Synthetic catalog only; the 964 production media items and real stock counts were not used.
