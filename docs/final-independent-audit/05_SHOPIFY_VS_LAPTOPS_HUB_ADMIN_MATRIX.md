# 05 — Shopify vs Laptops HUB admin matrix

**Date:** 2026-11-17  
**Shopify surface:** `admin.shopify.com/store/laptopshub-2` (authenticated)  
**LH surface:** `www.laptopshub.pk/admin` (owner session `laptopshubofficial@gmail.com`)  
**Production code:** `585c8e9`

Classifications: **Required parity** · **Strong UX parity** · **Optional** · **Shopify-only / N/A** · **Owner decision** · **External integration**

| Shopify feature / workflow | Shopify location | LH equivalent | Exists? | Functionality | UX quality | Diff / impact | Recommendation | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|---|
| Home / readiness | Home | Overview + COD readiness panel | Yes | Live gates (4 blocking) | Strong — truthful blockers | Shopify uses marketing cards; LH uses commerce gates | Keep LH model | — | — |
| Global search | Ctrl K | Ctrl/⌘ K admin search | Yes | Products/orders/sections | Good | Shopify broader (customers, settings) | Extend search targets if gaps found | P2 | M |
| Keyboard shortcuts | `?` map | Partial (search documented) | Partial | Search yes; full G/A map no | Weaker | Power users slower | Add help sheet of G-/A- style shortcuts | P2 | S |
| Orders list | Orders | `/admin/orders` | Yes | Present | TBD deep test | COD states differ from paid | Verify filters/timeline | P1 | — |
| Draft orders | Orders → Drafts | None | No | — | — | Draft invoices less critical for COD guest | Optional later | Optional | L |
| Abandoned checkouts | Orders | N/A (COD gated) | N/A | — | — | Different model | Shopify-only | N/A | — |
| Products list | Products | `/admin/products` | Yes | 233/226/6/1 shown on Overview | Strong IA | Counts match DB | Deep control test | P1 | — |
| Collections | Products → Collections | `/admin/collections` | Yes | Present | TBD | — | Verify rules | P1 | — |
| Inventory | Products → Inventory | `/admin/inventory` | Yes | Present | TBD | Tracked=2 variants | Verify ledger | P1 | — |
| Purchase orders / Transfers | Products children | None | No | — | — | Wholesale ops | Shopify-only for now | N/A | — |
| Gift cards | Products | None | No | — | — | Not COD catalog | Shopify-only | N/A | — |
| Customers | Customers | `/admin/customers` | Yes | Present | TBD | Privacy-critical | Verify PII + export limits | P1 | — |
| Segments / Companies | Customers | None | No | — | — | B2B/marketing | Optional | Optional | L |
| Discounts | Discounts | None dedicated | No | — | — | No promo engine yet | Owner decision before build | Owner decision | L |
| Content / Files / Menus / Blog | Content | Pages, Blog, Navigation, Media | Yes | Present | Good IA split | Metaobjects N/A | Keep LH modules | — | — |
| Markets | Markets | N/A | N/A | — | — | Single PK market | Shopify-only | N/A | — |
| Analytics / Reports | Analytics | `/admin/analytics` | Yes | Present | TBD accuracy | Must not invent revenue | Verify COD collected vs placed | P1 | — |
| Online Store / Themes | Online Store | Customize `/admin/online-store` | Yes | Draft/preview/publish code exists | Strong for COD stack | Theme publish kill-switch unset | Keep gated publish | P1 | — |
| Payments setup | Settings / Home cards | COD only | N/A by design | Correctly absent | — | Never add cards without owner change | Shopify-only | N/A | — |
| Shipping rates | Settings / Home | Settings shipping zones | Yes | 1 zone All Over PK | Needs fee approval | Fees not owner-approved tariffs | Owner sets fees | Owner decision | — |
| Staff / roles | Settings | `/admin/staff` | Yes | Owner visible | TBD invite flow | — | Verify invite | P1 | — |
| Notifications | Settings | Env + outbox | Partial | Code ready; Resend unset | Ops gap | Email advisory on Overview | Owner configures Resend | Owner decision | S |
| Reels | — | `/admin/reels` | Yes | Empty catalog | Correct hide | Owner media needed | Content | Owner decision | — |
| Reviews / testimonials | — | Reviews + testimonials | Yes | Empty public | Correct hide | Owner content | Content | Owner decision | — |
| Sign out | Profile | Sidebar Sign out | Yes | Visible | Good | — | Verify POST works | P2 | S |

## Summary

- **IA parity:** Strong — LH Operations / Catalog / Customers / Online store / Insights / System mirrors Shopify job groups without cloning payment/market/gift-card modules.
- **Highest remaining UX gaps:** exhaustive keyboard shortcut map; broader global search; optional discounts (owner decision).
- **Highest operational gaps:** COD gates + policies + email (owner), not missing menu items.
- **Do not** add Shopify Payments, Markets, Gift cards, or Abandoned-checkout paid recovery.
