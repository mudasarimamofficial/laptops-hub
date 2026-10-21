# 00 — Forensic audit (Phase 0)

**Date:** 2026-10-21  
**Auditor:** Autonomous production engineering session  
**Authority:** `Laptops_HUB_Full_Stack_COD_Cursor_Project_Bible/CURSOR_MASTER_PROJECT_BIBLE.md`

---

## 1. Verdict

| Area | Finding |
|------|---------|
| Local workspace | Claude Design **V5 HTML prototype** + catalog/docs. **Not** a Next.js app. **Not** a git repository yet. |
| Architecture mandate | **Independent** Next.js + Supabase + Vercel COD store. Shopify handoff docs are **design mapping only** — do not build Shopify Liquid/checkout. |
| Cloud IDs | All three owner-supplied IDs **verified** against live CLI sessions (see §3). |
| Catalog | **232** handles · **226** active · **6** drafts · **964** images — CSV and `lh-catalog.js` agree. |
| Production readiness | **Blocked** for public COD acceptance (policies, media rights, shipping config, owner approvals). Engineering may proceed in preview/sandbox. |

---

## 2. Source inventory (local)

| Path | Role | Notes |
|------|------|-------|
| `Laptops Hub Storefront v5.dc.html` (~202 KB) | **Authoritative V5 visual/interaction baseline** | Hash-routed `#/...`; custom `<sc-if>` / `<sc-for>` / `{{}}`; depends on `support.js` |
| `ProductCard v5.dc.html`, `LHImg.dc.html` | Component references | Not React |
| `support.js` (~69 KB) | Prototype runtime | **Must not** ship as production storefront |
| `data/lh-catalog.js` (~324 KB) | Catalog snapshot | Keys: `h,t,brand,price,…imgs,…status`; **232** products; **964** `imgs` |
| `data/lh-content.js` | Nav, pages, pending content blocks | Pending business copy must remain pending — never invent |
| `data/source/products_export_final.csv` | Import snapshot | **968** rows → **232** title rows; contains **Cost** + CRM body notes → **never commit to public git** |
| `assets/`, `uploads/` | Media / cutouts | Rights uncleared (prior docs: 0/232 cleared) |
| `docs/*` | Design, QA, gates | Prior narrative assumed Shopify OS 2.0 — superseded for *architecture* by master bible |
| `Laptops Hub storefront.zip` (~54.7 MB) | Archive of above | Keep out of public deploy/`public/` |
| `qa/`, `QA *.html` | Prototype QA only | Does **not** prove COD/DB/security |
| `Laptops_HUB_Full_Stack_COD_Cursor_Project_Bible/` | Production bible | Binding for stack + COD + admin |

**Prototype limitations (confirmed):** cart/compare in browser storage; checkout disabled; forms demo-only; no durable orders; hash URLs (not SEO SSR).

---

## 3. Connected infrastructure (verified this session)

### GitHub
| Check | Result |
|-------|--------|
| CLI account (active) | `mudasarimamofficial` |
| Target repo | `https://github.com/mudasarimamofficial/laptops-hub` |
| Visibility | **PUBLIC** |
| Contents | **Empty** (`isEmpty: true`) |
| Local `.git` | **Absent** — workspace was never initialized |

**Risk:** Public empty repo + raw CSV with costs/CRM → import pipeline must sanitize; secrets and CSV stay local / private storage only.

### Vercel
| Check | Result |
|-------|--------|
| CLI user | `mudasarimamofficial-2733` |
| Linked project | `laptops-hub` |
| Project ID | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` ✅ matches owner |
| Org/team | `team_l7hth478q4bLcmoKR21X7uqm` |
| Framework (remote) | Other (will switch to Next.js) |
| Deployments | **None** at audit time |
| Env vars (remote) | **0** |

### Supabase
| Check | Result |
|-------|--------|
| Project name | `Laptops Hub` |
| Ref | `xvmmjkrkgznnakcobmww` ✅ |
| URL | `https://xvmmjkrkgznnakcobmww.supabase.co` ✅ |
| Status | `ACTIVE_HEALTHY` |
| Region | `ap-southeast-1` |
| Postgres | 17.x |
| Local link | Linked this session (`supabase link --project-ref xvmmjkrkgznnakcobmww`) |
| Docker | **Not running** — local Supabase stack / `db dump` via Docker unavailable |
| Schema dump | Deferred — inspect via Management/SQL after migrations authored; treat remote as **empty greenfield** until proven otherwise |
| App env keys | Present via CLI; will be written to ignored `.env.local` only (never git) |

