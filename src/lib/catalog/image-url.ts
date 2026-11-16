/**
 * Responsive sizes for catalog photos on Shopify's image CDN, which resizes on request (`width=` query parameter;
 * aspect ratio kept). Cards display photos at ~300–400 CSS px, but the stored files are full-size (often ~700 KB):
 * asking the CDN for the displayed size cuts bytes without changing what the shopper sees. Any other host is left
 * untouched (no srcset), so local/approved files behave exactly as before.
 */
const SIZABLE = /^https:\/\/cdn\.shopify\.com\//i;

export function sizedImage(url: string, width: number): string {
  if (!SIZABLE.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(Math.round(width)));
    return u.toString();
  } catch {
    return url;
  }
}

/** `srcset` for a sizable URL, or undefined when the host cannot resize. */
export function imageSrcSet(url: string, widths: number[] = [400, 600, 800]): string | undefined {
  if (!SIZABLE.test(url)) return undefined;
  return widths.map((w) => `${sizedImage(url, w)} ${w}w`).join(", ");
}

/** Card photo `sizes`: one column on phones, two on tablets, up to four on desktop (V5 card grid). */
export const CARD_IMAGE_SIZES = "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 340px";
