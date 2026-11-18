import { z } from "zod";
import type { StaffRole } from "@/lib/auth/staff";

/**
 * Store testimonials (homepage reviews carousel) — migration 20261118100000.
 *
 * Provenance is explicit and never blurred:
 * - `google`   copied from the store's Google Business Profile; must link to the original review. Shown with
 *              "Posted on Google" and that link.
 * - `website`  submitted to Laptops HUB directly by a customer.
 * - `merchant` given to the store by the customer (message, call, visit) and entered by staff.
 * Only `google` entries carry Google attribution. No aggregate rating is ever computed or shown from these rows, and
 * no review structured data is emitted for them (self-serving business reviews are not eligible).
 */

export const TESTIMONIAL_SOURCES = ["google", "website", "merchant"] as const;
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];
export const TESTIMONIAL_STATUSES = ["draft", "pending", "published", "hidden"] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

export const SOURCE_LABEL: Record<TestimonialSource, string> = {
  google: "Posted on Google",
  website: "Review sent to Laptops HUB",
  merchant: "Customer testimonial",
};
export const SOURCE_ADMIN_LABEL: Record<TestimonialSource, string> = {
  google: "Google review (Maps link required to publish)",
  website: "Website review (sent to us directly)",
  merchant: "Testimonial given to the store",
};
export const STATUS_LABEL: Record<TestimonialStatus, string> = {
  draft: "Draft",
  pending: "Waiting for approval",
  published: "Published",
  hidden: "Hidden",
};

/** Create drafts, edit them and submit them for approval. */
export const TESTIMONIAL_EDIT_ROLES: StaffRole[] = ["owner", "admin", "manager", "editor"];
/** Publish, hide and delete. Editors can prepare entries but not approve them. */
export const TESTIMONIAL_APPROVE_ROLES: StaffRole[] = ["owner", "admin", "manager"];

export const GOOGLE_REVIEW_URL_RE =
  /^https:\/\/((www\.)?google\.(com|[a-z]{2})(\.[a-z]{2})?\/maps|maps\.google\.(com|[a-z]{2})(\.[a-z]{2})?\/|maps\.app\.goo\.gl\/|g\.page\/)/i;
const HTTPS_URL_RE = /^https:\/\/[^\s<>"']+$/i;

const optionalHttps = z
  .union([z.literal(""), z.string().trim().max(1000).regex(HTTPS_URL_RE, "Use a full https:// link.")])
  .optional()
  .default("");

export const testimonialInputSchema = z
  .object({
    authorName: z.string().trim().min(2, "Enter the customer's name as they gave it.").max(80),
    rating: z.union([z.null(), z.number().int().min(1).max(5)]).default(null),
    body: z.string().trim().min(10, "Enter the review text (at least 10 characters).").max(2000),
    reviewDate: z
      .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date shown on the review.")])
      .optional()
      .default(""),
    source: z.enum(TESTIMONIAL_SOURCES),
    sourceUrl: optionalHttps,
    avatarUrl: optionalHttps,
    avatarPermission: z.boolean().default(false),
    consentConfirmed: z.boolean().default(false),
    verificationNote: z.string().trim().max(1000).optional().default(""),
    showOnHomepage: z.boolean().default(true),
    featured: z.boolean().default(false),
    sortOrder: z.number().int().min(-100000).max(100000).default(0),
  })
  .superRefine((v, ctx) => {
    // Google Maps URL is required to *publish*, not to save a draft candidate (bulk import / pending verification).
    if (v.source === "google" && v.sourceUrl && !GOOGLE_REVIEW_URL_RE.test(v.sourceUrl)) {
      ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Use a Google Maps (or g.page / maps.app.goo.gl) review link." });
    }
    if (v.avatarUrl && !v.avatarPermission) {
      ctx.addIssue({ code: "custom", path: ["avatarPermission"], message: "Confirm you may show this photo, or remove it." });
    }
    if (v.reviewDate && v.reviewDate > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", path: ["reviewDate"], message: "The review date cannot be in the future." });
    }
  });
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;

/** Extra gates before status → published (drafts may omit Google URL / consent while being verified). */
export function publishBlockers(row: {
  source: TestimonialSource;
  source_url: string | null;
  consent_confirmed: boolean;
  avatar_url: string | null;
  avatar_permission: boolean;
}): string | null {
  if (!row.consent_confirmed) {
    return "Record the customer's consent (edit the entry) before publishing.";
  }
  if (row.source === "google" && !GOOGLE_REVIEW_URL_RE.test(row.source_url || "")) {
    return "A Google review needs the link to it on Google Maps before publishing.";
  }
  if (row.avatar_url && !row.avatar_permission) {
    return "Confirm you may show this photo, or remove it, before publishing.";
  }
  return null;
}

export const testimonialStatusSchema = z.object({ status: z.enum(TESTIMONIAL_STATUSES) });

/** Bulk draft import candidate (from a verified extraction JSON). Avatars are omitted until permission is recorded. */
export const testimonialImportItemSchema = z.object({
  authorName: z.string().trim().min(2).max(80),
  rating: z.union([z.null(), z.number().int().min(1).max(5)]).default(null),
  body: z.string().trim().min(10).max(2000),
  reviewDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .default(""),
  source: z.literal("google").default("google"),
  sourceUrl: optionalHttps,
  verificationNote: z.string().trim().max(1000).optional().default(""),
  showOnHomepage: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(-100000).max(100000).default(0),
});
export const testimonialImportSchema = z.object({
  candidates: z.array(testimonialImportItemSchema).min(1).max(100),
});

/** Whether a role may move an entry from `from` to `to`. Editors may only draft and submit. */
export function canTransition(role: StaffRole, from: TestimonialStatus, to: TestimonialStatus): boolean {
  if (from === to) return true;
  const approver = TESTIMONIAL_APPROVE_ROLES.includes(role);
  if (approver) return true;
  if (!TESTIMONIAL_EDIT_ROLES.includes(role)) return false;
  // Editors: draft <-> pending only; never publish, hide, or touch something already published/hidden.
  return (from === "draft" && to === "pending") || (from === "pending" && to === "draft");
}

export function toRow(v: TestimonialInput) {
  return {
    author_name: v.authorName,
    rating: v.rating,
    body: v.body,
    review_date: v.reviewDate || null,
    source: v.source,
    source_url: v.sourceUrl || null,
    avatar_url: v.avatarUrl || null,
    avatar_permission: v.avatarUrl ? v.avatarPermission : false,
    consent_confirmed: v.consentConfirmed,
    verification_note: v.verificationNote,
    show_on_homepage: v.showOnHomepage,
    featured: v.featured,
    sort_order: v.sortOrder,
  };
}

/** What the storefront receives: public columns only. */
export type PublicTestimonial = {
  id: string;
  authorName: string;
  rating: number | null;
  body: string;
  reviewDate: string | null;
  source: TestimonialSource;
  sourceUrl: string | null;
  avatarUrl: string | null;
};

/** Initials for the avatar fallback ("Muhammad Arslan" → "MA"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const pick = (s: string) => Array.from(s)[0] ?? "";
  return ((pick(parts[0] ?? "") + (parts.length > 1 ? pick(parts[parts.length - 1]) : "")).toUpperCase() || "?").slice(0, 2);
}

/** "March 2026" style date; null when the review date is unknown (never invented). */
export function formatReviewDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Split into two rows for the dual-track carousel; one row when there are too few entries to fill two. */
export function splitRows<T>(items: T[], minForTwoRows = 6): T[][] {
  if (items.length < minForTwoRows) return [items];
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}
