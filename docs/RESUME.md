# Resume here

State (2026-10-22): **V5 reconstruction on `fix/v5-correctness-parity`, Preview deployed and verified.** Not merged, no PR, no Production promotion, COD off.

## Verified infrastructure
- GitHub `mudasarimamofficial/laptops-hub` · branch `fix/v5-correctness-parity` @ `44eeab5` (+ docs commit) · base `feat/v5-storefront-admin` @ `ea652f2`
- Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` (`laptops-hub`) · local `.vercel` link · Preview `dpl_6BhEe3QLnM9pDijLqTajWTABHDhq` (https://laptops-oen9ihlte-mudasarimamofficial-gmailcoms-projects.vercel.app, SSO)
- Supabase `xvmmjkrkgznnakcobmww` (CLI access; the Supabase MCP connector lacks permission) · 232 products / 226 active / 6 draft / 964 media / 0 orders
- **Production alias `laptops-hub.vercel.app` is public** and serves an older owner redeploy of `ea652f2` (COD 403). Owner decision pending.

## Local setup (the working tree has been wiped twice — restore before anything else)
1. `git status` — if tracked files show as deleted: `git restore .`
2. `vercel env pull .env.local --yes --environment=development`
3. For parity runs add `V5_CUTOUT_BASE="http://127.0.0.1:4173/assets/cut"` to `.env.local` (local only; never in Vercel until rights are approved).
4. `npm ci && npm run build && npx next start -p 3000 -H 127.0.0.1`
5. Reference: `npx http-server "Laptops Hub storefront" -p 4173 -a 127.0.0.1 -c-1`

## QA commands
- `npm run test:unit` · `npm run test:security:p0` · `npx playwright test tests/e2e`
- `npx tsx scripts/visual/verify-v5-data.mts` (data parity)
- `node scripts/visual/check-routes.mjs [--base=<preview> --share=<vercel share link>]`
- `node scripts/visual/capture.mjs --group=<name> [--only=…] [--vp=…] [--next=<url> --share=<link> --out=…]` then `node scripts/visual/report.mjs`
- Parity screenshots are gitignored on purpose (they contain locally served, unapproved cutouts).

## Next safe engineering actions
1. Port the V5 `isPage` templates (content pages, FAQ accordion, contact form → `/api/contact`, guides).
2. Move V5 `sub` taxonomy into `products.specs` with a reviewed migration; drop `v5-taxonomy.ts`.
3. Re-run `test:security:roles` and `test:cod:concurrency`; real-device pass.
4. Open a PR from `fix/v5-correctness-parity` when the owner wants review.

## Owner decisions
Media rights (catalog photos + cutouts) · shipping zones/fees · policies/legal · contact facts · staff bootstrap · availability/inquiry and description-cleanup proposals (`docs/proposals/`) · what to do with the public Production alias · COD go-live.
