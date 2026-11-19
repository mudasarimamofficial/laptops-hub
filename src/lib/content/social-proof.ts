import { z } from "zod";

/**
 * Social proof and merchandising — truthful by construction.
 *
 * Client request (Nov 2026): a small "someone ordered" notice and fire/"top selling" badges. Rules:
 *  - Purchase activity comes ONLY from real orders that staff have confirmed (or delivered). No demo data, no invented
 *    names, places, times or quantities. COD orders are unpaid at placement, so the copy says "ordered", never "paid".
 *  - The shopper never sees a name, phone, address or order number. The city is shown only if the merchant turns it on.
 *  - Times are coarse ("today", "yesterday", "this week") so an order cannot be pinpointed.
 *  - "Top seller" is computed from real qualifying order quantities over a window, with a minimum. With zero orders it
 *    is never shown. It cannot be assigned by hand.
 *  - Editorial labels ("Featured", "Popular pick", "Staff pick") are the merchant's choice and look different from the
 *    data-backed badge, so an editorial pick never reads as a sales claim.
 *
 * Settings live in store_settings key `social_proof`; everything is OFF by default.
 */

export const SOCIAL_PROOF_KEY = "social_proof";

/** Order statuses that count as a real order, by the merchant's chosen minimum. Cancelled/failed/returned never count. */
export const QUALIFYING_STATUSES = {
  confirmed: ["confirmed", "packing", "shipped", "out_for_delivery", "delivered"],
  delivered: ["delivered"],
} as const;
export type MinStatus = keyof typeof QUALIFYING_STATUSES;

export type SocialProofSettings = {
  activity: {
    enabled: boolean;
    minStatus: MinStatus;
    showCity: boolean;
    windowDays: number;
    /** Seconds between notices. */
    intervalSeconds: number;
    /** Seconds each notice stays on screen. */
    displaySeconds: number;
    /** Maximum notices per browser session. */
    maxPerSession: number;
    position: "bottom-left" | "bottom-right";
  };
  topSeller: {
    enabled: boolean;
    minStatus: MinStatus;
    windowDays: number;
    /** Minimum units ordered in the window before a product can be called a top seller. */
    minUnits: number;
    /** At most this many products carry the badge at once. */
    maxProducts: number;
  };
  editorial: { enabled: boolean };
  reels: {
    heading: string;
    subtitle: string;
    /** Start muted playback when a reel scrolls into view (browser policy and reduced-motion/data-saver still apply). */
    autoplayMuted: boolean;
  };
};

export const DEFAULT_SOCIAL_PROOF: SocialProofSettings = {
  activity: { enabled: false, minStatus: "confirmed", showCity: false, windowDays: 14, intervalSeconds: 30, displaySeconds: 6, maxPerSession: 3, position: "bottom-left" },
  topSeller: { enabled: false, minStatus: "confirmed", windowDays: 30, minUnits: 3, maxProducts: 8 },
  editorial: { enabled: true },
  reels: {
    heading: "Laptops in Action",
    subtitle: "Watch, explore, and find your next laptop.",
    autoplayMuted: true,
  },
};

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const socialProofSchema = z.object({
  activity: z.object({
    enabled: z.boolean(),
    minStatus: z.enum(["confirmed", "delivered"]),
    showCity: z.boolean(),
    windowDays: int(1, 90),
    intervalSeconds: int(10, 600),
    displaySeconds: int(3, 20),
    maxPerSession: int(1, 10),
    position: z.enum(["bottom-left", "bottom-right"]),
  }),
  topSeller: z.object({
    enabled: z.boolean(),
    minStatus: z.enum(["confirmed", "delivered"]),
    windowDays: int(7, 365),
    minUnits: int(2, 1000),
    maxProducts: int(1, 24),
  }),
  editorial: z.object({ enabled: z.boolean() }),
  reels: z.object({
    heading: z.string().trim().min(1, "Enter a heading.").max(80),
    subtitle: z.string().trim().max(160),
    autoplayMuted: z.boolean(),
  }),
});

