# Final launch — owner inputs (single list)

Everything engineering needs from the owner to open real COD orders. Nothing here may be invented by engineering.
Answer inline (or send the answers) — each item says where it goes once answered. Updated 2026-10-24.

Legend: **🔴 blocks public orders** · 🟠 needed before launch, not before testing · 🟢 can follow launch

## Owner setup — do these in order (status read from production 2026-10-24)

Production today: `main` `5139ff0` live · database ledger 14 · COD **off** (environment and database) · 0 orders ·
0 shipping zones · 13 content pages *pending*, none legal-approved · 226 products active, 6 draft · 964 photos
*pending* · email not configured · site public and indexable.

Each step: **what** to supply · **why** · **where** · **how it is verified** · whether it **blocks ordering**.

| # | What | Why | Where | Verified by | Blocks orders |
|---|---|---|---|---|---|
| 1 | **Owner account** for yourself | No owner exists; the owner approves policies and manages staff | Guide A below (Supabase invite + one SQL line with *your* UID) | You see **role owner** on `/admin`; engineering lists memberships (read-only) | 🔴 yes |
| 2 | **Decide on the existing manager.** It is `cod-sandbox-…@lh-test.local`, created 2026-10-21 by an automated test, never signed in, password never stored | A leftover test account must not keep manager rights | Reply "deactivate the test manager" → engineering runs `update public.admin_memberships set is_active = false where user_id = (select id from auth.users where email like 'cod-sandbox-%@lh-test.local')` (or you delete the user in Supabase → Authentication) | membership shows `is_active=false`; sign-in shows "forbidden" | 🔴 yes (security) |
| 3 | **Staff**: name, email, role for each person | Orders need named people to confirm, pack, dispatch, collect cash | Guide A step 7 | each person signs in and sees their role | 🟠 before launch |
| 4 | **Shipping zones**: provinces/cities, delivery fee, COD fee, courier + delivery time per zone | Without an active zone no order can be placed; fees are charged exactly as entered | Admin → Settings → Add shipping zone (guide B) | readiness panel "active zones ≥ 1"; engineering checks a quote for one served and one unserved city | 🔴 yes |
| 5 | **Contact facts**: support phone, WhatsApp, support email, hours, address or "online only" | Customers and couriers must reach you; the contact page is still a placeholder | Admin → Content → Contact (write, publish) | contact page shows them | 🔴 yes |
| 6 | **Email**: Resend account, verified sender domain, alert inbox, customer email Y/N | New-order alerts; optional customer confirmation | Guide C; then tell engineering in chat (never paste the key in chat — add it yourself in Vercel, or approve engineering adding it) | § "Email go-live checks" below | 🟠 alert strongly recommended; orders still appear in admin without it |
| 7 | **Cron secret** (any long random text) in Vercel Production **and** GitHub repository secret `CRON_SECRET` (same value) | Automatic retries every 15 min (GitHub) + daily (Vercel) | Vercel → Settings → Environment Variables; GitHub → repo → Settings → Secrets and variables → Actions | `/api/cron/notifications` → 401 without, 200 with the secret; GitHub Actions run green | 🟠 |
| 8 | **Policies**: shipping, returns, warranty, privacy, terms — your facts, your lawyer's review | Customers are bound by them; COD rules and returns must be stated | Fill `docs/POLICY_DRAFTS.md` blanks → Admin → Content → write, publish, tick legal approval (owner/admin/manager) | each page public and marked approved | 🔴 yes |
| 9 | **Prices**: confirm the 226 published prices are current (or list changes / items to hide) | Price shown = price charged | Admin → Products (edit price or set draft) | your written confirmation | 🔴 yes |
| 10 | **Availability-confirmation workflow** (question 4.1): approve that every order is confirmed by phone before dispatch | Stock is not tracked; the website already says this to customers | Reply "approve 4.1" | — | 🔴 yes |
| 11 | **Photo rights** for the 964 images (own / supplier permission / manufacturer / unknown) | Publishing photos without rights is a legal risk | Reply with the source per brand or for all (guide E) | engineering records `approved`/`rejected` after your written statement | 🔴 yes (or draft the affected products) |
| 12 | **Monitoring person** and first-day plan | Someone must watch **Orders to confirm** | Reply with the name | — | 🟠 |

