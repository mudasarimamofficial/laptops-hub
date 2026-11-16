import type { SupabaseClient } from "@supabase/supabase-js";
import { isLinkPublic, type Visibility } from "@/lib/content/links";
import { createServiceClient } from "@/lib/supabase/server";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  isNew?: boolean;
  type?: "collection" | "page" | "guide" | "product" | "custom";
};

export type FooterNavColumn = {
  id: string;
  title: string;
  links: NavigationItem[];
};

export type NavigationConfig = {
  headerNav: NavigationItem[];
  footerColumns: FooterNavColumn[];
  version: number;
  updatedAt: string;
};

/** Approved V5 frozen defaults */
export const DEFAULT_HEADER_NAV: NavigationItem[] = [
  { id: "h-dell", label: "Dell", href: "/collections/dell", type: "collection" },
  { id: "h-hp", label: "HP", href: "/collections/hp", type: "collection" },
  { id: "h-lenovo", label: "Lenovo", href: "/collections/lenovo", type: "collection" },
  { id: "h-chromebooks", label: "Chromebooks", href: "/collections/chromebooks", isNew: true, type: "collection" },
  { id: "h-accessories", label: "Accessories", href: "/collections/accessories", type: "collection" },
  { id: "h-guides", label: "Guides", href: "/guides", type: "guide" },
  { id: "h-support", label: "Support", href: "/pages/faq", type: "page" },
];

export const DEFAULT_FOOTER_COLUMNS: FooterNavColumn[] = [
  {
    id: "f-shop",
    title: "Shop",
    links: [
      { id: "f-s-all", label: "All products", href: "/collections/all", type: "collection" },
      { id: "f-s-laptops", label: "Laptops", href: "/collections/laptops", type: "collection" },
      { id: "f-s-gaming", label: "Gaming laptops", href: "/collections/gaming-laptops", type: "collection" },
      { id: "f-s-macbooks", label: "MacBooks", href: "/collections/macbooks", type: "collection" },
      { id: "f-s-chromebooks", label: "Chromebooks", href: "/collections/chromebooks", type: "collection" },
      { id: "f-s-tablets", label: "Tablets & smart devices", href: "/collections/tablets", type: "collection" },
      { id: "f-s-accessories", label: "Accessories", href: "/collections/accessories", type: "collection" },
    ],
  },
  {
    id: "f-brand-spec",
    title: "By brand & spec",
    links: [
      { id: "f-b-dell", label: "Dell", href: "/collections/dell", type: "collection" },
      { id: "f-b-hp", label: "HP", href: "/collections/hp", type: "collection" },
      { id: "f-b-lenovo", label: "Lenovo", href: "/collections/lenovo", type: "collection" },
      { id: "f-b-i5", label: "Core i5", href: "/collections/core-i5", type: "collection" },
      { id: "f-b-i7", label: "Core i7", href: "/collections/core-i7", type: "collection" },
      { id: "f-b-16gb", label: "16GB RAM", href: "/collections/ram-16gb", type: "collection" },
      { id: "f-b-touch", label: "Touchscreen", href: "/collections/touchscreen", type: "collection" },
    ],
  },
  {
    id: "f-help",
    title: "Help",
    links: [
      { id: "f-h-guides", label: "Buying guides", href: "/guides", type: "guide" },
      { id: "f-h-choose", label: "How to choose", href: "/pages/how-to-choose", type: "page" },
      { id: "f-h-cond", label: "Condition guide", href: "/pages/condition-guide", type: "page" },
      { id: "f-h-faq", label: "FAQ", href: "/pages/faq", type: "page" },
      { id: "f-h-inq", label: "Order inquiries", href: "/pages/order-inquiries", type: "page" },
      { id: "f-h-contact", label: "Contact us", href: "/pages/contact", type: "page" },
    ],
  },
  {
    id: "f-policies",
    title: "Policies",
    links: [
      { id: "f-p-ship", label: "Shipping & delivery", href: "/pages/shipping", type: "page" },
      { id: "f-p-ret", label: "Returns & refunds", href: "/pages/returns", type: "page" },
      { id: "f-p-war", label: "Warranty", href: "/pages/warranty", type: "page" },
      { id: "f-p-priv", label: "Privacy policy", href: "/pages/privacy", type: "page" },
      { id: "f-p-terms", label: "Terms & conditions", href: "/pages/terms", type: "page" },
    ],
  },
  {
    id: "f-company",
    title: "Company",
    links: [
      { id: "f-c-about", label: "About Laptops HUB", href: "/pages/about", type: "page" },
      { id: "f-c-why", label: "Why Laptops HUB", href: "/pages/why-laptops-hub", type: "page" },
      { id: "f-c-comp", label: "Compare", href: "/compare", type: "custom" },
      { id: "f-c-cart", label: "Cart", href: "/cart", type: "custom" },
    ],
  },
];

export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  headerNav: DEFAULT_HEADER_NAV,
  footerColumns: DEFAULT_FOOTER_COLUMNS,
  version: 1,
  updatedAt: "2026-10-26T00:00:00.000Z",
};

/**
 * Validates and sanitizes a destination URL.
 * Strictly prevents administrative links (/admin/*), internal API calls (/api/*),
 * or dangerous schemas (javascript:, data:).
 */
export function isSafeDestinationUrl(href: string): boolean {
  if (!href || typeof href !== "string") return false;
  const trimmed = href.trim();
  if (trimmed.startsWith("/admin") || trimmed.startsWith("/api")) return false;
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Clean and filter navigation links for public customer display:
 * 1. Removes unsafe destinations.
 * 2. Filters out unpublished policy pages via `isLinkPublic`.
 */
export function sanitizePublicNavLinks(links: NavigationItem[], vis: Visibility): NavigationItem[] {
  return links
    .filter((item) => isSafeDestinationUrl(item.href))
    .filter((item) => isLinkPublic(item.href, vis));
}

export function sanitizePublicFooterColumns(columns: FooterNavColumn[], vis: Visibility): FooterNavColumn[] {
  return columns
    .map((col) => ({
      ...col,
      links: sanitizePublicNavLinks(col.links, vis),
    }))
    .filter((col) => col.links.length > 0);
}

/**
 * Fetch published navigation configuration from store_settings.
 * Falls back safely to DEFAULT_NAVIGATION_CONFIG if missing or corrupt.
 */
export async function getPublishedNavigation(client?: SupabaseClient): Promise<NavigationConfig> {
  try {
    const supabase = client || createServiceClient();
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "navigation")
      .maybeSingle();

    if (data?.value && typeof data.value === "object") {
      const val = data.value as Partial<NavigationConfig>;
      if (Array.isArray(val.headerNav) && Array.isArray(val.footerColumns)) {
        return {
          headerNav: val.headerNav.filter((item) => isSafeDestinationUrl(item.href)),
          footerColumns: val.footerColumns.map((col) => ({
            ...col,
            links: (col.links || []).filter((item) => isSafeDestinationUrl(item.href)),
          })),
          version: typeof val.version === "number" ? val.version : 1,
          updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fail closed to approved V5 defaults
  }
  return DEFAULT_NAVIGATION_CONFIG;
}
