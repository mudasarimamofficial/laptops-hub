import { z } from "zod";

/**
 * "Generation Laptops HUB" reels.
 * External HTTPS media hosts are allowed. Publish still requires cleared rights (owned/licensed).
 * A public URL is not a license — attribution and consent stay separate from technical URL validation.
 */
export const REEL_VIDEO_EXT = /\.(mp4|webm|mov)$/i;
export const REEL_HLS_EXT = /\.m3u8$/i;
export const REEL_POSTER_EXT = /\.(jpe?g|png|webp|avif)$/i;

export type ReelMediaSource = "uploaded" | "external_file" | "external_stream";
export type ReelUrlKind = "video" | "poster" | "hls" | "avatar";
export type ReelUrlProblem = "invalid" | "scheme" | "private_host" | "extension";

/** Reject clearly non-public / loopback-adjacent hosts that should not be used as production media origins. */
export function isDisallowedPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return false; // allowed for isolated tests
  if (h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(h)) return true; // CGNAT
  return false;
}

function pathLooksLike(kind: ReelUrlKind, pathname: string): boolean {
  if (kind === "video") {
    if (REEL_VIDEO_EXT.test(pathname)) return true;
    // Progressive CDN URLs sometimes omit a file extension (e.g. Shopify …/vp/…/….HD-1080p-2.5Mbps).
    // Still require a video-like path and reject playlists/images.
    if (REEL_HLS_EXT.test(pathname) || REEL_POSTER_EXT.test(pathname)) return false;
    return /\/(?:videos?|vp)\//i.test(pathname);
  }
  if (kind === "hls") return REEL_HLS_EXT.test(pathname);
  return REEL_POSTER_EXT.test(pathname);
}

export function reelUrlProblem(raw: string, kind: ReelUrlKind): ReelUrlProblem | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid";
  }
  const host = u.hostname.toLowerCase();
  const local = host === "127.0.0.1" || host === "localhost";
  if (!(u.protocol === "https:" || (u.protocol === "http:" && local))) return "scheme";
  if (isDisallowedPrivateHost(host)) return "private_host";
  if (!pathLooksLike(kind, u.pathname)) return "extension";
  return null;
}

const MESSAGES: Record<ReelUrlProblem, string> = {
  invalid: "Enter a full link starting with https://.",
  scheme: "Use a secure https:// link (http is only for local testing).",
  private_host: "That host looks private or internal and cannot be used as public media.",
  extension:
    "Use a direct HTTPS media URL (.mp4 / .webm / .mov, or a CDN progressive video path under /videos/; .m3u8 for HLS; image files for posters).",
};

const optionalUrl = (kind: ReelUrlKind) =>
  z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(2048)
      .superRefine((v, ctx) => {
        const p = reelUrlProblem(v, kind);
        if (p) ctx.addIssue({ code: "custom", message: MESSAGES[p] });
      }),
  ]);

const requiredUrl = (kind: ReelUrlKind) =>
  z
    .string()
    .trim()
    .min(1, "Enter a media URL.")
    .max(2048)
    .superRefine((v, ctx) => {
      const p = reelUrlProblem(v, kind);
      if (p) ctx.addIssue({ code: "custom", message: MESSAGES[p] });
    });

export const reelInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(120),
    caption: z.string().trim().max(300).optional().default(""),
    mediaSource: z.enum(["uploaded", "external_file", "external_stream"]).optional().default("external_file"),
    videoUrl: requiredUrl("video"),
    hlsUrl: optionalUrl("hls").optional().default(""),
    posterUrl: optionalUrl("poster").optional().default(""),
    avatarUrl: optionalUrl("avatar").optional().default(""),
    productHandle: z.union([z.literal(""), z.string().regex(/^[a-z0-9][a-z0-9-]{0,199}$/)]).optional().default(""),
    linkPath: z
      .union([z.literal(""), z.string().regex(/^\/[a-z0-9][a-z0-9/_-]{0,199}$/, "Use a site path like /collections/all.")])
      .optional()
      .default(""),
    rightsStatus: z.enum(["pending", "owned", "licensed"]),
    rightsNote: z.string().trim().max(500).optional().default(""),
    sourceAttribution: z.string().trim().max(500).optional().default(""),
    status: z.enum(["draft", "published", "archived"]),
    sortOrder: z.number().int().min(-1000).max(1000).optional().default(0),
    creatorName: z.string().trim().max(80).optional().default(""),
    creatorConsent: z.boolean().optional().default(false),
    tag: z
      .string()
      .trim()
      .regex(/^(#?[A-Za-z0-9_]{1,39})?$/, "Use one tag of letters, numbers or _ (for example #Productivity).")
      .optional()
      .default(""),
    presetKey: z.string().trim().max(80).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.status === "published" && v.rightsStatus === "pending") {
      ctx.addIssue({
        code: "custom",
        path: ["rightsStatus"],
        message: "Confirm the video is owned or licensed before publishing. An external URL alone is not permission.",
      });
    }
    if (v.creatorName && !v.creatorConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["creatorConsent"],
        message: "Confirm the person agreed to be named, or leave the name blank.",
      });
    }
    if (v.rightsStatus === "licensed" && !v.rightsNote) {
      ctx.addIssue({ code: "custom", path: ["rightsNote"], message: "Note who licensed the video and on what terms." });
    }
    if (v.mediaSource === "external_stream" && !v.hlsUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["hlsUrl"],
        message: "Add an HTTPS .m3u8 link for streaming, or choose External video file / Uploaded file.",
      });
    }
  });

export type ReelInput = z.infer<typeof reelInputSchema>;

export type PublicReel = {
  id: string;
  title: string;
  caption: string;
  videoUrl: string;
  hlsUrl: string | null;
  posterUrl: string | null;
  avatarUrl: string | null;
  productHandle: string | null;
  linkPath: string | null;
  /** Shown only when the creator consented (DB constraint reels_creator_requires_consent). */
  creatorName: string;
  tag: string;
};

/** "productivity" → "#productivity"; blank stays blank. */
export function displayTag(tag: string): string {
  const t = tag.trim().replace(/^#/, "");
  return t ? `#${t}` : "";
}

/** Defence in depth for public rendering. */
export function isRenderableReel(r: {
  videoUrl: string;
  posterUrl: string | null;
  hlsUrl?: string | null;
  avatarUrl?: string | null;
}): boolean {
  if (reelUrlProblem(r.videoUrl, "video") !== null) return false;
  if (r.posterUrl && reelUrlProblem(r.posterUrl, "poster") !== null) return false;
  if (r.hlsUrl && reelUrlProblem(r.hlsUrl, "hls") !== null) return false;
  if (r.avatarUrl && reelUrlProblem(r.avatarUrl, "avatar") !== null) return false;
  return true;
}