Optional any time: Mode B (hide the storefront until launch) — one approval, `docs/PUBLIC_SITE_PLAN.md`.

### Email go-live checks (engineering, after your approval of step 6)
1. Production variables set (names only in logs): `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`,
   `NOTIFY_CUSTOMER_EMAIL`, `CRON_SECRET`; redeploy.
2. Cron: 401 without the secret; 200 `{"configured":true}` with it.
3. Real send and inbox receipt: the Scenario A order (`docs/FINAL_LAUNCH_SEQUENCE.md` § 5) — alert in your inbox,
   **Store alert: accepted** on the order page; customer email if enabled (or `skipped`).
4. Error handling is proven on the isolated stack (outage, partial delivery, temporary/permanent 409, retry limits);
   it is not provoked on production.
5. Staff visibility: **Unsent notifications** on the overview, per-recipient status on the order page.

# Reference: the full question list

## 1. Identity and access 🔴

| # | Question | Why | Where it goes |
|---|---|---|---|
| 1.1 | Which person is the **owner** of the store (name + the email they will sign in with)? | No owner account exists (1 manager only). The owner approves policies and manages staff. | One-time bootstrap SQL run by you (`docs/STAFF_HANDBOOK.md` § Owner bootstrap) |
| 1.2 | Is the existing **manager** account intended (who is it)? | Only staff account today. | Keep / deactivate in `admin_memberships` |
| 1.3 | Staff list: name, email, role (`admin`, `manager`, `editor`, `fulfillment`) | Order handling, dispatch, COD collection need named people. | Supabase Auth invite + membership (handbook) |

## 2. Legal business identity and contact 🔴

| # | Question | Why | Where |
|---|---|---|---|
| 2.1 | Registered business / legal name (and registration details, if they should be shown) | Terms, privacy, invoices | Terms, Privacy, About |
| 2.2 | Support phone, WhatsApp number, support email, opening hours | Contact page, order confirmation, notifications | Contact page; `STORE_SUPPORT_*` settings |
| 2.3 | Public address / showroom (or "online only") | Contact, returns address | Contact, Returns |
| 2.4 | Who reads website inquiries and order alerts, and the expected response time | Order-inquiries page, notification recipient | `STORE_NOTIFY_EMAIL` (see § 5) |

## 3. Delivery and charges 🔴

| # | Question | Why | Where |
|---|---|---|---|
| 3.1 | Which **provinces / cities** do you deliver to with COD? (whole province or listed cities) | No zone = no order can be placed | Admin → Settings → Shipping zones |
| 3.2 | **Delivery fee** and **COD fee** (PKR) per zone; any free-delivery threshold? | Charged on every order (server-calculated) | Same (fees per zone; free-delivery rule is not built — say if needed) |
| 3.3 | Courier(s) used and delivery time per zone (for the zone note shown at checkout) | Customer expectation | Zone "notes" |
| 3.4 | What happens on failed delivery / refused parcel (re-attempts, return to store, charges)? | Shipping policy, staff procedure | Shipping policy, handbook |

## 4. Stock and order confirmation 🔴

All 232 variants are **untracked** (no stock counts). The system therefore must not promise stock.

| # | Question | Why | Suggested default |
|---|---|---|---|
| 4.1 | Approve the **availability-confirmation workflow**: every order arrives as *placed*; staff confirm availability (by phone) before *confirmed*; unavailable → *cancelled* with a call. | Prevents selling units you do not have | Approve as written; customer pages say "our team confirms availability with you before dispatch" |
| 4.2 | Or: do you want stock **tracked** for some items (quantities per variant)? | Tracked items reserve stock at order time | Not for launch unless you keep counts current |
| 4.3 | Are the 226 published prices current? Any items to unpublish? | Price shown = price charged | Admin → Products |

## 5. Notifications 🔴 (business alert) / 🟠 (customer email)

The store now has a working notification sender, but it needs an email account you own.

