# Staff handbook — daily operations

For the owner and staff of Laptops HUB. Admin: `https://laptops-hub.vercel.app/admin` (sign in with your staff
email). Roles: `docs/ADMIN_ROLE_MATRIX.md`.

## 1. Owner bootstrap and staff accounts

Follow `docs/FINAL_LAUNCH_OWNER_INPUTS.md` § A: **Create new user** (with Auto Confirm) in Supabase → Authentication,
then `supabase/owner/bootstrap_owner.sql` with that email (role `owner`, or the staff role). Do not use "Invite user"
or password-recovery emails — the website has no page to complete them. Remove access:
`update public.admin_memberships set is_active = false where user_id = '<id>';` (sign-in then shows "forbidden").
Never share accounts.

## 2. Before taking orders (owner/manager)

- **Shipping zones** — Admin → Settings → Add shipping zone: name customers see, provinces (and optionally cities),
  delivery fee, COD fee, a note (courier + delivery time). Tick *Active*. Edit or switch off later with *Edit zone*.
  Only enter coverage and fees agreed with your courier.
- **Policies** — Admin → Content: write the approved text in each policy page, publish, and (owner/admin/manager)
  tick legal approval. Pages with "being finalised" sections cannot be published empty.
- **Notifications** — engineering sets `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` (and optionally
  `NOTIFY_CUSTOMER_EMAIL=1`) in Vercel once the owner has the email account (`docs/FINAL_LAUNCH_OWNER_INPUTS.md` §5).

## 3. Every new order

1. An alert arrives at the store inbox; the admin overview shows **Orders to confirm**.
2. Open the order (Admin → Orders). Check items, total, address, phone.
3. **Call the customer** to confirm the order and that the item is available (stock is not tracked).
   - Available → *Next status* `confirmed` → Update status.
   - Not available / customer cancels → `cancelled` (add a note). Tell the customer.
4. Packing → `packing`. Hand to courier → `shipped`, with **carrier** and **tracking number** (the customer sees them
   on their order page).
5. Courier out for delivery → `out_for_delivery`; delivered → `delivered`; failed attempt → `delivery_failed`
   (then `shipped` again for a re-attempt, `returned` if it comes back, or `cancelled`).

The customer can always see the current status at their order link or on **Track order** (order number + phone).

## 4. Cash on delivery collection

When cash is received (from the rider/courier): order → **Record collection** with the amount and a collector
reference (rider name or courier settlement id). Partial amounts are allowed; the order shows *Paid — cash
collected* only when the full amount is recorded. **Delivered is not paid** — always record the cash.
If the page says "already used for a different order or amount", the collection was already recorded — check the
order's collection history before trying again; never re-enter the same cash with a new reference.

## 5. Notifications

Each order page has a **Notifications** box with the store alert and the customer email separately:
`accepted` (the email provider took it — check the inbox; delivery is not confirmed by the website), `pending`
(provider not configured), `failed` (with the error and the next automatic attempt), `skipped` (no customer email).
Press **Retry sending** after fixing the cause; a recipient already accepted is never sent again. Automatic retries
stop after 5 attempts or 23 hours ("automatic retries stopped") — then check the inbox before retrying, because after
24 hours the provider can no longer recognise a repeat. The overview counts **Unsent notifications**; the cron safety
net runs daily (`docs/NOTIFICATIONS.md`).

## 6. Customer inquiries

Admin → Inquiries lists contact-form messages. Reply by phone/email from your own mailbox.

## 7. If something goes wrong

- Orders must stop **now**: Admin → Settings shows the checkout switches; ask engineering/owner to set
  `store_settings.cod_checkout.enabled = false` (immediate) — the site keeps working, checkout closes.
- Wrong price published: Admin → Products → edit price or set *draft*; existing orders keep the price they were placed
  at.
- Website broken after a release: Vercel → Deployments → Instant Rollback to the previous production deployment.
- Suspected account misuse: deactivate the membership (§1) and change the password in Supabase.
