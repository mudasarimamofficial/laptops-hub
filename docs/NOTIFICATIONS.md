# Order notifications — design and guarantees

Code: `src/lib/notify/outbox.ts`, `send-email.ts`, `templates.ts` · DB: `notification_outbox`,
`claim_notifications()` (migration `20261024100000`) · Tests: `tests/isolated/outbox-reliability.test.ts`,
journeys "notifications" in `tests/e2e-isolated/launch-journey.spec.ts`.

## Flow

1. `create_cod_order` writes one outbox row in the same transaction as the order (never for a replayed submit).
2. After the checkout response is sent, the server tries to deliver it (`after()`). Safety nets: the cron
   `/api/cron/notifications` (secret-protected) and the staff **Retry sending** button on the order page.
3. A worker **claims** rows with `claim_notifications()` — atomic, `FOR UPDATE SKIP LOCKED`, a new `claim_token` and
   `claimed_at` per claim. Every later write is conditional on that token.
4. The **store alert** (to `STORE_NOTIFY_EMAIL`) and the **customer confirmation** (only with
   `NOTIFY_CUSTOMER_EMAIL=1` and a customer email; otherwise `skipped`) are tracked separately
   (`business_*`, `customer_*`: status, provider message id, accepted time).

## Guarantees (each covered by an isolated test)

| Requirement | How |
|---|---|
| No double claim | atomic claim with row locks; concurrent workers skip locked/leased rows (6 parallel workers → 1 claim) |
| Stale recovery by claim age | a `sending` row is reclaimed only when `claimed_at` is older than the lease (300 s). An old row with a live claim is left alone (the previous rule used `created_at`) |
| Expired worker cannot overwrite | writes require the current `claim_token` and `status = sending`; a worker that lost its lease gets 0 rows and stops (`lost`) |
| No duplicate after provider acceptance | each recipient has a fixed idempotency key `outbox-<row id>-<recipient>`; an accepted recipient is never sent again; a crash between acceptance and the database write is retried with the same key, and the provider returns the original message instead of sending again |
| Provider's 24-hour key retention | automatic retries stop 23 h after the first attempt (`RETRY_WINDOW_HOURS`); the row stays `failed` with "automatic retries stopped" for a staff decision |
| Independent recipients | partial delivery keeps the accepted recipient; only the failed one is retried |
| Accepted ≠ delivered | status `accepted` means the provider accepted the message. The admin page says "delivery to the inbox is not confirmed". Inbox delivery/bounce tracking would need provider webhooks (not built) |
| Bounded, visible failures | backoff 1 min → 5 min → 30 min → 2 h → 6 h; max 5 automatic attempts; failed rows stay listed and counted ("Unsent notifications") |
| Permanent vs temporary errors | 409 `concurrent_idempotent_requests` / `resource_locked`, 429, 5xx and network errors back off and retry. 409 `invalid_idempotent_request` (same key, different body) and other 4xx stop automatic retries at once ("automatic retries stopped"); staff retry after fixing the cause |
| Who may claim | `claim_notifications()` is SECURITY INVOKER, empty `search_path`, EXECUTE for service_role only, and refuses any request whose JWT role claim is not `service_role` (a missing claim included) |
| Timeouts | `NOTIFY_TIMEOUT_MS` (default 15 s). A timed-out send that the provider still accepted is not duplicated on retry (same key). A second request while the first is still in progress gets 409 from the provider and is retried later |
| Not configured | without `RESEND_API_KEY`, `STORE_FROM_EMAIL` and `STORE_NOTIFY_EMAIL` nothing is claimed and nothing is reported as sent; rows stay `pending` |

Manual retry (staff) ignores backoff, the attempt limit and the window for that order — the staff member decides.
It still never resends a recipient already accepted. After the 24-hour window the provider no longer de-duplicates,
so check the inbox before retrying an old row.

## Statuses

| Row `status` | Meaning |
|---|---|
| `pending` | waiting (or email not configured) |
| `sending` | claimed by a worker (lease 5 min) |
| `accepted` | every required recipient accepted by the provider |
| `failed` | at least one recipient failed; see `last_error` and "Next automatic attempt" |

Recipient status: `pending`, `accepted`, `failed`; customer also `skipped`.

## Retry schedule and monitoring (recommendation for the Hobby plan)

1. **Immediately after each order** the server sends the alert (no schedule involved). This covers almost all orders.
2. **Every 15 minutes**: GitHub Actions workflow `.github/workflows/notification-retry.yml` calls
   `/api/cron/notifications` with the secret. Free (the repository is public), no extra account. It stays inactive
   until the repository secret `CRON_SECRET` is added (GitHub → Settings → Secrets and variables → Actions), with the
   same value as the Vercel Production variable. GitHub runs scheduled workflows only from `main`, so it starts once
   this file is merged. GitHub may delay scheduled runs by some minutes under load and pauses schedules after 60 days
   without repository activity (re-enable in the Actions tab).
3. **Once a day** (06:00 UTC): the Vercel cron in `vercel.json` — backup if GitHub is unavailable.
4. **Staff**: the admin overview shows **Orders to confirm** (independent of email) and **Unsent notifications**.

Alerts on failure: a workflow run fails when the endpoint errors or a message fails again; GitHub then emails the
repository owner. Rows that stopped retrying ("automatic retries stopped") are no longer claimed and therefore no
longer alert — they stay in **Unsent notifications** until staff act.

Monitoring procedure (owner or a named staff member):
- Opening hours: check **Orders to confirm** at least every 2 hours — orders never depend on email arriving.
- Daily: **Unsent notifications** must be 0; for any row open the order, read the error, fix the cause (for
  example an expired API key or unverified domain), press **Retry sending**.
- Weekly: Resend → Emails (delivered / bounced); GitHub → Actions → notification-retry (green runs).

Alternative if GitHub is not wanted: Vercel Pro (cron as often as every minute; paid) — change the schedule in
`vercel.json` only, no code change.
