/**
 * Preset manifest for “Generation Laptops HUB” reels.
 * Source HTML (Shopify/third-party) is parsed into this shape — never pasted raw into React.
 * ronin.pk hosts remain blocked for publish/playback; presets stay draft until rights + owned media.
 */

export type ReelPreset = {
  key: string;
  title: string;
  creatorName: string;
  tag: string;
  videoUrl: string | null;
  posterUrl: string | null;
  avatarUrl: string | null;
  productOrCollectionPath: string | null;
  sortOrder: number;
  rightsStatus: "pending" | "owned" | "licensed";
  rightsNote: string;
  /** When true, media URLs must not be published until cleared. */
  mediaBlocked: boolean;
};

export const REELS_SECTION_HEADING = "Generation Laptops HUB";

/**
 * Placeholder keys for the six HTML-derived presets.
 * Populated when the owner pastes the source HTML; until then titles are reserved as unpublished drafts.
 */
export const REELS_PRESET_KEYS = [
  "junaid-akram",
  "hemayal",
  "taimoor-salahuddin",
  "laptops-hub-community",
  "laptops-hub-gamer",
  "laptops-hub-creator",
] as const;

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/");
}

export function isBlockedReelHost(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "ronin.pk" || host.endsWith(".ronin.pk");
  } catch {
    return false;
  }
}

/** Build unpublished draft rows from a parsed preset list (idempotent by title+sort_order for callers). */
export function presetToDraftReel(p: ReelPreset) {
  const blocked = p.mediaBlocked || isBlockedReelHost(p.videoUrl) || isBlockedReelHost(p.posterUrl);
  return {
    title: p.title,
    caption: p.creatorName ? `${p.creatorName}${p.tag ? ` · ${p.tag}` : ""}` : p.tag,
    video_url: blocked ? "" : p.videoUrl || "",
    poster_url: blocked ? null : p.posterUrl,
    rights_status: "pending" as const,
    rights_note: blocked
      ? `${p.rightsNote || "Third-party media"}. Blocked host or uncleared rights — replace with Laptops HUB owned/licensed media before publish.`
      : p.rightsNote || "Preset draft — confirm rights before publish.",
    status: "draft" as const,
    sort_order: p.sortOrder,
    creator_name: p.creatorName,
    creator_consent: false,
    tag: p.tag,
  };
}
