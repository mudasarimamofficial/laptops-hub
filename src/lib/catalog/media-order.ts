/**
 * Product media rules shared by the admin API and its tests (G13). Pure functions: no database access.
 */

export class MediaInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaInputError";
  }
}

/** Hosts whose image URLs are accepted without a file extension (CDN URLs often have none, or a query string). */
const KNOWN_IMAGE_HOSTS = ["cdn.shopify.com", "shopify.com", "googleapis.com", "res.cloudinary.com", "cloudinary.com", "images.unsplash.com", "supabase.co"];
const IMAGE_PATH = /\.(jpe?g|png|webp|avif|gif)$/i;
export const ALT_MAX = 300;

/**
 * Accepts a public HTTPS image URL a merchant pasted. Refuses non-HTTPS, credentials, local/private hosts and, for
 * unknown hosts, anything whose path is not an image file. Returns the normalised URL string.
 */
export function checkExternalImageUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new MediaInputError("That is not a web address. Paste the full image address, starting with https://.");
  }
  if (url.protocol !== "https:") throw new MediaInputError("Only secure (https://) image addresses are accepted.");
  if (url.username || url.password) throw new MediaInputError("Image addresses with a user name or password are not accepted.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.startsWith("[")
  ) {
    throw new MediaInputError("Use an image on a public website (not a private or numeric address).");
  }
  const known = KNOWN_IMAGE_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
  if (!known && !IMAGE_PATH.test(url.pathname)) {
    throw new MediaInputError("That address does not point to an image file (.jpg, .png, .webp, .avif or .gif).");
  }
  if (url.toString().length > 2000) throw new MediaInputError("That image address is too long.");
  return url.toString();
}

/** Trimmed alt text with collapsed whitespace, at most ALT_MAX characters. */
export function cleanAlt(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, ALT_MAX) : "";
}

/**
 * The new order must contain exactly the product's current images, each once, so a stale page cannot drop or
 * resurrect one. Returns a reason or null.
 */
export function orderProblem(currentIds: string[], orderedIds: string[]): string | null {
  const now = new Set(currentIds);
  if (new Set(orderedIds).size !== orderedIds.length) return "An image appears twice in the new order.";
  if (orderedIds.length !== now.size || orderedIds.some((id) => !now.has(id))) {
    return "The images changed in another window. Reload the page and try again.";
  }
  return null;
}

/** The order with one image moved to the front (it becomes the primary image), others keeping their order. */
export function moveToFront(orderedIds: string[], id: string): string[] {
  return orderedIds.includes(id) ? [id, ...orderedIds.filter((x) => x !== id)] : orderedIds.slice();
}

/** Positions are written in two passes so the unique (product_id, position) index never sees two rows at once. */
export const STAGING_POSITION_BASE = 1_000_000;

/** Merchant-facing rights states for an image (`product_media.approval`). */
export const RIGHTS_LABELS: Record<string, string> = {
  pending: "Rights not confirmed",
  approved: "Rights confirmed",
  rejected: "Do not use",
};

/**
 * Alt text that came from the Shopify import rather than from a person: "LATITUDE 5320 … DELL view 6", "… front view"
 * or "SKU-00209 product image". On 2026-11-26 every one of production's 964 images matched one of these. The
 * storefront's own description ("Dell Latitude 5320, Core i5 …, photo 2 of 5") is clearer, so it is kept until the
 * merchant writes a real description.
 */
export function isImportedAlt(alt: string): boolean {
  const a = alt.trim();
  return /\bview(\s+\d+)?\s*$/i.test(a) || /^SKU-\d+ product image$/i.test(a);
}
