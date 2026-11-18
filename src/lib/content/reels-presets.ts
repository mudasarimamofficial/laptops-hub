/**
 * Preset manifest for “Generation Laptops HUB” reels.
 * Source HTML is parsed into this shape — never pasted raw into React via dangerouslySetInnerHTML.
 * External hosts are technically allowed; presets seed as draft + rights pending until the merchant confirms.
 */

export type ReelPreset = {
  key: string;
  title: string;
  creatorName: string;
  tag: string;
  videoUrl: string | null;
  hlsUrl: string | null;
  posterUrl: string | null;
  avatarUrl: string | null;
  productOrCollectionPath: string | null;
  sortOrder: number;
  rightsStatus: "pending" | "owned" | "licensed";
  rightsNote: string;
  sourceAttribution: string;
  /** Filename mismatch / identity caution for merchants (not auto-consent). */
  identityNote?: string;
};

export const REELS_SECTION_HEADING = "Generation Laptops HUB";

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

/** Build unpublished draft rows from a parsed preset (idempotent by preset_key for callers). */
export function presetToDraftReel(p: ReelPreset) {
  const attribution =
    p.sourceAttribution ||
    "Reference media from Shopify HTML export. External URL ≠ ownership or endorsement. Confirm rights before publish.";
  return {
    title: p.title,
    caption: p.creatorName ? `${p.creatorName}${p.tag ? ` · ${p.tag}` : ""}` : p.tag,
    video_url: p.videoUrl || "",
    hls_url: p.hlsUrl || null,
    poster_url: p.posterUrl || null,
    avatar_url: p.avatarUrl || null,
    media_source: (p.hlsUrl ? "external_stream" : "external_file") as "external_file" | "external_stream",
    preset_key: p.key,
    link_path: p.productOrCollectionPath || null,
    source_attribution: [attribution, p.identityNote].filter(Boolean).join(" "),
    rights_status: "pending" as const,
    rights_note: p.rightsNote || "Preset draft — confirm rights before publish.",
    status: "draft" as const,
    sort_order: p.sortOrder,
    // Keep creator_name empty until consent is recorded (DB constraint).
    creator_name: "",
    creator_consent: false,
    tag: p.tag.replace(/^#/, ""),
  };
}
