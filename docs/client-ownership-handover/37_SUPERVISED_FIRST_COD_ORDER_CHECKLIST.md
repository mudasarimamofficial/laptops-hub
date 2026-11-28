# 37 — Supervised checklist: one genuine COD order, end to end (D4)

**Purpose:** prove live commerce with **one real order from a real customer** (or the owner buying something they
actually want delivered), delivered and paid in cash.

**What this checklist is not:**
- Engineering never submits a production order.
- Nothing here creates a fake order, a fake payment or a financial adjustment.
- An order that is not really wanted is **not** placed "to test".

**Roles:**
- **Owner:** runs every step and decides.
- **Staff member:** packs and dispatches.
- **Engineering (optional):** watches read-only logs with the owner's permission; changes nothing.

## A. Before the order (owner, one time)

- [ ] The delivery fee, COD fee, returns, cancellation and warranty wording on the site are what you want customers
      to see. Never publish wording you have not approved.
- [ ] **Settings → COD checkout** is on. The reason recorded today: owner mandate 2026-11-18.
- [ ] **Settings → Notifications:** "Send test" reaches the staff mailbox (not spam).
- [ ] The WhatsApp number in **Contact & social** is answered by a person (D6).
- [ ] Courier and cash handover are arranged outside the website.
- [ ] A fresh backup: **Settings → Backups → Create backup**.

## B. The order (customer side)

- [ ] The customer places the order on `www.laptopshub.pk` on their own phone: product → cart → checkout → COD.
- [ ] The delivery fee shown at checkout matches your published tariff for their city.
- [ ] The confirmation screen shows an order number. Write it down: `LH-________`.
- [ ] If customer email is on, the customer receives the confirmation (ask them).

## C. Notifications (owner)

- [ ] The staff alert email for this order arrives within a few minutes.
- [ ] **Orders** lists the order with the right items, variant, quantity, delivery fee and total.
- [ ] The stock of the ordered variant went down by the quantity ordered (**Inventory**).

## D. Fulfilment (staff, recorded in Admin)

- [ ] **Confirm** the order with the customer by phone or WhatsApp. Set the status to confirmed.
- [ ] Pack. Record the courier and tracking number on the order. Set the status to shipped.
- [ ] The customer can see the status at **Track order** using the order number and phone.

## E. Delivery and cash collection

- [ ] The courier delivers. The customer pays cash. Set the status to delivered.
- [ ] When the cash is **actually received** by the business: on the order, use **Record collection** with the exact
      amount received.
- [ ] If the amount is wrong, record a **correction**. Never edit or delete the original entry.

## F. Customer confirmation

- [ ] Ask the customer whether the product, the price paid and the delivery matched what the site promised. Note the
      answer.

## G. Sign-off

- [ ] **Activity** shows each step and who did it.
- [ ] Note what was slow or unclear.
- [ ] Owner signs off in writing: "Order LH-____ delivered and collected on ____". This closes **D4** in doc 23.

## If something goes wrong

| Problem | Do this |
|---|---|
| Customer cannot check out | Ask for a screenshot. Take the order by WhatsApp. Tell engineering the time and city. Do not turn COD off unless orders are really failing. |
| No staff alert email | Check spam. Check **Settings → Notifications** (send test). Check the Resend dashboard (package E in doc 34). The order still exists in **Orders**. |
| Wrong fee shown | Do not change fees in a hurry. Note the city and fee; compare with **Settings → Shipping & COD fees**. |
| Order cancelled | Set the status to cancelled and do not record a collection. If it had **not** shipped, stock goes back automatically (one stock-history entry). If it had shipped (delivery failed or returned), stock is **not** returned automatically: inspect the unit, then adjust stock in **Inventory** with a reason. |
