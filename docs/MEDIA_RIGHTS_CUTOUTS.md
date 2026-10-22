# Media rights — Dell Latitude cutouts

**Status: NOT CLEARED for public distribution**

Four cutout PNGs previously lived under `public/approved-assets/cut/`. The folder name does **not** constitute commercial licensing approval.

## Action taken (2026-10-21)
- Removed cutouts from the public Next.js `public/` tree so preview builds do not serve them.
- Homepage hero / product story now use **catalog CDN product images** for the featured Dell Latitude (or a placeholder).
- `private/` is gitignored for any local quarantine copies.
- Git history on the public GitHub repo may still contain the earlier commit that added the files; treat that as a known residual risk until history rewrite is owner-approved (do not force-push without explicit request).

## Owner required
- [ ] Confirm rights to publish each cutout (or discard permanently)
- [ ] If cleared, re-add under an explicitly licensed path and document license source
- [ ] Confirm rights for all 964 catalog media URLs

## Update 2026-10-22
- Hero and story now load cutouts only from `V5_CUTOUT_BASE` (`src/lib/catalog/v5-media.ts`). It is **unset** in Vercel, so Preview/Production show the catalog photos (multiply-blended, as V5 does for product photos). No cutout file is committed or deployed.
- Local parity runs point `V5_CUTOUT_BASE` at the reference export's `assets/cut` to measure the approved design.
- `assets/scene/stage.png` is marked "generated in project" in the V5 media manifest (not a product photo) and is published as `public/v5/stage.webp`.
- To enable after approval: host the approved PNGs (e.g. a public Supabase Storage bucket or `public/approved-assets/cut/` once licensing is recorded), set `V5_CUTOUT_BASE` to that folder URL for Preview and Production, redeploy.