| # | Question | Why | What engineering needs |
|---|---|---|---|
| 5.1 | Email address that must receive **new-order alerts** | Staff must see orders quickly | `STORE_NOTIFY_EMAIL` (Vercel, Production) |
| 5.2 | Approve an email provider and create the account (recommended: **Resend**, free tier; sending domain verified with DNS records) | Sending requires a provider; engineering cannot create it for you | `RESEND_API_KEY`, sender address `STORE_FROM_EMAIL` on a domain you verify |
| 5.3 | Send customer confirmation emails when the customer gives an email? (Y/N) | Optional; phone is the main channel | `NOTIFY_CUSTOMER_EMAIL=1` |
| 5.4 | SMS / WhatsApp notifications? | Not built; needs a provider (e.g. WhatsApp Business API) and approved templates | 🟢 post-launch |

## 6. Policies and content 🔴 (shipping, returns, warranty, privacy, terms) / 🟠 (others)

Per-page fact checklists: `docs/OWNER_CONTENT_NEEDS.md`. Pages with "being finalised" sections need written copy;
policy pages also need legal approval in admin. Engineering will draft from your facts; you approve.

| # | Page | Facts needed (summary) |
|---|---|---|
| 6.1 | Shipping & delivery | 3.1–3.4 |
| 6.2 | Returns & refunds | window, conditions, who pays return delivery, refund method/time, exchanges |
| 6.3 | Warranty | length, coverage, exclusions, claim steps |
| 6.4 | Privacy | 2.1; data collected (name, phone, address, email), processors (Vercel hosting, Supabase database, email provider, couriers); retention; contact for requests. **Not** Shopify. |
| 6.5 | Terms | 2.1; order acceptance (4.1), COD rules, cancellations, liability, governing law (Pakistan) |
| 6.6 | Contact, About, Why Laptops HUB, Condition guide, Order inquiries | 2.x, company story, grading, response time |
| 6.7 | FAQ, How to choose, Comparison guide, guides | Already factual V5 templates; approve publishing as-is (checkbox in admin) |

## 7. Media rights 🔴

| # | Question | Why |
|---|---|---|
| 7.1 | Do you have the right to publish the **964 product photos** (hosted on `cdn.shopify.com`, all marked *pending*)? Source: your own photos / supplier / manufacturer? | Public display without rights is a legal risk |
| 7.2 | If not: who will supply replacement photos, for which products first? | Replacement workflow in `docs/MEDIA_INVENTORY.md` |
| 7.3 | The V5 hero/story cutout images: approved for use? | Currently not deployed |

## 8. Decisions on automatic retries 🟢

| # | Question | Default |
|---|---|---|
| 8.1 | Retries: recommended = GitHub Actions every 15 min (free, public repo) + Vercel daily + staff retry (`docs/NOTIFICATIONS.md`). Alternative: Vercel Pro (paid). | GitHub 15 min |

## 9. Launch approvals (one at a time) 🔴

Full order with checks: **`docs/FINAL_LAUNCH_SEQUENCE.md`**. In short:

Done: notification database change (2026-10-23) · `main` deployed to Production (2026-10-23).
Remaining approvals:

1. (optional) Mode B — hide the storefront until launch.
2. Deactivate the test manager (setup step 2).
3. Email + cron variables on Production (setup steps 6–7).
4. Scenario A: one cancellation-only test order of yours via a protected Preview (shared-database effects listed in
   the sequence § 5); fulfillment is tested separately on the isolated stack (Scenario B).
5. Go-live sign-off (sequence § 6) → enable COD → your confirmation = launched (sequence § 7).

---

# How-to guides (non-technical)

## A. Create the owner account (you do this yourself — engineering never grants itself owner)

1. Sign in to supabase.com with the account that owns project **Laptops Hub**.
2. Authentication → Users → **Invite user** → your email. Open the invitation email, set a password.
3. In Users, click your new user and copy its **User UID**.
4. SQL Editor → New query → paste, replace the UID, Run:
   ```sql
   insert into public.admin_memberships (user_id, role, is_active)
   values ('PASTE-YOUR-UID', 'owner', true)
   on conflict (user_id) do update set role = 'owner', is_active = true;
   ```
   Use **your own** UID only. Running this for someone else's UID would make them owner.
