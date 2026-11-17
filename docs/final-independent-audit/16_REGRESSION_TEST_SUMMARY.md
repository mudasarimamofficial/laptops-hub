# 16 — Regression test summary (this session)

**Date:** 2026-11-17  
**Stack:** local Supabase + `NEXT_DIST_DIR=.next-local` on `http://127.0.0.1:3001`

## Focused suite (after inventory + shortcuts fixes)

| Spec | Result |
|---|---|
| `p0-admin-search` — Ctrl+K / `/` / SKU / phone / roles | **4/4 PASS** |
| `p0-admin-search` — `?` + G O shortcuts | **PASS** after `openRef` fix (stale closure) |
| `p0-merchant-inventory-collections` — collections / inventory / analytics | **4/4 PASS** (includes soft-deleted ghost count regression) |

## Not re-run this session (prior production evidence still cited)

- Full 114+ isolated suite
- Cross-browser matrix
- Security SQL matrices

Re-run full suite before merge of this audit branch.

## Production

No production deploy of this session’s code yet. Live site remains `585c8e9`.
