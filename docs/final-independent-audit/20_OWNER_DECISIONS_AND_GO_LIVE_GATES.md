# 20 — Owner decisions and go-live gates

**Date:** 2026-11-17  
**Source of truth for blockers:** live Admin Overview COD readiness + Vercel env names + Supabase settings

## Blocking gates (ordering closed — 4 blocking)

1. **`NEXT_PUBLIC_COD_CHECKOUT_ENABLED`** — off in production build (redeploy required to change)
2. **`COD_CHECKOUT_ENABLED`** — API returns 403
3. **`store_settings.cod_checkout`** — `enabled: false` (“Owner shipping/policies pending”)
4. **Mandatory policies** — shipping, returns, warranty, privacy, terms not public / not legally approved

## Advisory / ops

5. **Email transport** — Resend + `STORE_FROM_EMAIL` / `STORE_NOTIFY_EMAIL` / `CRON_SECRET` / optional `NOTIFY_CUSTOMER_EMAIL` unset
6. **Shipping fee confirmation** — 1 zone “All Over PK” exists; fees not confirmed as owner-approved courier tariffs
7. **Media rights** — 964 remote refs pending review
8. **Leaked-password protection** — Supabase Auth toggle (owner dashboard)
9. **GitHub `main` branch protection** — currently unset
10. **Theme publish** — `THEME_PUBLISHED_ENABLED` unset (intentional until owner chooses)
11. **Reels / testimonials content** — owner media + genuine reviews + consent

## Explicitly not to invent

- Policy text, warranty, delivery times, fees, reviews, ratings, video rights, company address beyond verified map listing attribution

## Controlled real order

Only after gates 1–4 clear + operational responsibility confirmed. Prefer labeled test recipient and cancel/close per runbook. Until then: **isolated COD verified separately / production real-order BLOCKED**.