5. Check: `select u.email, m.role, m.is_active from public.admin_memberships m join auth.users u on u.id = m.user_id;`
   — you are `owner`; nobody else is `owner` or `admin` unless you intended it.
6. Go to `https://laptops-hub.vercel.app/admin/login`, sign in; the overview shows **role owner**.
7. Staff: same steps 2–4 with their email and the smallest role they need (`fulfillment` for packing/dispatch,
   `manager` for orders + settings, `editor` for content only). Tell engineering who the existing manager account is
   (question 1.2) so it can be kept or deactivated.

## B. Shipping zones (Admin → Settings → Add shipping zone)

For each delivery area you agreed with your courier:

1. **Name** customers see (e.g. the city or region name).
2. **Provinces** — tick the province(s). **Cities** — leave empty for the whole province, or list cities.
3. **Delivery fee** and **COD fee** in PKR (0 is allowed). The checkout adds them to the order total.
4. **Note** — courier and delivery time, exactly as you can promise them.
5. Tick **Active**, save. The readiness panel at the top shows how many zones are active.

An address outside every active zone cannot order ("We do not currently deliver COD to this city/province").
Edit or switch off a zone at any time with **Edit zone**; existing orders keep their charges.

## C. Email for order alerts (Resend)

1. Create an account at resend.com with the store's email (free plan is enough to start).
2. **Domains → Add domain** — use a domain you own (e.g. the store's domain). Resend shows DNS records (TXT/MX/
   CNAME). Add them where the domain's DNS is managed. Wait until the domain shows **Verified**.
   Without your own verified domain, emails can only go to your own Resend login address.
3. **API Keys → Create** — permission "Sending access", the verified domain. Copy the key once; do not email it.
4. Send engineering (in this chat, not by email): the sender address you want (e.g. `orders@<your domain>`), the inbox
   that should receive new-order alerts, and whether customers should get a confirmation email (5.3). Add the API key
   yourself in Vercel (step 5) — or ask engineering to, with your explicit approval.
5. Vercel → project **laptops-hub** → Settings → Environment Variables → add for **Production**:
   `RESEND_API_KEY` (the key, "Sensitive"), `STORE_FROM_EMAIL` (e.g. `Laptops HUB <orders@your-domain>`),
   `STORE_NOTIFY_EMAIL` (your alert inbox), `NOTIFY_CUSTOMER_EMAIL` = `1` only if 5.3 is yes, and
   `CRON_SECRET` (any long random text; add the same value in GitHub → repository → Settings → Secrets and
   variables → Actions → New repository secret `CRON_SECRET`, which turns on the 15-minute retry). The notification
   database change is already applied (2026-10-23).
6. Real delivery test: the controlled test order (§ 9.5). You should receive the alert within a minute; the order page
   in admin shows **Store alert: accepted**. "Accepted" means Resend took the message; if it is not in your inbox,
   check spam and Resend → Emails (it shows delivered / bounced).

## D. Policy facts that need your approval

Per page checklists: `docs/OWNER_CONTENT_NEEDS.md`. Skeleton drafts with blanks for your facts:
`docs/POLICY_DRAFTS.md` — **drafts, not approved, not published**. Nothing in them is a promise until you fill the
blanks, approve, publish and tick legal approval in Admin → Content. The facts the drafts depend on:

- Shipping: zones (B), courier, delivery times, damaged-parcel handling, failed-delivery handling (3.4).
- Returns: window and start, eligible reasons, condition, who pays return delivery, refund method and time, exchanges.
- Warranty: length, what is covered, exclusions, how to claim, who repairs.
- Privacy: legal name (2.1), contact for privacy requests, how long order records are kept.
- Terms: legal name, availability confirmation (4.1), cancellation rules, governing law/jurisdiction (your lawyer).

## E. Photos

`docs/MEDIA_INVENTORY.md`: state in writing the source and your rights for the 964 photos (own / supplier with
permission / manufacturer / unknown). Unknown → replace (workflow there) or set those products to draft.