/** Tolerant parse: every field falls back to the safe default on its own; a malformed row can never switch a feature on. */
export function parseSocialProof(value: unknown): SocialProofSettings {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const root = obj(value);
  const merge = <T extends Record<string, unknown>>(def: T, raw: unknown, shape: z.ZodObject): T => {
    const r = obj(raw);
    const out: Record<string, unknown> = { ...def };
    for (const k of Object.keys(def)) {
      const field = shape.shape[k] as z.ZodType | undefined;
      if (field && field.safeParse(r[k]).success) out[k] = field.parse(r[k]);
    }
    return out as T;
  };
  return {
    activity: merge(DEFAULT_SOCIAL_PROOF.activity, root.activity, socialProofSchema.shape.activity),
    topSeller: merge(DEFAULT_SOCIAL_PROOF.topSeller, root.topSeller, socialProofSchema.shape.topSeller),
    editorial: merge(DEFAULT_SOCIAL_PROOF.editorial, root.editorial, socialProofSchema.shape.editorial),
    reels: merge(DEFAULT_SOCIAL_PROOF.reels, root.reels, socialProofSchema.shape.reels),
  };
}

// ── Purchase activity ─────────────────────────────────────────────────────

/** One order line as read on the server (never sent to the browser as is). */
export type OrderActivityRow = {
  orderId: string;
  status: string;
  createdAt: string;
  city: string | null;
  productId: string | null;
  handle: string;
  title: string;
  quantity: number;
};

export type TimeBucket = "today" | "yesterday" | "this_week" | "recently";

/** What the browser receives: no ids, names, phones, addresses, order numbers, quantities or exact times. */
export type ActivityItem = { handle: string; title: string; imageUrl: string | null; when: TimeBucket; city: string | null };

const DAY = 86_400_000;

/** Pakistan Standard Time is UTC+5 all year (no daylight saving), so "today" follows the shopper's calendar, not the server's. */
const PKT_OFFSET = 5 * 3_600_000;

export function timeBucket(createdAt: string, now: Date): TimeBucket {
  const t = Date.parse(createdAt);
  const startToday = Math.floor((now.getTime() + PKT_OFFSET) / DAY) * DAY - PKT_OFFSET;
  if (t >= startToday) return "today";
  if (t >= startToday - DAY) return "yesterday";
  if (t >= now.getTime() - 7 * DAY) return "this_week";
  return "recently";
}

const TITLE_CITY = (c: string) => c.trim().toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());

/**
 * Builds public activity from real order lines: qualifying status, inside the window, one notice per order (its first
 * line), one notice per product, newest first, at most `limit`. Returns [] when the feature is off or nothing
 * qualifies — the toast then never renders.
 */
export function buildActivityItems(
  rows: OrderActivityRow[],
  settings: SocialProofSettings,
  images: Record<string, string | null>,
  now: Date,
  limit = 5,
): ActivityItem[] {
  const a = settings.activity;
  if (!a.enabled) return [];
  const ok = new Set<string>(QUALIFYING_STATUSES[a.minStatus]);
  const since = now.getTime() - a.windowDays * DAY;
  const seenOrders = new Set<string>();
  const seenProducts = new Set<string>();
  const out: ActivityItem[] = [];
  const sorted = [...rows].sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt));
  for (const r of sorted) {
    if (out.length >= limit) break;
    if (!ok.has(r.status)) continue;
    const t = Date.parse(r.createdAt);
    if (!Number.isFinite(t) || t < since || t > now.getTime()) continue;
    if (!r.handle || !r.title) continue;
    if (seenOrders.has(r.orderId) || seenProducts.has(r.handle)) continue;
    seenOrders.add(r.orderId);
    seenProducts.add(r.handle);
    out.push({
      handle: r.handle,
      title: r.title,
      imageUrl: images[r.handle] ?? null,
      when: timeBucket(r.createdAt, now),
      city: a.showCity && r.city ? TITLE_CITY(r.city).slice(0, 40) : null,
    });
  }
  return out;
}

