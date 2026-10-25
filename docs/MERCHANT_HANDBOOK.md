# LAPTOPS HUB — ENTERPRISE MERCHANT OPERATING HANDBOOK

**For Store Owner and Authorized Staff**  
**Version:** Enterprise Release Candidate · October 2026  
**Admin Portal URL:** `https://laptops-hub.vercel.app/admin` (or local development `http://127.0.0.1:3001/admin`)  
**Store Mode:** Cash on Delivery (COD) Only · Pakistan (PKR)

---

## Table of Contents
1. [Introduction & Operational Mindset](#1-introduction--operational-mindset)
2. [Staff Access & Role Permissions](#2-staff-access--role-permissions)
3. [Product Catalog & Variant Management](#3-product-catalog--variant-management)
4. [Bulk Product Editing](#4-bulk-product-editing)
5. [Shopify CSV Import & Export](#5-shopify-csv-import--export)
6. [Product Media & Shopify CDN Images](#6-product-media--shopify-cdn-images)
7. [Collections & Automated Merchandising](#7-collections--automated-merchandising)
8. [Storefront Customization & Visual Editor](#8-storefront-customization--visual-editor)
9. [Store Navigation & Link Gating](#9-store-navigation--link-gating)
10. [CMS Pages & Legal Policy Publishing](#10-cms-pages--legal-policy-publishing)
11. [Shipping Zones & Delivery Charges](#11-shipping-zones--delivery-charges)
12. [Cash on Delivery (COD) Orders & Cash Collection](#12-cash-on-delivery-cod-orders--cash-collection)
13. [Customer Inquiries Desk](#13-customer-inquiries-desk)
14. [Store Settings & Emergency Controls](#14-store-settings--emergency-controls)

---

## 1. Introduction & Operational Mindset

Laptops HUB runs on a custom, high-performance Next.js and Supabase commerce architecture tailored specifically for laptop retail in Pakistan with Cash on Delivery. 

Key principles to remember:
- **Cash on Delivery Only:** The store does not use online card processing, wallets, or prepayment. All transactions are settled in cash upon parcel delivery.
- **Availability Confirmation First:** Stock in the catalog is untracked by default. When a customer places an order, it is treated as a confirmed request. Staff **must call the buyer** to confirm the unit's physical availability and condition before dispatch.
- **Delivered is NOT Paid:** An order marked "delivered" by a courier is not recorded as paid until staff physically receives the cash from the courier/rider and logs it via the **Record collection** desk.
- **Non-Technical Management:** You never need to edit code, CSV files, or database rows to run daily business. All products, prices, images, collections, website sections, shipping fees, policies, and orders are managed directly through the Admin interface.

---

## 2. Staff Access & Role Permissions

Staff sign in at `/admin/login` using their work email address. The system enforces strict role-based access control:

| Role | Permitted Actions | Restricted Actions |
|---|---|---|
| **Owner / Admin** | Complete access: products, variants, media, bulk editor, collections, CSV import/export, theme editor (draft, preview, publish, rollback), store settings, shipping zones, staff, orders, cash collections. | None |
| **Manager** | Products, variants, media, bulk editor, collections, CSV import/export, shipping zones, orders, cash collections, inquiries. | Theme publishing/rollback, store identity settings. |
| **Editor** | Products, variants, media, bulk editor, collections, CMS pages, theme draft editing & preview. | Theme publishing/rollback, orders, cash collections, shipping zones, store settings. |
| **Fulfillment** | Order status updates (confirmed, packing, shipped, out for delivery, delivered), order tracking numbers. | Catalog edits, pricing, theme editing, settings, cash collections. |

*Note:* If a staff member leaves the company, an Owner or Admin deactivates their account in Supabase. Deactivated accounts immediately receive a `403 Forbidden` error upon signing in.

---

## 3. Product Catalog & Variant Management

### 3.1 Browsing & Searching Products
Navigate to **Admin → Products**:
- Filter by status: **All**, **Active**, **Draft**, or **Archived**.
- Search by laptop model, brand (Dell, HP, Lenovo), processor, or URL handle.
- View price in PKR, inventory tracking mode, variant counts, and thumbnail media at a glance.

### 3.2 Adding a New Product
Click **Add product** (`/admin/products/new`):
1. **Title:** E.g., `Dell Latitude 7420 Core i5 11th Gen 16GB RAM 256GB Storage`.
2. **Handle:** Automatically generated from the title (e.g., `dell-latitude-7420-...`). Can be customized.
3. **Manufacturer & Type:** Brand (Dell, HP, Lenovo, Apple) and Type (Laptop, Chromebook, Accessory).
4. **Price (PKR):** Enter in Pakistani Rupees (e.g. `68000`). The system internally manages financial integers in paisa to avoid rounding errors.
5. **Inventory Mode:** 
   - Choose **Untracked** (default for used laptops) — requires phone confirmation before dispatch.
   - Choose **Tracked** — enter exact physical quantity on hand. The system prevents selling more than available stock.
6. **Status:** Keep as **Draft** while preparing photos and specs, then switch to **Active** when ready to show customers.

### 3.3 Product Variants & Options Matrix
On the Product Editor page (`/admin/products/[handle]`):
- Add up to 3 option dimensions (e.g., *RAM*, *Storage*, *Condition*).
- Generate combinations in the **Variant Matrix**.
- Set SKU, barcode, price, compare-at price, and individual inventory tracking per variant.
- Click **Save variants**. Changes are atomically recorded in the inventory ledger.

### 3.4 Duplicating, Archiving & Restoring
- **Duplicate:** Click **Duplicate** to create an exact copy with `-copy` handle. Perfect for creating listings of similar laptop configurations.
- **Archive:** Safely hides the product from the storefront without deleting historical order records.
- **Soft Delete:** Hides the product and marks it as deleted. The product can be restored anytime by clicking **Restore**. Historical customer orders reference immutable snapshots and are never damaged.

---

## 4. Bulk Product Editing

When updating prices or statuses for dozens of laptops simultaneously, use the **Bulk editor** (`/admin/products/bulk`):
1. Navigate to **Admin → Products → Bulk edit**.
2. Either review the loaded list or paste a list of handles (one per line).
3. Update **Status** (`active`, `draft`, `archived`), **Price PKR**, or toggle **Featured**.
4. Leave any cell blank if you do not want to change that field.
5. Click **Apply changes**. A summary reports how many products were updated.

---

## 5. Shopify CSV Import & Export

If you manage inventory in another authorized Shopify store, you can effortlessly exchange products with Laptops HUB.

### 5.1 Importing Shopify Products CSV
1. Navigate to **Admin → Products → Import** (`/admin/products/import`).
2. Upload your Shopify CSV export (supports both Modern and Legacy Shopify header formats).
3. The wizard analyzes the file, detects options, SKUs, prices, images, and grouped variant rows.
4. Review the **Staging Summary**:
   - Products found
   - Variants detected
   - Image URL references
5. Select a **Conflict Strategy**:
   - **Add only (safe):** Imports new products only; skips any handles already in Laptops HUB.
   - **Update existing:** Updates prices, tags, status, and variants for existing products without erasing unmentioned items.
6. Click **Preview (dry run)** first to verify row-by-row proposed changes.
7. Check the confirmation checkbox and click **Commit import**.
8. View real-time progress and previous import runs under **Import history**.

### 5.2 Exporting Shopify-Compatible CSV
Navigate to **Admin → Products → Export** (`/admin/products/export`):
- **Modern Shopify CSV:** Full export matching current Shopify product import specifications.
- **Legacy Shopify CSV:** Compatible with older stores and spreadsheet templates.
- **Laptops HUB Extended CSV:** Includes Pakistan-specific metadata, ledger fields, and local categories.
- **Inventory Sidecar:** Exports SKU, barcode, inventory mode, and current stock on hand.
- **Collection Sidecar:** Exports collection slugs and product assignments.

---

## 6. Product Media & Shopify CDN Images

Laptops HUB links directly to fast, reliable external CDN images (such as Shopify CDN URLs):
- In the product editor, add valid HTTPS image URLs.
- The system automatically blocks unsafe links, local network addresses, and non-HTTPS URLs.
- Drag or reorder media to set the front/primary image.
- **Approved 7 Homepage Presets:** The seven approved WebP images used in the Cinematic Hero and Product Story are stored independently and are never overwritten by product gallery updates.

---

## 7. Collections & Automated Merchandising

Navigate to **Admin → Collections** (`/admin/collections`):

### 7.1 Manual Collections
- Create a collection (e.g., `Featured Business Laptops`).
- Search and add individual products.
- Drag to reorder products for custom storefront merchandising.

### 7.2 Automated Collections (Smart Rules)
- Select **Automated collection**.
- Build visual rules with **AND / OR** logic:
  - Manufacturer equals `Dell`
  - Price less than `PKR 70,000`
  - Tag contains `gaming`
- The storefront automatically computes matching products in real-time. Archived or draft products are never shown to visitors.

---

## 8. Storefront Customization & Visual Editor

Navigate to **Admin → Online Store** (`/admin/online-store`):

### 8.1 Visual Sections & The 7 Approved Presets
The homepage features the frozen V5 cinema layout:
- **Cinematic Hero:**
  - Main Hero: Dell Latitude WebP preset
  - Supporting Left: HP ProBook WebP preset
  - Supporting Right: Lenovo ThinkPad WebP preset
- **Product Story:**
  - Front Angle WebP
  - Left Angle WebP
  - Right Angle WebP
  - Rear Angle WebP

### 8.2 Safe Draft, Preview, Publish & Rollback Workflow
1. **Edit Settings:** Change headlines, image URLs, or associated product handles.
2. **Save Draft:** Saves a private working draft. Public storefront visitors continue to see the currently published version.
3. **Open Preview:** Opens a live responsive preview in a new window to verify desktop and mobile layouts.
4. **Publish Theme:** Publishes the draft as an immutable snapshot. Visitors immediately see the new storefront.
5. **Rollback Theme:** If you ever wish to undo changes, click **Rollback** to revert to the previous snapshot instantly.

---

## 9. Store Navigation & Link Gating

Navigate to **Admin → Navigation** (`/admin/navigation`):
- Inspect the **Header Primary Menu** (`Dell`, `HP`, `Lenovo`, `Chromebooks`, `Accessories`, `Guides`, `Support`).
- Inspect the 5 **Footer Columns** (`Shop`, `By brand & spec`, `Help`, `Policies`, `Company`).
- **Automatic Customer Protection:** Links to policy pages (`/pages/shipping`, `/pages/returns`, etc.) or buying guides only appear publicly when that page is marked **Published** and **Legally Approved**. If a policy is still a draft, its link is automatically hidden from visitors to prevent 404 errors.

---

## 10. CMS Pages & Legal Policy Publishing

Navigate to **Admin → Content** (`/admin/content`):
Edit customer-facing pages:
- About Laptops HUB (`/pages/about`)
- Why Laptops HUB (`/pages/why-laptops-hub`)
- Contact Us (`/pages/contact`)
- FAQ (`/pages/faq`)
- Condition Guide (`/pages/condition-guide`)
- Order Inquiries (`/pages/order-inquiries`)
- Shipping & Delivery (`/pages/shipping`) — *Required for checkout*
- Returns & Refunds (`/pages/returns`) — *Required for checkout*
- Warranty Terms (`/pages/warranty`) — *Required for checkout*
- Privacy Policy (`/pages/privacy`) — *Required for checkout*
- Terms & Conditions (`/pages/terms`) — *Required for checkout*

*Important:* Customer-facing policy pages must never contain placeholder words like "BEING FINALISED" or "Coming soon". Write clear, professional terms, then click **Publish** and check **Legal Approval**.

---

## 11. Shipping Zones & Delivery Charges

Navigate to **Admin → Settings** (`/admin/settings`):
To accept orders in any city or province, an active shipping zone must exist:
1. **Zone Name:** E.g., `Bahawalpur Local Delivery` or `Punjab Major Cities`.
2. **Provinces & Cities:** Select province (e.g. `Punjab`) and specify cities (`Bahawalpur`, `Lahore`, `Multan`). Leaving cities blank applies the rule to the entire province.
3. **Delivery Fee (PKR):** Standard courier fee (e.g., `PKR 500` or `0` for free delivery).
4. **COD Fee (PKR):** Courier cash collection surcharge if applicable (e.g., `PKR 200` or `0`).
5. **Status:** Check **Active**. Customers entering addresses outside active zones are politely informed that delivery is not yet supported in their location.

---

## 12. Cash on Delivery (COD) Orders & Cash Collection

### 12.1 Order Lifecycle Workflow
When a customer completes checkout:
```
[Placed] (Unpaid COD Request)
   │
   ▼
Staff calls customer → Verify physical laptop unit & delivery address
   │
   ├──► If available & customer confirms ──► [Confirmed]
   │                                             │
   │                                             ▼
   │                                         [Packing]
   │                                             │
   │                                             ▼
   │                                         [Shipped] (Enter courier name & tracking #)
   │                                             │
   │                                             ▼
   │                                     [Out for Delivery]
   │                                             │
   │                                             ▼
   │                                         [Delivered]
   │
   └──► If unavailable / customer cancels ─► [Cancelled]
```

### 12.2 Recording Cash Collection
1. When the delivery rider or courier settles the cash with Laptops HUB, open the order in **Admin → Orders**.
2. Click **Record collection**.
3. Enter the cash amount received in PKR and a reference ID (courier payout voucher or rider name).
4. Once the full total is recorded, the payment status changes to **Paid — Cash Collected**.
5. The system prevents over-collection and blocks duplicate entry of the same payout reference.

---

## 13. Customer Inquiries Desk

Navigate to **Admin → Inquiries** (`/admin/inquiries`):
- Submissions from the **Homepage Requirement Form** ("Tell us what you're looking for") and the **Contact Page** arrive here instantly.
- Review customer name, phone number, email, budget range, and message.
- Update inquiry status: **New** → **In Progress** → **Closed**.
- Call or message the customer directly to assist them with their laptop purchase.

---

## 14. Store Settings & Emergency Controls

### 14.1 Business Information
Under **Admin → Settings**:
- Store Business Name: `Laptops HUB`
- Support Phone: E.g., `0309 3372974`, `0313 6565663`, or `0339 9100199`
- Support Email: E.g., `support@laptopshub.pk`
- Physical Address: `1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan`
- SEO Title Suffix: E.g., `| Laptops HUB Bahawalpur`

### 14.2 Emergency COD Kill Switch
If courier operations are suspended (e.g., national holiday, courier strike, or inventory audit), the owner can disable COD checkout instantly:
- In **Admin → Settings**, toggle `cod_checkout.enabled` to **Off**.
- The public checkout form immediately blocks submissions with a clear notice directing buyers to contact store staff instead.