**Safety rule:** Do not create new GitHub/Vercel/Supabase projects. Do not deploy to any Vercel project other than `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`.

---

## 4. Catalog reconciliation

| Metric | CSV | `lh-catalog.js` |
|--------|-----|-----------------|
| Unique handles | 232 | 232 |
| Status active | 226 | 226 |
| Status draft | 6 | 6 |
| Image Src / `imgs` | 964 | 964 |
| Zero-price **public** | — | **0** |
| Inventory tracker | empty all rows | no public stock fields |

**Draft handles (private):**  
`dell-precision-7730-xeon-p4200-crm-identity-review`, `mix-non-touch-2in1-crm-identity-review`, `asus-celeron-8-128-crm-identity-review`, `dell-precision-7530-crm-identity-review`, `laptop-batteries-crm-review-required`, `dell-precision-7520-crm-identity-review`

**Chromebook rule:** Only `hp-chromebook-14-g5-4-32` is a Chromebook laptop. `chromebook-type-c-charger` is **Accessories**.

---

## 5. Design / route parity baseline

Frozen V5 tokens (from `docs/DESIGN_SYSTEM.md`): signal `#E52434`, action `#2159D4`/`#1748B5`, canvas `#F6F9FE`, titanium `#DFEAF7`, ice `#EAF3FE`, navy `#0A1730`, electric `#1CB9E8`, iris `#6574D5`, fonts Sora / Hanken Grotesk / JetBrains Mono.

Routes (from `docs/ROUTE_INVENTORY.md`) must become App Router paths (no hash): `/`, `/collections/*`, `/products/[handle]`, `/search`, `/compare`, `/cart`, `/checkout`, `/order/success/[token]`, `/track-order`, `/pages/*`, `/guides/*`, `/admin/*`.

Content pages largely **PENDING BUSINESS APPROVAL** — render pending blocks from `lh-content.js`; never invent policies, fees, addresses, or warranties.

---

## 6. Security & data risks

1. **Public GitHub** + sensitive CSV (costs, CRM HTML) — gitignore + sanitized seed only.  
2. **Media rights** uncleared — preview may hotlink existing URLs with watermark/disclaimer; production launch gated.  
3. **No RLS/orders yet** — until migrations + negative tests pass, checkout must remain feature-flagged / preview-only.  
4. **Prototype localStorage cart** — UI cache only; server is authoritative for COD.  
5. **Docker absent** — prefer remote migrations with explicit review; document backup before any destructive SQL.  
6. Prior Shopify docs must not reintroduce payment gateways or Liquid themes.

---

## 7. Implementation strategy (phased)

| Phase | Action |
|-------|--------|
| **0** | This audit · protect secrets · init git → existing empty repo · `reference/` for prototypes |
| **1** | Next.js App Router TS · tokens · Supabase migrations (catalog, commerce, RLS) · COD RPC · `.env.example` |
| **2** | Idempotent import of 232 · reconciliation report · drafts hidden |
| **3** | Pixel-faithful storefront (header, hero, story, cards, collections, PDP, compare, cart) |
| **4** | Guest COD checkout · atomic order · admin fulfillment/COD collection |
| **5** | Full admin CMS (products, content, shipping, inquiries, reports, staff) |
| **6** | Wire Vercel env · preview deploy · Git integration |
| **7** | Unit/integration/E2E/visual/security |
| **8** | Owner approvals → production only with explicit go-live |

**Checkout public acceptance:** OFF until shipping zones, COD terms, contact, and policies are owner-configured (admin settings + release gate).

---

## 8. Owner blockers (non-engineering)

See `docs/OWNER_APPROVAL_CHECKLIST.md` + bible §27: domain, contacts, shipping/COD fees, policies, media rights, draft reviews, tax rule, notification providers, first admin identity.

---

## 9. Next engineering action

1. Expand `.gitignore` for secrets/CSV/zip/reference.  
2. Move/copy V5 prototype into `reference/` (not served).  
3. Scaffold Next.js at repo root; baseline commit to `mudasarimamofficial/laptops-hub`.  
4. Author Supabase migrations + link env keys locally.  
5. Update `docs/PROGRESS.md` / `docs/RESUME.md` after each phase.

**No duplicate cloud projects. No production COD until gates clear.**
