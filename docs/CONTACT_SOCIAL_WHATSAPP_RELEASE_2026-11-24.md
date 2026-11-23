# Contact, Social & WhatsApp — release evidence (2026-11-24)

## Feature delivery

| Feature | Status |
|---|---|
| Premium footer + social icons | PASS — exact Facebook/Instagram/TikTok/YouTube HTTPS URLs |
| Visit & contact (address, 3 phones, email, WhatsApp) | PASS — defaults from merchant mandate |
| Floating WhatsApp widget | PASS — `https://api.whatsapp.com/message/NT5WBBX234POA1`; hides when cart open |
| PDP “Order on WhatsApp” below primary CTA | PASS — dynamic name/variant/qty/campaign price; copy/open fallback without recipient digits |
| Admin Contact & Social (`store_settings.contact_social`) | PASS — settings page + validated PUT API + identity sync |
| Hero cutout `boxShadow` removal | PASS — transparent laptop media no longer boxed |

## Verification

- Unit: `tests/unit/contact-social.test.ts` (wired into `npm run test:unit`)
- Playwright isolated: `tests/e2e-isolated/contact-social-whatsapp.spec.ts` — **4/4 passed** against `http://127.0.0.1:3001`
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS
- Visual: `docs/visual-evidence/contact-social-2026-11-24/`

## Known limitation

- Verified WhatsApp recipient digits are empty by default (do not invent). PDP uses copy/open fallback until the merchant sets international digits in Admin → Settings → Contact & Social.
- WhatsApp inquiry does **not** create orders or deduct inventory.

## Defaults (public)

- Address: Laptops HUB, 1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan
- Email: `infolaptopshub@gmail.com`
- Phones: `0309 3372974`, `0313 6565663`, `0339 9100199`
- Social: Facebook `LaptopshubII.pk`, Instagram `laptopshub.pk`, TikTok `@laptopshub.pk`, YouTube `@Laptopshub`
- WhatsApp short link: `https://api.whatsapp.com/message/NT5WBBX234POA1`
