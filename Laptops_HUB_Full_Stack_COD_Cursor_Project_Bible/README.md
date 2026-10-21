# Laptops HUB — Independent COD E-Commerce Engineering Brief

## What this package is
A user-ready, full production-engineering prompt and independent source findings for pasting into **Cursor IDE Agent** inside the existing Laptops HUB project. It is NOT a finished codebase and does NOT mean the site is deployed.

## Read and send
1. Open `CURSOR_MASTER_PROJECT_BIBLE.md` — this is the **complete 8,000+ word world-class Cursor engineering master prompt and project bible**, incorporating design, catalog, business, real COD, backend, security, admin, operations, deployment and QA.
2. Put that `.md` file inside your current Cursor project, e.g. `docs/CURSOR_MASTER_PROJECT_BIBLE.md` and ensure Cursor can read it.
3. Paste the content of `START_HERE_CURSOR_KICKOFF.md` into **Cursor Agent** (or ask it to read the `.md` path). It explicitly tells Cursor to follow the entire bible, not only a short chat instruction.
4. Keep the original `Laptops Hub storefront.zip` available in the workspace in a `reference/`-style folder and make sure it is not copied unredacted into the public GitHub repository.
5. Review `VERIFIED_SOURCE_AND_LAUNCH_NOTES.md` for source and cloud access caveats.

## Critical reminders
- No Shopify integration required in this selected architecture.
- Only payment option: Cash on Delivery.
- Existing GitHub repo was public + empty when verified. Never upload original CSV costs/CRM notes or env secrets to it.
- Supabase/Vercel project IDs are known but their local CLI access and setup haven't been verified here.
- 232 catalog products = 226 published + 6 drafts, 964 media links.
- Keep original V5 visually faithful, but implement genuine admin/COD business functionality.
- Vercel preview deployment and public order-taking launch are different gates; merchant must approve business policies, shipping fees, image rights, etc.
