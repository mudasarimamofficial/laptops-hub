# 05 — Shopify vs Laptops HUB admin matrix

**Date:** 2026-11-17 (reconciled)  
**Shopify surface:** `admin.shopify.com/store/laptopshub-2` (authenticated; original URL redirected here — intended test store)  
**LH surface:** `www.laptopshub.pk/admin` (owner session) · PR #14 Preview for DEF-016/017  
**Production code:** `585c8e9` · **PR head:** see `19_FINAL_CERTIFICATION.md`

Classifications: **Required parity** · **Strong UX parity** · **Optional** · **Shopify-only / N/A** · **Owner decision** · **External integration**

| Shopify feature / workflow | Shopify location | LH equivalent | Exists? | Functionality | UX quality | Diff / impact | Recommendation | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|---|
| Home / readiness | Home | Overview + COD readiness panel | Yes | Live gates (4 blocking) | Strong — truthful blockers | Shopify uses marketing cards; LH uses commerce gates | Keep LH model | — | — |
| Global search | Ctrl K | Ctrl/⌘ K admin search | Yes | Products/orders/sections | Good | Shopify broader (customers, settings) | Extend search targets if gaps found | P2 | M |
| Keyboard shortcuts | `?` map + G chords | `?` sheet + G→letter (role-filtered) | Yes (PR #14) | Help + Go-to; ignores typing/modals; `/` ≠ Shift+/ | Strong parity for COD admin | A-chords / every Settings subpage not cloned | Keep; do not add unavailable role targets | P2 | S |
| Orders list | Orders | `/admin/orders` | Yes | Present | TBD deep test | COD states differ from paid | Verify filters/timeline | P1 | — |
| Draft orders | Orders → Drafts | None | No | — | — | Draft invoices less critical for COD guest | Optional later | Optional | L |
| Abandoned checkouts | Orders | N/A (COD gated) | N/A | — | — | Different model | Shopify-only | N/A | — |
| Products list | Products | `/admin/products` | Yes | 233/226/6/1 shown on Overview | Strong IA | Counts match DB | Deep control test | P1 | — |
| Collections | Products → Collections | `/admin/collections` | Yes | Present | TBD | — | Verify rules | P1 | — |
| Inventory | Products → Inventory | `/admin/inventory` | Yes | Live desk + ledger | Prod bug: 2 tracked = soft-deleted QA | DEF-016 excludes deleted; expect 0 tracked / 232 untracked live | Deploy PR #14 then re-verify | P0 | S |
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

## Evidence depth (honest)

| Area | Shopify observation depth | LH comparison depth |
|---|---|---|
| Home / Products / Inventory / Orders / Customers nav | Authenticated page load + IA notes | Production smoke + DB counts |
| Settings / Shipping / Staff / Notifications / Privacy / Policies | Settings→General loaded; sidebar lists Payments/Checkout/Shipping/Notifications/Privacy/Policies (read-only) | LH consolidated Settings PARTIAL — do not clone Shopify Payments |
| Discounts / Markets / Gift cards / Draft orders | Confirmed Shopify-only — **out of COD scope** | Intentionally absent |
| Checkout / Online Store deep editors | Read-only; no Shopify write tests without approval | Theme draft PARTIAL; publish gated |
| Analytics accuracy | Not re-certified against Shopify reports | Must not invent revenue |

Page load ≠ PASS for merchant efficiency. Remaining work is persistence / validation / error-recovery certification on LH, not cloning Shopify catalog.

## Summary

- **IA parity:** Strong — LH mirrors Shopify job groups without Payments/Markets/Gift cards.
- **Shipped in PR #14:** `?` + G-chord shortcuts (role-aware); inventory soft-delete count fix.
- **Highest remaining UX gaps:** broader search targets; Settings deep persistence; optional discounts (owner decision).
- **Highest operational gaps:** COD gates + policies + email (owner).
- **Do not** add Shopify Payments, Markets, Gift cards, or Abandoned-checkout paid recovery.
