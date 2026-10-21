# Route inventory

Hash routing (`#/...`). Shopify target URL in the right column.

## Commerce (counts = public listings, catalog of 226)
| Route | Page | Shopify target |
|---|---|---|
| #/ | Homepage | / (index.json) |
| #/collections/all | All products (226) | /collections/all |
| #/collections/laptops | All laptops incl. gaming, MacBook, Chromebook (170) | smart: product_type in laptop types |
| #/collections/gaming-laptops · macbooks · chromebooks | Gaming (2) · MacBooks (2) · Chromebooks (1) | product_type / tag type:chromebook |
| #/collections/tablets | Tablets & smart devices (6) | product_type |
| #/collections/accessories · chargers | Accessories (50) · Chargers & adapters (31) | product_type / tag type:charger |
| #/collections/workstations · 2-in-1 · business | Workstations (8) · 2-in-1 (14) · Business lines incl. ZBook/Precision (107) | tags / title rule → product_line |
| #/collections/dell · hp · lenovo | Brand (76 · 58 · 50) | vendor |
| #/collections/apple · microsoft · asus · acer · toshiba | Brand (3 · 8 · 3 · 4 · 3) | vendor |
| #/collections/core-i3 · i5 · i7 · i9 | Processor (10 · 113 · 40 · 1) | custom.cpu_tier |
| #/collections/gen-6-7 · gen-8 · gen-10-plus | Generation (55 · 41 · 56) | custom.cpu_generation |
| #/collections/ram-4gb · 8gb · 16gb | Memory (32 · 77 · 37) | custom.ram_gb |
| #/collections/sto-128 · 256 · 512-plus | Storage (28 · 87 · 13) | custom.storage_gb |
| #/collections/screen-13 · 14 · 15 | Screen (14 · 27 · 5) | custom.screen_in |
| #/collections/touchscreen | Touchscreen (8) | custom.touchscreen |
| #/collections/under-40k · 40k-60k · over-60k | Laptop/tablet budget, accessories excluded (40 · 84 · 52) | price filter + type |
| #/collections/in-stock · available | Legacy links, now show All products (not linked anywhere) | redirect to /collections/all |
| #/search/{query} | Search results | /search?q= |
| #/products/{handle} | Product detail — 226 public handles; 6 draft handles return not-found | /products/{handle} |
| #/compare | Comparison | /pages/compare |
| #/cart | Cart page | /cart |

Counts verified by `QA Functional.html` (every collection's count and first-page cards re-derived from the catalog).

## Content
| Route | Page | Status |
|---|---|---|
| #/pages/about | About Laptops HUB | pending business content |
| #/pages/why-laptops-hub | Why choose Laptops HUB | partly factual, commitments pending |
| #/pages/contact | Contact (form) | form UI done; delivery + details pending |
| #/pages/faq | FAQ (3 groups, 11 Qs) | 6 answered from site facts, 5 pending |
| #/pages/shipping | Shipping & delivery | pending |
| #/pages/returns | Returns & refunds | pending |
| #/pages/warranty | Warranty | pending |
| #/pages/condition-guide | Condition guide | catalog facts shown; grading pending |
| #/pages/how-to-choose | How to choose a laptop | draft, editorial review |
| #/pages/comparison-guide | Using comparison | ready (describes the tool) |
| #/pages/order-inquiries | Order & availability inquiries | process described; SLA pending |
| #/pages/privacy | Privacy policy | storage table factual; legal text pending |
| #/pages/terms | Terms & conditions | pending |
| #/guides | Guides hub (blog listing) | draft |
| #/guides/{slug} | Article (4 slugs) | draft |

## System states
404 (any unknown route, unknown collection, unknown page/article, unknown product handle), empty cart, empty compare, no search results, no matching filters (with Clear filters), Chromebook empty state (shown only if the collection has 0 products), loading state, form error/success states, image error fallback (LHImg).

## Not published (no supporting data)
New arrivals (no dates), Best sellers (no sales data), Student / Professional / Everyday usage collections (no classification fields). Gaming and Workstation now come from Shopify Type/tags. Rules needed are in BUSINESS_CONTENT_REQUIREMENTS.md.
