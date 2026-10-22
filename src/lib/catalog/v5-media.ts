/**
 * V5 hero/story cutouts (`assets/cut/*.png`) are background-removed catalog photos whose publication rights
 * are pending owner approval (docs/MEDIA_RIGHTS_CUTOUTS.md). They are not committed or deployed. When an
 * approved copy is hosted, set V5_CUTOUT_BASE to its folder URL; until then the catalog photo is used.
 */
const BASE = (process.env.V5_CUTOUT_BASE || "").replace(/\/+$/, "") || null;

export function cutoutUrl(file: string): string | null {
  return BASE ? `${BASE}/${file}` : null;
}
