# Vercel 404 root cause — `laptops-hub.vercel.app`

**Date:** 2026-10-21  
**Project:** `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` (`laptops-hub`)

## Symptom
Browser and `curl` against `https://laptops-hub.vercel.app/` returned Vercel platform:

```
404 NOT_FOUND
X-Vercel-Error: NOT_FOUND
```

Build logs still showed Next.js routes and “READY”.

## Root cause (evidence)

1. **Framework preset was `Other`, Output Directory defaulted to `public`.**  
   `vercel project inspect` before fix:
   - Framework Preset: Other  
   - Output Directory: `public` if it exists, or `.`  

2. Authenticated `vercel curl` against unique deployment URLs also returned platform `NOT_FOUND` (79-byte body), proving this was **not** only SSO / alias confusion — the served artifact had no Next.js document root.

3. GitHub Vercel bot pointed “Preview” at `laptops-hub.vercel.app`, which is the **project Production alias**, not the unique Preview URL. That alias still targeted a Production deployment built under the broken framework settings.

4. Deployment Protection SSO (`all_except_custom_domains`) caused unauthenticated unique URLs to **302 → Vercel SSO**, which looked different from the Production alias 404 and complicated diagnosis.

## Repair (no production promote)

1. `vercel project update laptops-hub --framework nextjs --auto-detect output-directory --build-command "npm run build"`
2. Added `vercel.json` with `"framework": "nextjs"`.
3. Added Tailwind v4 `postcss.config.mjs` + `@tailwindcss/postcss`.
4. Redeployed Preview from commit `9b24eae` via GitHub → Vercel.

## Working Preview (use this)

| Field | Value |
|-------|--------|
| Unique URL | https://laptops-qi1nix9ah-mudasarimamofficial-gmailcoms-projects.vercel.app |
| Branch alias | https://laptops-hub-git-f-129910-mudasarimamofficial-gmailcoms-projects.vercel.app |
| Deployment ID | `dpl_1oui2NALZxJF6vXi2fpjZHurWJP8` |
| Commit | `9b24eae` |
| Environment | **Preview** |
| Homepage | HTTP **200** (`X-Powered-By: Next.js`) |

SSO: team members must sign in (or use `vercel curl` / protection bypass for automation). Custom domains remain exempt from SSO per project settings.

## Why `laptops-hub.vercel.app` can still 404

That hostname is aliased to the **latest Production** deployment. We did **not** run `vercel --prod` or promote Preview. Until a correctly built Next.js deployment is promoted (owner-approved go-live), the Production alias may continue to serve the old broken Production artifact.

**Do not promote merely to clear the 404.**
