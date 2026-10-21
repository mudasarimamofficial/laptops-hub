# Verified source inspection & production caveats

This report was prepared for the Laptops HUB independent COD-only Next.js production implementation.

## Files actually inspected
- User-uploaded archive `/mnt/data/Laptops Hub storefront.zip` (the user's local Cursor workspace may use a different path).
- 356 ZIP entries; ~54.7 MB archive. Root includes the current final V5, old V2–V5 checkpoints, `Laptops_Hub_V5_Handoff/`, `assets/`, `data/`, `docs/`, `qa/`, `support.js`, `uploads/` and screenshots.
- Actual final reference is `Laptops Hub Storefront v5.dc.html`; duplicate in `Laptops_Hub_V5_Handoff/`. It loads `support.js`, `data/lh-catalog.js`, `data/lh-content.js`. Its UI is a custom component template (`<sc-if>`, `<sc-for>`, `{{}}`) and uses hash (`#/...`) routing. This is NOT Next.js, NOT a production backend.
- Design: `docs/DESIGN_SYSTEM.md`, routes: `docs/ROUTE_INVENTORY.md`, features: `docs/COMPONENT_INVENTORY.md`, behaviors: `docs/INTERACTION_MATRIX.md`, catalog: `docs/PRODUCT_DATA_MODEL.md`, incomplete owner content: `docs/OWNER_APPROVAL_CHECKLIST.md`, gates: `docs/RELEASE_GATE.md`, QA: `docs/FINAL_QA_REPORT.md`.
- Catalog CSV `data/source/products_export_final.csv`: 968 CSV rows, 232 product/title rows, 232 distinct handles, 226 active and published, 6 draft and not published; 964 `Image Src` populated rows; categories/type examples include 171 Laptops, 51 Accessories, 6 Smart Devices & Tablets, 2 Gaming Laptops, 2 Apple MacBooks. One real Chromebook HP Chromebook 14 G5 (4GB RAM, 32GB Storage, Rs 16,000). A separate Chromebook Type-C Charger is accessory, not Chromebook computer.
- In the CSV `Variant Inventory Tracker` is empty for ALL products. Price CSV data are major PKR units; don't misinterpret amount as paisa. Six drafts stay drafts; zero-price draft must never be purchasable. Cost prices and CRM content are present in raw export, making the file inappropriate for unrestricted public git.
- Source handoff says prototype shipping/checkout/forms are NOT live; prior suite results are prototype-level, do not validate a new independent system. Media rights remain unverified by the business owner. V5 source with local cart does not make COD orders real.

## GitHub connection actually checked
- Connected GitHub repository: `mudasarimamofficial/laptops-hub`, owner permissions: admin/push true, visibility: **public**, reported repository size 0 at inspection. Contents API returned `This repository is empty.` Repo state may have changed; Cursor must recheck locally.

## Credentials and cloud access not verified here
- User supplied Supabase project ref `xvmmjkrkgznnakcobmww` and URL `https://xvmmjkrkgznnakcobmww.supabase.co`, and Vercel project ID `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`.
- We did not inspect their Supabase database, Vercel project configuration, environment secrets, real domain, billing plan or local PowerShell authentication. Cursor must verify using the owner's local CLI sessions and avoid creating new projects accidentally.

## Decisions critical to production
1. This is a **custom independent e-commerce platform**. Previous `SHOPIFY_OS2_HANDOFF.md` is useful design mapping but not binding Shopify architecture. Do not import into Shopify or use Shopify checkout. The Shopify CSV is only a product source snapshot.
2. Cash on delivery (COD) is the sole payment method. Merchant receives actual cash later; order payment status starts UNPAID even though an order exists. No fake "paid".
3. A real order must be atomically inserted server-side, repriced server-side, idempotent and auditable. Forms and notifications must not falsely claim successful delivery.
4. The custom admin dashboard, serverless deployment, security, monitoring, backups, legal content and customer privacy are essential for a business-operable website.
5. Do not let the aesthetic V5 source/old tests masquerade as proof of production. Visual comparison, COD E2E, API security and live device tests are mandatory.
6. GitHub is public; do not commit raw CSV/cost data/customer PII/credentials. Review media licenses before publicly serving images. Seek approval before changing repo visibility or actual production settings.
7. Vercel preview may be deployed before public launch; public COD checkout is gated by merchant shipping rates/locations, policies, privacy, media rights and notifications/fulfillment readiness. Unsupported/missing facts must not be invented.

## Useful up-to-date official implementation references
- Supabase RLS and grants: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase DB functions: https://supabase.com/docs/guides/database/functions
- Next.js backend for frontend: https://nextjs.org/docs/app/guides/backend-for-frontend
- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- Vercel environments: https://vercel.com/docs/deployments/environments
