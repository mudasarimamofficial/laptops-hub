# Laptops HUB

Independent Pakistan COD-only e-commerce storefront (Next.js + Supabase + Vercel).

**Design authority:** Claude Design V5 (frozen tokens) in local `reference/v5/` (gitignored).  
**Commerce:** Cash on Delivery only — no payment gateways.  
**Cloud:** GitHub `mudasarimamofficial/laptops-hub` · Supabase `xvmmjkrkgznnakcobmww` · Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2`.

## Quick start

```bash
cp .env.example .env.local   # fill keys from Supabase / Vercel
npm install
npx supabase db push --linked   # requires Docker OR use Dashboard SQL
npm run import:catalog:dry
npm run import:catalog
npm run test:unit
npm run dev
```

## Safety

- Never commit `.env*`, CSV cost/CRM exports, or `reference/`.
- `COD_CHECKOUT_ENABLED` defaults to `false` until shipping zones + owner policies are set.
- Public repo: sanitize all seeds.

## Docs

- `docs/00_FORENSIC_AUDIT.md`
- `docs/PROGRESS.md` / `docs/RESUME.md`
- Project bible under `Laptops_HUB_Full_Stack_COD_Cursor_Project_Bible/`
