# Architecture decisions

## 2026-10-21

1. **Independent platform, not Shopify** — Owner-mandated Next.js + Supabase + Vercel COD store. Shopify CSV is import-only.
2. **Checkout gated OFF** — `COD_CHECKOUT_ENABLED=false` until shipping zones + owner policies exist. No fake successful orders.
3. **Integer paisa** — All money stored as `bigint` paisa; CSV major PKR × 100.
4. **Public git hygiene** — CSV, `lh-catalog.js`, secrets, prototype ZIP/HTML stay local/gitignored.
5. **Service-role COD RPC** — `create_cod_order` is SECURITY DEFINER; anon cannot INSERT orders via Data API.
6. **No production promote** — Preview only until release gates + explicit go-live.
