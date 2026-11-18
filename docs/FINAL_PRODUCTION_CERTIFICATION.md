# Final production certification — operational acceptance

**Date:** 2026-11-18  
**Acceptance baseline exercised:** `30ac555af242bc713e4c4de108b3248a7ee7c7bd` (`dpl_9FUtP39…`)  
**Live production now:** GitHub `main` `c311b65b8d3ec51c34a8ef9a25c129abbaff9d9d` · see follow-on deploy after PR #38  
**Aliases:** `www.laptopshub.pk` + `laptopshub.pk`  
**Method:** Independent browser + API + isolated local suites. No invented customer PII. Hostinger CRM `app.laptopshub.pk` untouched.

Labels: **PASS** · **FAIL** · **BLOCKED** · **NOT TESTED** · **NOT APPLICABLE**

### Delta — 2026-11-18 evening (order + owner + reels)

| Gate | Verdict | Evidence |
|---|---|---|
| Live COD order create | **PASS** | `LH-261118-77C0F6` · Rs 181,410 · `placed` / `unpaid_cod` |
| Order purpose | **QA test** | customer_note=`testing`; purchaser=`mudasarimamofficial@gmail.com`; ops_note recorded — **do not dispatch** |
| Merchant outbox provider accept | **PASS** | Resend id `01a1eded-…` · business=`accepted` · customer=`skipped` |
| Merchant alert in permanent owner inbox | **PENDING** | Order sent **before** `STORE_NOTIFY_EMAIL` cutover to `infolaptopshub@gmail.com`; post-cutover smoke via `/api/admin/notifications/test` |
| Owner Auth email + UUID | **PASS** | `infolaptopshub@gmail.com` · UUID `cc603db4-…` · owner active |
| Fresh owner browser session | **PENDING → fix shipped** | Confirm route now accepts `magiclink` → `/admin` |
| Six Generation reels drafts | **PASS (draft only)** | All media HEAD 200; **0 published**; rights pending |
| Customer transactional email | **NOT APPLICABLE** | `NOTIFY_CUSTOMER_EMAIL` unset → skipped |

Detail: `docs/PRODUCTION_ORDER_AND_OWNER_VERIFICATION_2026-11-18.md`.

---

## 1. Release identity

| Gate | Verdict | Evidence |
|---|---|---|
| Newest READY production = `main` SHA | **PASS** | Acceptance on `30ac555`/`dpl_9FUtP39…`; post-fix live `c29801e`/`dpl_5YnLi4A3…` with www alias verified |
| Protect main + required `quality` | **PASS** | Prior session; unchanged this pass |
| Supabase `xvmmjkrkgznnakcobmww` | **PASS** | ACTIVE_HEALTHY; 31 migrations |
| CRM `app.laptopshub.pk` | **PASS** | Independent Hostinger A; not modified |

---

## 2. Notification system

| Gate | Verdict | Evidence |
|---|---|---|
| Staff invitation (owner → editor) | **PASS** | Admin Staff UI “Invitation sent”; Resend `Your Laptops HUB admin access` `last_event=delivered` |
| Password setup from invite link | **PASS** | QA editor set password and signed in |
| Editor login | **PASS** | Session on `/admin` as editor |
| Role permissions (editor vs Orders/Settings) | **PASS** | Editor denied Orders (403 / forbidden); isolated Playwright: editor cannot open Settings; fulfillment cannot customize theme |
| Forbidden copy for wrong role | **PASS** | Merged + deployed: `requireStaffPage` → `?reason=role|membership|denied` + reason-aware `/admin/forbidden` (`c29801e`) |
| Password recovery UI | **PASS** | `/admin/forgot-password` loads and accepts email |
| Recovery email via Resend | **NOT APPLICABLE** | Recovery uses Supabase Auth `resetPasswordForEmail` (not app Resend outbox) |
| Supabase Auth SMTP delivery of recovery | **NOT TESTED** | No recovery message observed in Resend; Auth SMTP not verified this pass |
| Notification outbox retries (cron) | **PASS** | Unauthorized cron 401; authorized cron 200 `{configured:true}`; GH Actions `notification-retry` success; isolated outbox suite **13/13** |
| Merchant order email (provider template mirror) | **PASS** | Controlled Resend send `delivered` |
| Customer transactional email on real order | **NOT TESTED** | Requires live order + `NOTIFY_CUSTOMER_EMAIL=1` |
| `NOTIFY_CUSTOMER_EMAIL` enabled | **NOT TESTED** | Flag left **unset**. Outbox code gates on `NOTIFY_CUSTOMER_EMAIL === "1"` && order email. Provider template ≠ order-triggered proof |

---

## 3. Customer journey (production browser)

