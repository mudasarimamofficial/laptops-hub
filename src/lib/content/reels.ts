import { z } from "zod";

/**
 * "Generation Laptops HUB" reels. Mirrors the database constraints (migration 20261115100000) so staff get a clear
 * message before the database refuses:
 *  - publish only with cleared rights (owned / licensed);
 *  - https only (plain http only on localhost for isolated tests);
 *  - reference material from other shops (ronin.pk) can never be stored or shown;
 *  - video must be a direct file (.mp4 / .webm / .mov) played by our own <video> element — no third-party embeds,
 *    trackers or hotlinked players.
 */
export const BLOCKED_REEL_HOSTS = ["ronin.pk"] as const;
export const REEL_VIDEO_EXT = /\.(mp4|webm|mov)$/i;
export const REEL_POSTER_EXT = /\.(jpe?g|png|webp|avif)$/i;

export type ReelUrlProblem = "invalid" | "scheme" | "blocked_host" | "extension";

export function reelUrlProblem(raw: string, kind: "video" | "poster"): ReelUrlProblem | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid";
  }
  const host = u.hostname.toLowerCase();
  const local = host === "127.0.0.1" || host === "localhost";
  if (!(u.protocol === "https:" || (u.protocol === "http:" && local))) return "scheme";
  if (BLOCKED_REEL_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) return "blocked_host";
  if (!(kind === "video" ? REEL_VIDEO_EXT : REEL_POSTER_EXT).test(u.pathname)) return "extension";
  return null;
}

const MESSAGES: Record<ReelUrlProblem, string> = {
  invalid: "Enter a full link starting with https://.",
  scheme: "Use a secure https:// link.",
  blocked_host: "Reference videos from other shops cannot be used. Upload Laptops HUB's own or licensed video.",
  extension: "Link directly to the file (.mp4, .webm or .mov for video; .jpg, .png, .webp or .avif for the cover).",
};

const urlField = (kind: "video" | "poster") =>
  z
    .string()
    .trim()
    .max(2048)
    .superRefine((v, ctx) => {
      const p = reelUrlProblem(v, kind);
      if (p) ctx.addIssue({ code: "custom", message: MESSAGES[p] });
    });

export const reelInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(120),
    caption: z.string().trim().max(300).optional().default(""),
    videoUrl: urlField("video"),
    posterUrl: z.union([z.literal(""), urlField("poster")]).optional().default(""),
    productHandle: z.union([z.literal(""), z.string().regex(/^[a-z0-9][a-z0-9-]{0,199}$/)]).optional().default(""),
    rightsStatus: z.enum(["pending", "owned", "licensed"]),
    rightsNote: z.string().trim().max(500).optional().default(""),
    status: z.enum(["draft", "published", "archived"]),
    sortOrder: z.number().int().min(-1000).max(1000).optional().default(0),
  })
  .superRefine((v, ctx) => {
    if (v.status === "published" && v.rightsStatus === "pending") {
      ctx.addIssue({ code: "custom", path: ["rightsStatus"], message: "Confirm the video is owned or licensed before publishing." });
    }
    if (v.rightsStatus === "licensed" && !v.rightsNote) {
      ctx.addIssue({ code: "custom", path: ["rightsNote"], message: "Note who licensed the video and on what terms." });
    }
  });

export type ReelInput = z.infer<typeof reelInputSchema>;

export type PublicReel = { id: string; title: string; caption: string; videoUrl: string; posterUrl: string | null; productHandle: string | null };

/** Defence in depth for public rendering: drop anything the rules above would refuse. */
export function isRenderableReel(r: { videoUrl: string; posterUrl: string | null }): boolean {
  return reelUrlProblem(r.videoUrl, "video") === null && (r.posterUrl === null || reelUrlProblem(r.posterUrl, "poster") === null);
}
