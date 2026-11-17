/**
 * Settings for the two homepage sections added in 2026-11 (customer reviews carousel, store map under the footer).
 * Pure functions — shared by the editor (client), the API (server) and the storefront renderer. Every value read
 * from a published theme goes through `reviewsSettings` / `mapSettings`, which fall back to safe defaults and refuse
 * anything that is not a Google Maps URL.
 */

/** The store's own Google listing, taken from the owner-supplied embed (place "LAPTOPS HUB", Bahawalpur). */
export const STORE_MAP_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3476.170607977357!2d71.68495918742231!3d29.394564785285247!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x393b91178109a0db%3A0x6ed8ac457d0eb4cd!2sLAPTOPS%20HUB!5e0!3m2!1sen!2s!4v1794815278525!5m2!1sen!2s";
/** Same place by its Google customer id (0x6ed8ac457d0eb4cd) — opens the listing (directions, hours, reviews). */
export const STORE_MAPS_URL = "https://maps.google.com/?cid=7987323353592411341";

/**
 * Legacy reviews "placement" setting (before section ordering existed). Read only to place reviews correctly when an
 * old draft or published snapshot is rendered (homepage-layout.ts); the editor now moves the section itself.
 */
export const REVIEWS_PLACEMENTS = [
  { value: "before_inquiry", label: "Near the end, before \"Tell us what you need\" (recommended)" },
  { value: "after_featured", label: "After the featured laptops and reels" },
  { value: "after_compare", label: "After the compare section" },
] as const;
export type ReviewsPlacement = (typeof REVIEWS_PLACEMENTS)[number]["value"];

export type ReviewsSettings = { heading: string; intro: string; placement: ReviewsPlacement; googleProfileUrl: string | null };
export type MapSettings = {
  heading: string;
  intro: string;
  embedSrc: string;
  mapsUrl: string;
  revealEffect: boolean;
  clickToLoad: boolean;
};

const EMBED_RE = /^https:\/\/www\.google\.com\/maps\/embed\?pb=[A-Za-z0-9!%._~:\-*]+$/;
const MAPS_LINK_RE = /^https:\/\/((www\.)?google\.(com|[a-z]{2})(\.[a-z]{2})?\/maps|maps\.google\.(com|[a-z]{2})(\.[a-z]{2})?\/|maps\.app\.goo\.gl\/|g\.page\/)[^\s<>"']*$/i;

export const isSafeEmbedSrc = (v: unknown): v is string => typeof v === "string" && v.length <= 2000 && EMBED_RE.test(v);
export const isSafeMapsUrl = (v: unknown): v is string => typeof v === "string" && v.length <= 1000 && MAPS_LINK_RE.test(v);

const text = (v: unknown, fallback: string, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

export function defaultReviewsSettings(): Record<string, unknown> {
  return {
    heading: "What our customers say",
    intro: "Shared by Laptops HUB customers. Each review shows where it was posted.",
    googleProfileUrl: STORE_MAPS_URL,
  };
}

export function defaultMapSettings(): Record<string, unknown> {
  return {
    heading: "Visit our store",
    intro: "See laptops in person, test them before you buy and get advice from our team in Bahawalpur.",
    embedSrc: STORE_MAP_EMBED_SRC,
    mapsUrl: STORE_MAPS_URL,
    revealEffect: true,
    clickToLoad: false,
  };
}

export function reviewsSettings(raw: Record<string, unknown> | null | undefined): ReviewsSettings {
  const d = defaultReviewsSettings();
  const r = raw ?? {};
  const placement = REVIEWS_PLACEMENTS.some((p) => p.value === r.placement) ? (r.placement as ReviewsPlacement) : "before_inquiry";
  const g = r.googleProfileUrl === "" ? null : isSafeMapsUrl(r.googleProfileUrl) ? r.googleProfileUrl : (d.googleProfileUrl as string);
  return {
    heading: text(r.heading, d.heading as string, 90),
    intro: typeof r.intro === "string" ? r.intro.trim().slice(0, 240) : (d.intro as string),
    placement,
    googleProfileUrl: g,
  };
}

export function mapSettings(raw: Record<string, unknown> | null | undefined): MapSettings {
  const d = defaultMapSettings();
  const r = raw ?? {};
  return {
    heading: text(r.heading, d.heading as string, 90),
    intro: typeof r.intro === "string" ? r.intro.trim().slice(0, 300) : (d.intro as string),
    embedSrc: isSafeEmbedSrc(r.embedSrc) ? r.embedSrc : STORE_MAP_EMBED_SRC,
    mapsUrl: isSafeMapsUrl(r.mapsUrl) ? r.mapsUrl : STORE_MAPS_URL,
    revealEffect: typeof r.revealEffect === "boolean" ? r.revealEffect : true,
    clickToLoad: r.clickToLoad === true,
  };
}

/** Server-side save check: problems the owner must fix before a draft with these sections is stored. */
export function homeSectionSettingProblems(sections: { type: string; settings: Record<string, unknown> }[]): string[] {
  const out: string[] = [];
  for (const s of sections) {
    if (s.type === "v5_store_map") {
      const v = s.settings;
      if (v.embedSrc !== undefined && v.embedSrc !== "" && !isSafeEmbedSrc(v.embedSrc))
        out.push("Map: the embed link must start with https://www.google.com/maps/embed?pb=");
      if (v.mapsUrl !== undefined && v.mapsUrl !== "" && !isSafeMapsUrl(v.mapsUrl))
        out.push("Map: \"Open in Google Maps\" must be a Google Maps link.");
    }
    if (s.type === "v5_store_reviews") {
      const v = s.settings;
      if (v.googleProfileUrl !== undefined && v.googleProfileUrl !== "" && !isSafeMapsUrl(v.googleProfileUrl))
        out.push("Reviews: the Google profile link must be a Google Maps link.");
    }
  }
  return out;
}