| Step | Verdict |
|---|---|
| Homepage | **PASS** |
| Collection `/collections/all` | **PASS** (226 products; filters; Add to cart) |
| PDP Dell 5400 | **PASS** |
| Cart (3× → Items Rs 147,000) | **PASS** |
| Checkout form + quote UI (Lahore + Punjab) | **PASS** — All Over PK Delivery Rs 360 · COD Rs 50 · Cash due Rs 147,410 |
| Quote API | **PASS** — shipping 36000 / COD 5000 paisa |
| Place COD order (live) | **BLOCKED** — no owner-authorized QA name / `03XXXXXXXXX` / street in project records; must not invent |
| Confirmation page | **NOT TESTED** (depends on submit) |
| Merchant Orders → notification → cancel | **NOT TESTED** (depends on submit) |
| Prepared controlled submit | **PASS** (prep) — cart + quote ready; Place COD disabled until legitimate details entered |

Isolated COD matrix (local Supabase, not production writes): **23/23 PASS**. Concurrency **16/16**. Inventory/orders ledger **22/22**.

---

## 4. QA identity & dispatch safety

| Gate | Verdict |
|---|---|
| Authorized owner-controlled QA recipient in records | **BLOCKED** — not found |
| Labeled do-not-dispatch live order | **NOT TESTED** |
| Cancel via supported admin workflow | **NOT TESTED** |
| Production customer data used as fixtures | **PASS** (not done) |

---

## 5. Merchant admin (isolated + production read)

| Area | Isolated create→save→reload / deep | Production authenticated |
|---|---|---|
| Products + variants | **PASS** — Playwright create product + save variants | **PASS** — list + SKU search (prior + this era) |
| Collections | **PASS** — open + create form | **PASS** load |
| Inventory | **PASS** shell | **PASS** load (untracked Attention expected) |
| Orders | **PASS** shell | **PASS** empty list; email banner cleared |
| Reviews / Blog / CMS content | **PASS** shells; blog create/save/reload when CTA present | **PASS** load |
| Merchandising / Navigation / Media | **PASS** shells | **PASS** load |
| Shipping / Settings | **PASS** support email save | **PASS** All Over PK 360/50 read |
| Staff | **PASS** shell + invite/deactivate on prod | **PASS** — QA editor deactivated (`is_active=false`) |
| Activity log | **PASS** shell | **PASS** load |
| Role matrix | **PASS** editor/fulfillment denials | **PASS** editor Orders denied |

Merchant Playwright after expansion: **11/11 PASS** against local Next `:3001` + local Supabase only.

Production write mutations across every module: avoided (no uncontrolled catalog/CMS pollution). Deep writes certified on **isolated** data.

---

## 6. Responsive / a11y

| Viewport | Storefront | Admin |
|---|---|---|
| 360 | **PASS** — hamburger, brand, CTAs | **PASS** (Playwright products shell) |
| 390 | **PASS** — checkout quote path exercised | **PASS** |
| 768 | **PASS** — collection layout | **PASS** |
| 1280 | **PASS** — checkout desktop | **PASS** |
| 1440 | **PASS** (prior + Playwright) | **PASS** |

Skip-to-content / labeled form controls on checkout and admin login: **PASS**. No P0 console blockers observed on exercised paths.

---

## 7. P0/P1 disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| OPS-01 | P1 | Forbidden page did not distinguish role vs membership | **RESOLVED** — shipped in PR #21 / `c29801e` / `dpl_5YnLi4A3…` |
| OPS-02 | — | Live COD submit | **BLOCKED** on QA identity (not a code defect) |
| OPS-03 | — | Customer order emails | **NOT TESTED** — do not enable `NOTIFY_CUSTOMER_EMAIL` until a labeled live order proves outbox |
| OPS-04 | P3 | Reels empty | **BLOCKED** on licensed media |
| OPS-05 | Advisory | Leaked-password protection | **BLOCKED** — platform toggle not enabled |

No independently actionable P0 commerce defects found on exercised paths this pass.

---

## 8. Overall

| Domain | Verdict |
|---|---|
| Deploy ↔ SHA pin | **PASS** |
| Staff invite → password → login → roles → deactivate | **PASS** |
| Outbox retry / cron | **PASS** |
| Customer path through checkout + quote | **PASS** |
| Live COD order + cancel + order-triggered customer email | **BLOCKED** / **NOT TESTED** |
| Isolated merchant ops + viewports | **PASS** |
| `NOTIFY_CUSTOMER_EMAIL` | Remains **off** |

**Operational acceptance is not fully closed** until an owner-controlled QA recipient completes one labeled COD order, merchant notification observation, and cancel. Everything else independently testable without inventing PII: **PASS**.

Do not treat **BLOCKED** / **NOT TESTED** as **PASS**.
