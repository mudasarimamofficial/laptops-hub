import { z } from "zod";
import { isCrossSite } from "@/lib/validation/contact";

/**
 * Customer product reviews. Every submission is stored as `pending` and is public only after staff approve it in
 * /admin/reviews. Nothing is ever auto-approved, and no "verified purchase" claim is made.
 */
export const REVIEW_RULES = { nameMin: 2, nameMax: 60, titleMax: 120, bodyMin: 10, bodyMax: 2000 } as const;

const handleRe = /^[a-z0-9][a-z0-9-]{0,199}$/;

export const reviewSchema = z.object({
  handle: z.string().regex(handleRe),
  name: z.string().trim().min(REVIEW_RULES.nameMin, "Enter your name.").max(REVIEW_RULES.nameMax),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  title: z.string().trim().max(REVIEW_RULES.titleMax).optional().default(""),
  body: z
    .string()
    .trim()
    .min(REVIEW_RULES.bodyMin, `Write at least ${REVIEW_RULES.bodyMin} characters.`)
    .max(REVIEW_RULES.bodyMax),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it empty.").max(254)]).optional(),
  /** Honeypot: humans never fill it. */
  company: z.string().max(200).optional(),
});

export type ReviewRow = {
  product_id: string;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  reviewer_email: string | null;
  ip_hash: string;
  status: "pending";
};

export type ReviewDeps = {
  rateLimit: (key: string) => Promise<{ ok: true } | { ok: false; retryAfterSec: number }>;
  /** Active, public product id for a handle (null when unknown, draft or archived). */
  productIdFor: (handle: string) => Promise<string | null>;
  hashIp: (ip: string) => string;
  insert: (row: ReviewRow) => Promise<{ error: string | null }>;
};

export type ReviewResult = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

export async function processReview(
  input: { origin: string | null; url: string; host?: string | null; ip: string; body: unknown },
  deps: ReviewDeps,
): Promise<ReviewResult> {
  if (isCrossSite(input.origin, input.url, input.host)) return { status: 403, body: { error: "forbidden_origin" } };
  const ipHash = deps.hashIp(input.ip);
  const limited = await deps.rateLimit(`review:${ipHash}`);
  if (!limited.ok) {
    return {
      status: 429,
      body: { error: "rate_limited", message: "Too many reviews from this connection. Try again later." },
      headers: { "Retry-After": String(limited.retryAfterSec) },
    };
  }
  const parsed = reviewSchema.safeParse(input.body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { status: 400, body: { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors } };
  }
  const d = parsed.data;
  if (d.company) return { status: 200, body: { ok: true, status: "pending" } };
  const productId = await deps.productIdFor(d.handle);
  if (!productId) return { status: 404, body: { error: "not_found", message: "This product is not available for reviews." } };
  const { error } = await deps.insert({
    product_id: productId,
    author_name: d.name,
    rating: d.rating,
    title: d.title,
    body: d.body,
    reviewer_email: d.email ? d.email : null,
    ip_hash: ipHash,
    status: "pending",
  });
  if (error) return { status: 500, body: { error: "submit_failed", message: "Could not save your review." } };
  return { status: 200, body: { ok: true, status: "pending" } };
}

/** Average of approved ratings, one decimal; null when there are none (never a default or invented score). */
export function reviewSummary(ratings: number[]): { count: number; average: number | null } {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  if (!valid.length) return { count: 0, average: null };
  return { count: valid.length, average: Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 };
}

export const moderationSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  note: z.string().trim().max(500).optional().default(""),
});
