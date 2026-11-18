# PR #14 production release record

**Released:** 2026-11-18 (owner-authorized merge)  
**Scope:** DEF-016 inventory soft-delete counts · DEF-017 admin keyboard shortcuts  
**Not in scope:** COD enablement, shipping fees, theme/reviews publish, content edits, migrations

## Identifiers

| Item | Value |
|---|---|
| PR | [#14](https://github.com/mudasarimamofficial/laptops-hub/pull/14) MERGED |
| PR head (pre-merge gate) | `70a212277e32ce45ee83020408da026f73feb4ba` |
| Production merge commit | `d60f180988f1b08d9d22a15e8ac41b0607c27b6f` |
| Production deployment | `dpl_F4La1bjFa5WDXgfjYZ5cZ5TiXi3P` READY · target `production` · region `sin1` |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk`, … |
| Rollback reference | Previous production `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` @ `585c8e96a3b3b6dfb9fa97e9e1c72a55c90902a4` |

## Post-deploy verification (read-only)

| Check | Result | Evidence |
|---|---|---|
| Production deploy READY | PASS | Vercel MCP `readyState=READY`, aliases include `www.laptopshub.pk` |
| Inventory desk | PASS | Admin `/admin/inventory`: `0 track · 0 low · 0 out · 232 untracked`; empty `No variant tracks stock yet.` |
| SQL baseline | PASS | `tracked_live=0`, `tracked_on_deleted=2`, `untracked_live=232`, `purchasable_variants=226` |
| Checkout readiness | PASS | Overview: `226 purchasable variant(s), all untracked` |
| Shortcuts + focus | PASS | `?` opens sheet (owner G-nav includes Settings); Esc closes; Close receives focus |
| Role-aware nav | PASS | OWNER sidebar: Settings / Staff / Activity log / Help |
| Storefront home | PASS | `GET /` → 200 |
| Collection / PDP / cart | PASS | `/collections/dell` 200; PDP Latitude 7420 200 + price/CTA; `/cart` 200 |
| COD remains disabled | PASS | `POST /api/checkout/cod` → **403** `checkout_disabled` |
| Migrations | PASS | Linked ledger still **29/29** matched; none applied this release |
| Hostinger CRM | PASS | `https://app.laptopshub.pk/` → 200; DNS `45.130.228.253` |

## Explicit non-actions

- COD flags / store setting not changed  
- Shipping fees not changed  
- Themes / reviews / badges not published  
- Production catalog/content not modified  
- No Supabase DDL/DML this release  

## Next engineering branch

`feat/client-delivery-phase-next` (from `origin/main` @ `d60f180`) for client delivery: genuine reviews, licensed reels, blog, merchandising badges, storefront label cleanup, Shopify-quality admin UX, COD operational readiness — without duplicating shipped features.
