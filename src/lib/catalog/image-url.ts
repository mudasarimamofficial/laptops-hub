/**
 * Responsive sizes for catalog photos.
 * Shopify CDN: `width=` query parameter (aspect kept).
 * Cards display ~300–400 CSS px; request DPR-aware widths without downloading full originals.
 * Other hosts (local, approved Supabase CMS media) are left untouched (no srcset), so behaviour stays safe
 * without relying on paid Supabase image transforms.
 */
const SHOPIFY = /^https:\/\/cdn\.shopify\.com\//i;
const SHOPIFY_FILES = /^https:\/\/[^/]+\.myshopify\.com\//i;

function isSizable(url: string): boolean {
  return SHOPIFY.test(url) || SHOPIFY_FILES.test(url);
}

export function sizedImage(url: string, width: number): string {
  if (!isSizable(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(Math.round(width)));
    return u.toString();
  } catch {
    return url;
  }
}

/** `srcset` for a sizable URL, or undefined when the host cannot resize. */
export function imageSrcSet(url: string, widths: number[] = [320, 480, 640, 800, 1200]): string | undefined {
  if (!isSizable(url)) return undefined;
  const unique = [...new Set(widths.map((w) => Math.round(w)).filter((w) => w > 0))].sort((a, b) => a - b);
  return unique.map((w) => `${sizedImage(url, w)} ${w}w`).join(", ");
}

/** Card photo `sizes`: one column on phones, two on tablets, up to four on desktop (V5 card grid). */
export const CARD_IMAGE_SIZES = "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 280px";

/** PDP main gallery — large but capped for DPR 2–3. */
export const PDP_MAIN_SIZES = "(max-width: 768px) 92vw, (max-width: 1200px) 48vw, 640px";

/** PDP / cart / compare thumbnails. */
export const THUMB_IMAGE_SIZES = "(max-width: 640px) 20vw, 96px";

/** Mega-menu / chrome feature tile. */
export const MEGA_FEAT_SIZES = "(max-width: 1024px) 40vw, 220px";