const WHEN_TEXT: Record<TimeBucket, string> = { today: "today", yesterday: "yesterday", this_week: "this week", recently: "recently" };

/** "A customer in Lahore ordered HP EliteBook 840 G8 today" — never "paid", never a name. */
export function activityText(item: ActivityItem): string {
  const who = item.city ? `A customer in ${item.city}` : "A customer";
  return `${who} ordered ${item.title} ${WHEN_TEXT[item.when]}`;
}

// ── Badges ────────────────────────────────────────────────────────────────

export type EditorialKind = "featured" | "popular_pick" | "staff_pick";
export const EDITORIAL_LABELS: Record<EditorialKind, string> = { featured: "Featured", popular_pick: "Popular pick", staff_pick: "Staff pick" };

/** "top_seller" is data-backed only; the others are editorial. Optional label/icon are display overrides (e.g. 🔥 Featured). */
export type MerchBadge =
  | { kind: "top_seller" }
  | { kind: EditorialKind; label?: string; icon?: "flame" | "star" };
export type MerchBadgeMap = Record<string, MerchBadge>;

export function badgeLabel(b: MerchBadge): string {
  if (b.kind === "top_seller") return "Top seller";
  if (b.label && b.label.trim()) return b.label.trim();
  return EDITORIAL_LABELS[b.kind];
}

/**
 * Top sellers from real order lines: qualifying statuses, inside the window, units summed per product, at least
 * `minUnits`, highest first (ties by most recent sale), at most `maxProducts`. Zero orders ⇒ empty.
 */
export function computeTopSellers(rows: OrderActivityRow[], settings: SocialProofSettings, now: Date): string[] {
  const s = settings.topSeller;
  if (!s.enabled) return [];
  const ok = new Set<string>(QUALIFYING_STATUSES[s.minStatus]);
  const since = now.getTime() - s.windowDays * DAY;
  const units = new Map<string, { n: number; last: number }>();
  for (const r of rows) {
    if (!ok.has(r.status) || !r.handle) continue;
    const t = Date.parse(r.createdAt);
    if (!Number.isFinite(t) || t < since || t > now.getTime()) continue;
    const q = Number.isInteger(r.quantity) && r.quantity > 0 ? r.quantity : 0;
    const cur = units.get(r.handle) ?? { n: 0, last: 0 };
    units.set(r.handle, { n: cur.n + q, last: Math.max(cur.last, t) });
  }
  return [...units.entries()]
    .filter(([, v]) => v.n >= s.minUnits)
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
    .slice(0, s.maxProducts)
    .map(([h]) => h);
}

export type EditorialBadgeRow = {
  handle: string;
  kind: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Internal note; preset rows use `preset:featured_flame_v1`. */
  note?: string | null;
};

export function editorialActive(r: Pick<EditorialBadgeRow, "startsAt" | "endsAt">, now: Date): boolean {
  const t = now.getTime();
  if (r.startsAt && Date.parse(r.startsAt) > t) return false;
  if (r.endsAt && Date.parse(r.endsAt) <= t) return false;
  return true;
}

/** Data-backed badges win over editorial ones; editorial badges respect their schedule and the global switch. */
export function buildBadgeMap(topSellerHandles: string[], editorial: EditorialBadgeRow[], settings: SocialProofSettings, now: Date): MerchBadgeMap {
  const map: MerchBadgeMap = {};
  if (settings.editorial.enabled) {
    for (const r of editorial) {
      if (r.kind in EDITORIAL_LABELS && editorialActive(r, now)) map[r.handle] = { kind: r.kind as EditorialKind };
    }
  }
  for (const h of topSellerHandles) map[h] = { kind: "top_seller" };
  return map;
}

/** Staff input for an editorial badge. */
export const editorialBadgeInputSchema = z
  .object({
    productHandle: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,199}$/, "Choose a product."),
    kind: z.enum(["featured", "popular_pick", "staff_pick"]),
    startsAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional().default(""),
    endsAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional().default(""),
    note: z.string().trim().max(300).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && Date.parse(v.endsAt) <= Date.parse(v.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start." });
    }
  });
