# Resume here

State: **Phases 0–2 + preview deploy** (2026-10-21). Foundation live on verified cloud IDs. **Not production-ready** (COD gated; V5 cinematic parity incomplete; owner gates open).

## Verified cloud
- GitHub: `mudasarimamofficial/laptops-hub` · commits `bb17fec` → `971fda2` on `main`
- Supabase: `xvmmjkrkgznnakcobmww` — migration applied; DB counts **232 / 226 / 6 / 964**
- Vercel: `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` · preview READY  
  `https://laptops-drtmlkjt9-mudasarimamofficial-gmailcoms-projects.vercel.app`  
  (Deployment Protection may require dashboard / `vercel curl`)

## Done
- Forensic audit: `docs/00_FORENSIC_AUDIT.md`
- Next.js 16 App Router + V5 tokens + storefront routes
- Atomic `create_cod_order` RPC + RLS (checkout env-gated OFF)
- Admin shell (login, overview, orders, products, settings, inquiries)
- Unit tests: money + PK phone

## Not done / gated
- Pixel-faithful cinematic hero + pinned scroll story (media from `reference/`)
- Full compare tray, predictive search overlay, CMS content pages
- Owner shipping zones → enable COD
- Staff bootstrap (`admin_memberships` insert)
- Media rights, policies, production launch
- Visual Playwright suite vs V5 reference

## Commands
```bash
npm run dev
npm run test:unit
npm run import:catalog
vercel          # preview only — confirm project ID first
```

## Do not
- Invent policies/fees
- Enable public COD until owner gates clear
- Commit CSV / `.env` / `lh-catalog.js`
