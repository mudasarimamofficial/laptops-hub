# Client readiness acceptance — 2026-11-19 (post ca7e468)

Baseline production: `ca7e4685b97444b915fa0e27cab739c8a5bd52a6` / `dpl_HTiVFkGA1CyLumajhuYqmDfvsoqR`.  
Resend workspace repair and PRs #43–#45 were already complete; this pass closes remaining acceptance items.

## 1. Owner password reset / login / role+UUID

| Check | Label |
|---|---|
| Owner Auth UUID + role (SQL) | **PASS** — `cc603db4-d291-4dc1-a401-b04ffbeff86c`, role `owner`, `is_active=true`, email `infolaptopshub@gmail.com` |
| App recovery request (`/admin/forgot-password`) | **PASS** — generic success: “If this email belongs to a staff account…” |
| Fresh reset email delivery | **PARTIAL** — request accepted; confirm Delivered in correct Resend workspace + Gmail (owner) |
| Password form via confirm/hash bridge | **OWNER VERIFICATION REQUIRED** — owner sets password privately within link window |
| Fresh email/password login after reset | **OWNER VERIFICATION REQUIRED** |
| Role/UUID unchanged after reset | **PASS** (pre-check); re-confirm after owner login |

Do not claim complete client readiness until owner login after reset is confirmed.

## 2. Wrong-workspace credential revoke

| Check | Label |
|---|---|
| Wrong account identified | **PASS** — Cursor/Resend login `mudasarimamofficial`, Domains empty |
| Revoke `laptops-hub-supabase-auth-smtp` | **PASS** — deleted; UI: “This API Key has been deleted” |
| Correct workspace keys intact | **PASS** — `infolaptopshub`: `laptops-hub-supabase-auth-smtp-v2` + `laptops-hub-production-sending` |
| App notifications credential | **PASS** — production-sending key preserved (not revoked) |

## 3. Recovery bridge (isolated Playwright)

| Check | Label |
|---|---|
| Valid `#access_token&type=recovery` → cookies → `/admin/reset-password` | **PASS** |
| Malformed / non-recovery hash ignored | **PASS** |
| Cleared cookies → reset form refused | **PASS** |
| 15-minute recovery window constant | **PASS** |
| Production expired link UI | **PASS** — “needs a valid reset link… within 15 minutes” |

Suite: `tests/e2e-isolated/auth-hash-recovery-bridge.spec.ts` (4/4).

## 4. Interactive / a11y / responsive (beyond 80 viewport smoke)

Artifact: `docs/INTERACTIVE_QA_SMOKE_2026-11-19.json` — **PARTIAL** (read-only smoke, not full UX certification).

| Area | Label |
|---|---|
| Storefront routes @ 390/768/1280 (http, h1, skip, overflow, focus) | **PASS** for `/`, collections, cart, checkout, compare, admin login/forgot |
| `/reels` path | **FAIL** as URL — no storefront `/reels` page (reels live on homepage/admin); treat as **NOT TESTED** for reel UX |
| Cart mutations / checkout inputs / compare / modals / touch | **NOT TESTED** |
| Merchant save/reload / owner admin auth session | **NOT TESTED** (mutating) |
| Screen-reader full audit | **NOT TESTED** |

Viewport JSON remains **PARTIAL** smoke only (`docs/VIEWPORT_QA_HONESTY_NOTE_2026-11-19.md`).

## 5. Checkout empty-cart H1

| Check | Label |
|---|---|
| Defect | Empty-cart hydrated path used `PendingBlock` (`h2`) only — no page `h1` |
| Fix | Empty cart now renders kicker + `<h1>` + browse CTA (branch `fix/release-acceptance-checkout-h1-recovery-qa`) |
| Production until deploy | Pre-hydration still shows “Place COD order”; post-hydrate empty state fixed after merge |

## 6. Blog create/edit/save/reload E2E

| Check | Label |
|---|---|
| Isolated blog publish → public `/guides/:slug` | **PARTIAL** — create/save reached DB `published` in prior CI; this run failed public H1 (`/guides` gated empty / post visibility). Needs re-run on healthy isolated stack after merge |
| Merchant workflow selectors (Visibility / Create post) | Shipped in #44; full merchant E2E needs authenticated preview storage (**NOT TESTED** this pass) |

## 7. CI / deploy / readiness

| Check | Label |
|---|---|
| Unit tests | **PASS** (local `npm run test:unit`) |
| ESLint on touched files | **PASS** |
| Hash-bridge isolated E2E | **PASS** 4/4 |
| Production deploy of this branch | Pending merge of checkout H1 + tests + docs |

### Overall client readiness

**PARTIAL — not complete client ready.**

Blocking for “complete”:

1. Owner privately completes password set + fresh login (**OWNER VERIFICATION REQUIRED**).
2. Merge/deploy checkout H1 fix.
3. Re-confirm blog public publish on isolated (**PARTIAL** until green re-run).

Non-blocking known gaps: full interactive matrix **NOT TESTED**; `/reels` URL myth; viewport smoke ≠ certification.
