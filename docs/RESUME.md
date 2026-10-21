# Resume here

State: **Preview access restored** on `feat/v5-storefront-admin` @ `9b24eae` (2026-10-21).

Draft PR (do not merge): https://github.com/mudasarimamofficial/laptops-hub/pull/1

## Working Preview (use this — not the Production alias)
- Unique: https://laptops-qi1nix9ah-mudasarimamofficial-gmailcoms-projects.vercel.app
- Branch alias: https://laptops-hub-git-f-129910-mudasarimamofficial-gmailcoms-projects.vercel.app
- Deployment: `dpl_1oui2NALZxJF6vXi2fpjZHurWJP8` · commit `9b24eae` · **Preview**
- Homepage: **HTTP 200** Next.js · V5 HTML confirmed
- See `docs/DEPLOYMENT_404_ROOT_CAUSE.md`

## 404 root cause (fixed for Preview)
- Project Framework was **Other** with Output Directory **`public`** → platform `NOT_FOUND` (no Next.js document).
- Fixed: Framework **Next.js**, Output Directory auto, `vercel.json`, Tailwind `postcss.config.mjs`.
- `https://laptops-hub.vercel.app/` is the **Production** alias — still may 404 until an approved Production promote. **Do not promote to clear the 404.**

## Smoke (Preview via `vercel curl`)
- `/` collections search compare cart checkout product admin/login → **200**
- `/admin` → **307** → `/admin/login`
- `POST /api/checkout/cod` → `checkout_disabled`
- CSS utilities + V5 tokens present in compiled CSS; build compiled successfully
- P0 security probes **9/9**

## Baseline still true
- Catalog **232 / 226 / 6 / 964**
- COD **off** · **no `--prod`** · atomic COD/status RPCs · DOMPurify CMS · role matrix

## Owner still required
- Sign in via Vercel SSO to open Preview in browser (team protection on `*.vercel.app`)
- Media rights, shipping fees, legal approval, staff bootstrap
- Explicit approval before Production promote / COD enable / merge
