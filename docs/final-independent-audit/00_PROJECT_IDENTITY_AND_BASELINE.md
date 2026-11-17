# 00 — Project identity and baseline

**Audit started:** 2026-11-17 (Asia/Karachi)  
**Auditor session:** Independent forensic re-verification (no prior-session memory trusted)  
**Working branch:** `audit/final-independent-certification` (tracks `origin/main`)

## Verified identity

| Item | Claimed | Independently verified |
|---|---|---|
| GitHub repo | `mudasarimamofficial/laptops-hub` | Yes — public, default `main`, remote matches |
| Vercel project | `laptops-hub` / `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` | Yes — team `mudasarimamofficial-gmailcoms-projects` |
| Production domain | `https://www.laptopshub.pk` | Yes — HTTP 200 |
| Apex domain | `https://laptopshub.pk` | Yes — HTTP 308 redirect |
| Production deployment | `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` | Yes — READY, aliases include www + apex |
| Production Git SHA | `585c8e96a3b3b6dfb9fa97e9e1c72a55c90902a4` | Yes — `origin/main` tip = Merge PR #13 |
| Function region | `sin1` | Yes — vercel.json + build config `regions: ["sin1"]`; homepage lambda on `sin1` |
| Next.js | 16.4.5 | Yes — `package.json` + lockfile |
| Supabase project | `xvmmjkrkgznnakcobmww` | Yes — ACTIVE_HEALTHY, region `ap-southeast-1`, linked |
| CRM subdomain | `https://app.laptopshub.pk` | Yes — HTTP 200 (do not modify) |

## Git baseline (this machine)

| Fact | Value |
|---|---|
| Local HEAD at audit start (wrong branch) | `fix/theme-editor-narrow-overflow` @ `3b8f7cf` |
| Corrected working tip | `audit/final-independent-certification` @ `585c8e9` = `origin/main` |
| Open PRs | None (PR #1–#6, #8–#13 merged; #7 closed) |
| Untracked local noise (not committed) | `.agents/`, prompt/audit markdowns, `skills-lock.json`, reviews HTML |
| Stash | `stash@{0}` preserved (do not drop) |

## Database baseline (production, read-only)

| Fact | Value |
|---|---|
| Remote migrations applied | **29 / 29** (local and remote lists identical) |
| Older docs claiming “14 pending” | **Stale** — superseded by live ledger |
| Products (non-deleted) | 226 `active` + 6 `draft` |
| Soft-deleted products | 1 (233 total rows) |
| Variants | 234 |
| COD setting (`store_settings.cod_checkout`) | `enabled: false`, reason: owner shipping/policies pending |
| Live COD API | `POST /api/checkout/cod` → **403** `checkout_disabled` |

## Commerce / feature flags (production Vercel env — names only)

Present in Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `COD_CHECKOUT_ENABLED` (secret)
- `NEXT_PUBLIC_COD_CHECKOUT_ENABLED`

**Not present** in the Vercel env listing (as of this audit):

- `THEME_PUBLISHED_ENABLED`
- `RESEND_API_KEY`
- `STORE_FROM_EMAIL`
- `STORE_NOTIFY_EMAIL`
- `CRON_SECRET`
- `NOTIFY_CUSTOMER_EMAIL`

Implication: homepage stays on built-in V5 default; transactional email is not configured in Production; public COD remains gated (also DB + API).

## Browser access status (updated this session)

| Surface | Access | Notes |
|---|---|---|
| Live storefront | **Authenticated browser** | Homepage, add-to-cart, gated checkout verified |
| Merchant admin | **Owner session live** | `laptopshubofficial@gmail.com` · role owner · Overview + Products verified |
| Shopify benchmark admin | **Owner session live** | Resolves to `admin.shopify.com/store/laptopshub-2` (from qiytdqzr URL) |
| Vercel dashboard | **Owner session live** | Overview + Settings → Functions (`sin1` via vercel.json, Fluid on) |
| Supabase dashboard | Partial | MCP advisors + SQL + CLI migrations; UI walkthrough still optional |

No passwords or OTP codes requested or recorded.

## Rollback checkpoint

- Remote production SHA: `585c8e9`
- Production deployment ID: `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N`
- Instant rollback candidate (prior READY): see Vercel production history (`dpl_2gJc3wmK…` / earlier READY rows)
- Database: Vercel rollback ≠ migration rollback; 29 migrations already applied

## Classification after Phase 0–8 (this session refresh)

**Infrastructure identity: PASS**  
**Authenticated merchant + Shopify browser: PASS** (owner sessions live)  
**Live COD: correctly DISABLED (not a defect)**  
**Isolated COD E2E: PASS** (`p0-variant-order-journey` 9/9)  
**Engineering fixes pending deploy:** DEF-016 inventory counts · DEF-017 keyboard shortcuts  

**Overall (honest):** **PRODUCTION VERIFIED — MERCHANT INPUTS PENDING** for live commerce; local fixes not yet on production `585c8e9`.
