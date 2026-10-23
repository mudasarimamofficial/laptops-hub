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

## Retry frequency on the Vercel Hobby plan

Hobby allows one cron run per day (`vercel.json`: 06:00 UTC). The first attempt happens right after the order;
the cron is a daily safety net. If the provider is down at order time, the alert may wait until the next cron run
or a staff retry — the admin overview shows **Unsent notifications** and **Orders to confirm** independently of
email. Faster automatic retries need Vercel Pro (more frequent cron) or an external scheduler calling
`/api/cron/notifications` with `Authorization: Bearer <CRON_SECRET>` (owner decision,
`docs/FINAL_LAUNCH_OWNER_INPUTS.md` §5).
