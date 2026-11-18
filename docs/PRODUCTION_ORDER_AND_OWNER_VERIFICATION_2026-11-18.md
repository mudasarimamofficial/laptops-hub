# Production order + owner verification — 2026-11-18

Production SHA baseline at inspection start: `c311b65`.

## 1. Order `LH-261118-77C0F6`

| Field | Value |
|---|---|
| UUID | `2b989f3d-5cb5-4068-9e83-899387d92118` |
| Status | `placed` |
| Payment | `cod` / `unpaid_cod` |
| Total due | **Rs 181,410.00** (subtotal 181,000 + shipping 360 + COD fee 50) |
| Customer name | Mudasar Imam |
| Customer email | `mudasarimamofficial@gmail.com` |
| Phone | `+923191106310` |
| Customer note | **`testing`** |
| Address | Lahore, Punjab, PK · postcode 54840 · landmark RHQ |
| Created | 2026-11-18 09:12:30 UTC |
| Confirmation | `cod-v2-terms-returns-privacy` accepted at create |

### Line items

| Qty | Product | Unit | Line |
|---|---|---|---|
| 3 | Dell 5400 - Core i5, 8th Gen, 8GB RAM, 256GB Storage (`dell-5400-…`) | Rs 49,000 | Rs 147,000 |
| 1 | Dell 5470 - Core i5, 6th Gen, 4GB RAM, 128GB Storage (`dell-5470-…`) | Rs 34,000 | Rs 34,000 |

### Purpose classification

**QA / engineering test order — not a live customer purchase.**

Evidence: explicit customer note `testing`, purchaser identity matches the engineering admin mailbox (`mudasarimamofficial@gmail.com`), and timing aligns with checkout enablement verification the same day.

**Operational next steps (do not auto-cancel):**

1. Leave status `placed` / `unpaid_cod` until the merchant decides.
2. Do **not** dispatch, collect cash, or mark delivered.
3. Preferred merchant action when ready: cancel as test (or archive via normal cancel workflow) so inventory/ops are not confused.
4. Do not delete the row — retain for notification/COD audit evidence.
5. `order_events` already includes `ops_note` (2026-11-18 14:30 UTC): QA classification + do-not-dispatch.

### Notifications

| Recipient | Status | Provider message id | Notes |
|---|---|---|---|
| Merchant (business) | `accepted` | `01a1eded-dc0c-7298-be19-cbb5836a2d60` | Accepted by Resend at 09:12:31 UTC — **before** Production `STORE_NOTIFY_EMAIL` was cut over to `infolaptopshub@gmail.com`. Inbox delivery to the new permanent mailbox is **not** proven by this row. |
| Customer | `skipped` | — | Expected while `NOTIFY_CUSTOMER_EMAIL` is unset. |

Outbox row status: `accepted` · attempts `1` · no `last_error`.

## 2. Owner Auth (unchanged UUID)

| Field | Value |
|---|---|
| UUID | `cc603db4-d291-4dc1-a401-b04ffbeff86c` |
| Email | `infolaptopshub@gmail.com` |
| Role | `owner` · `is_active=true` |
| Staff companion | `mudasarimamofficial@gmail.com` · role `admin` · active |

## 3. Reels

Six `preset_key` drafts remain unpublished (`rights_status=pending`). All six MP4, poster, avatar, and HLS URLs returned HTTP 200 on HEAD. Public storefront must not show them until rights + attribution are confirmed — do not invent endorsements.

## 4. Certification delta

| Claim | State |
|---|---|
| Production COD order create | **PASS** (DB evidence) |
| Merchant outbox provider accept | **PASS** (Resend id recorded) |
| Merchant alert in `infolaptopshub@gmail.com` inbox | **Provider PASS / inbox PENDING human open** — post-cutover smoke `POST /api/admin/notifications/test` → Resend `01a1ef1a-a5c8-7740-b285-bb0c090f51b0` accepted. Open the permanent owner mailbox to confirm delivery. |
| Fresh owner browser login | **PASS** — magiclink confirm → `/admin` shows `infolaptopshub@gmail.com` · role `owner`; session persisted on reload |
| Password recovery landing | **PASS** — recovery confirm → `/admin/reset-password` for `infolaptopshub@gmail.com` (password not changed in this pass) |
| Customer email | **N/A / skipped by design** |
| Live customer fulfillment for `LH-261118-77C0F6` | **NOT applicable** — QA order; `order_events.ops_note` recorded |
| Six reels admin preview | **PASS** — 6/6 `<video>` `readyState=4`, posters `naturalWidth=600`; remain draft / rights pending / unpublished |
