/**
 * Authoritative storefront/checkout pricing helpers.
 * Money is integer paisa only. Percent discounts round to the nearest paisa (half-up via Math.round).
 *
 * Stacking: automatic campaigns apply once to catalog `price_paisa` (list).
 * `compare_at_paisa` is display-only and never used as a second discount base.
 */

export type DiscountKind = "percent" | "fixed_paisa";
export type DiscountScope = "storewide" | "products" | "collections";
export type DiscountStatus = "draft" | "active" | "scheduled" | "expired" | "disabled";

export type DiscountCampaign = {
  id: string;
  name: string;
  description: string;
  kind: DiscountKind;
  /** Percent 1–90, or fixed paisa amount when kind is fixed_paisa. */
  value: number;
  scope: DiscountScope;
  status: DiscountStatus;
  startsAt: string | null;
  endsAt: string | null;
  announcement: string;
  showAnnouncement: boolean;
  codeRequired: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PricedUnit = {
  listPaisa: number;
  sellingPaisa: number;
  discountPaisa: number;
  percentOff: number | null;
  campaignId: string | null;
  campaignName: string | null;
};

/** Round percent off list price to nearest paisa. Never exceeds list; never negative. */
export function applyPercentOff(listPaisa: number, percent: number): PricedUnit {
  const list = Math.max(0, Math.round(listPaisa));
  const pct = Math.min(90, Math.max(0, percent));
  if (!Number.isFinite(list) || list <= 0 || pct <= 0) {
    return { listPaisa: list, sellingPaisa: list, discountPaisa: 0, percentOff: null, campaignId: null, campaignName: null };
  }
  const selling = Math.max(0, Math.round((list * (100 - pct)) / 100));
  const discount = Math.max(0, list - selling);
  return {
    listPaisa: list,
    sellingPaisa: selling,
    discountPaisa: discount,
    percentOff: pct,
    campaignId: null,
    campaignName: null,
  };
}

export function applyFixedOff(listPaisa: number, fixedPaisa: number): PricedUnit {
  const list = Math.max(0, Math.round(listPaisa));
  const fixed = Math.max(0, Math.round(fixedPaisa));
  if (list <= 0 || fixed <= 0) {
    return { listPaisa: list, sellingPaisa: list, discountPaisa: 0, percentOff: null, campaignId: null, campaignName: null };
  }
  const selling = Math.max(0, list - Math.min(fixed, list));
  const discount = list - selling;
  const percentOff = list > 0 ? Math.round((discount / list) * 1000) / 10 : null;
  return { listPaisa: list, sellingPaisa: selling, discountPaisa: discount, percentOff, campaignId: null, campaignName: null };
}

export function campaignIsLive(c: Pick<DiscountCampaign, "status" | "startsAt" | "endsAt">, now = new Date()): boolean {
  if (c.status !== "active" && c.status !== "scheduled") return false;
  const t = now.getTime();
  if (c.startsAt) {
    const start = Date.parse(c.startsAt);
    if (Number.isFinite(start) && t < start) return false;
  }
  if (c.endsAt) {
    const end = Date.parse(c.endsAt);
    if (Number.isFinite(end) && t > end) return false;
  }
  // scheduled becomes live only when start has passed (status may still say scheduled until admin flips)
  if (c.status === "scheduled") {
    if (!c.startsAt) return false;
    const start = Date.parse(c.startsAt);
    if (!Number.isFinite(start) || t < start) return false;
  }
  return c.status === "active" || c.status === "scheduled";
}

/**
 * Apply the single automatic campaign (no stacking).
 * Only `storewide` scope is applied in the shared engine until product/collection
 * targeting is fully wired end-to-end (admin + storefront + COD RPC).
 */
export function priceWithCampaign(listPaisa: number, campaign: DiscountCampaign | null | undefined, now = new Date()): PricedUnit {
  const list = Math.max(0, Math.round(listPaisa));
  if (
    !campaign ||
    !campaignIsLive(campaign, now) ||
    campaign.codeRequired ||
    campaign.scope !== "storewide"
  ) {
    return { listPaisa: list, sellingPaisa: list, discountPaisa: 0, percentOff: null, campaignId: null, campaignName: null };
  }
  const base =
    campaign.kind === "fixed_paisa" ? applyFixedOff(list, campaign.value) : applyPercentOff(list, campaign.value);
  return {
    ...base,
    campaignId: campaign.id,
    campaignName: campaign.name,
  };
}

export function sumLinePricing(
  lines: { listPaisa: number; quantity: number }[],
  campaign: DiscountCampaign | null | undefined,
  now = new Date(),
): { subtotalListPaisa: number; subtotalSellingPaisa: number; discountPaisa: number; lines: PricedUnit[] } {
  const priced = lines.map((l) => {
    const unit = priceWithCampaign(l.listPaisa, campaign, now);
    return { ...unit, quantity: l.quantity };
  });
  let subtotalListPaisa = 0;
  let subtotalSellingPaisa = 0;
  let discountPaisa = 0;
  for (const l of priced) {
    subtotalListPaisa += l.listPaisa * l.quantity;
    subtotalSellingPaisa += l.sellingPaisa * l.quantity;
    discountPaisa += l.discountPaisa * l.quantity;
  }
  return { subtotalListPaisa, subtotalSellingPaisa, discountPaisa, lines: priced };
}

export const DEFAULT_STOREWIDE_5_OFF = {
  name: "Storewide 5% Off",
  description: "Automatic 5% discount on all eligible products and variants. No code needed.",
  kind: "percent" as const,
  value: 5,
  scope: "storewide" as const,
  status: "active" as const,
  announcement: "FLAT 5% OFF STOREWIDE — Automatically Applied. No Code Needed.",
  showAnnouncement: true,
  codeRequired: false,
};
