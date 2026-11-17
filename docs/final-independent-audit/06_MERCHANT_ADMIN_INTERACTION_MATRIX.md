# 06 — Merchant admin interaction matrix (production)

**Date:** 2026-11-17 (updated same day)  
**Session:** owner `laptopshubofficial@gmail.com` · role **owner**  
**SHA (live):** `585c8e9` · **Working branch:** `audit/final-independent-certification`

Status: **PASS** (control works + persists as claimed) · **PARTIAL** (loaded, deep save not re-tested) · **FAIL** · **BLOCKED** · **N/A**

| Page | Controls observed | Save/effect verified this pass? | Notes |
|---|---|---|---|
| Overview | Readiness gates, metric cards, quick actions, Ctrl K, Sign out | PASS (read) | 4 blocking COD gates truthful; email advisory |
| Orders | Search, fulfillment/payment filters, Apply, empty state | PASS (read) | 0 production orders; COD ≠ collected copy correct |
| Inventory | Filters All/Low/Out/Oversell, SKU find, history table | **FAIL → FIXED pending deploy** | Header said 2 tracked / list empty (soft-deleted QA variants). See DEF-016 |
| Products | Search, status filter, bulk select, Edit, Import/Export/Bulk, pagination | PARTIAL | 233 products; matches DB |
| Reviews | Waiting/Approved/Rejected tabs + link to store testimonials | PASS (read) | Empty queues; honesty copy correct |
| Reels | Full add form (rights, consent, status, order) | PASS (read) | Empty list; publish gated on rights |
| Online store | Desktop/tablet/mobile, Save draft, Publish, section inspector | PARTIAL | Kill-switch copy correct; no publish attempted |
| Settings | Identity, inventory defaults, labels, shipping zone | PARTIAL | Zone All Over PK; COD DB-disabled |
| Customers / Blog / Pages / Navigation / Media / Analytics / SEO / Staff / Activity / Help / Inquiries / Collections / Badges | Routes load 200 with owner session | PARTIAL | Deep save/persistence continues |

## Shopify UX comparison

LH nav groups Operations / Catalog / Customers / Online store / Insights / System already mirror Shopify job IA without Payments/Markets/Gift cards.

| Shopify pattern | LH status |
|---|---|
| Ctrl/⌘ K search | Shipped on production |
| `?` shortcuts sheet | **Implemented this session** (pending deploy) |
| G-then-letter navigation | **Implemented this session** (pending deploy) |
| Nested Products children | Present |
| Settings deep categories | Present as consolidated Settings page |

## Engineering this session (not yet on production)

1. `AdminShortcuts` — `?` help dialog + `G H/O/P/I/C/T/S` navigation  
2. Inventory + checkout-readiness counts exclude soft-deleted products  

## Remaining high-value work

1. Broader admin search (customers / inquiries) — optional  
2. Persistence re-tests: Staff invite, zone save, theme draft save on isolated stack  
3. Deploy + live re-verify DEF-016 / shortcuts  
