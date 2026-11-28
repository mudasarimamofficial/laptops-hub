/**
 * Site-wide merchant-editable copy: header, mega menu, footer, promotion bar (every page) and the page templates —
 * product page, collection/search page and "not found" pages. Only labels, headings and messages: never prices, stock,
 * cart behaviour, policies or product facts.
 *
 * Stored in `theme_versions.theme_settings.globals` of the homepage theme, so it shares the editor's draft → preview →
 * publish → restore workflow (the publish RPC copies theme_settings into the immutable snapshot). Every value has a
 * default equal to the approved V5 text, so with nothing published the storefront renders exactly as before.
 * Values are plain text (React escapes them); links are validated with the same rules as homepage buttons.
 *
 * Client-safe: no server imports.
 */
import { copyValueProblems, resolveCopy, type CopyField } from "./home-copy";

export type GlobalCopyGroup = "header" | "footer" | "announcement" | "product" | "collection" | "notFound" | "cart" | "compare";

/** Editor panel a group is shown in. */
export type GlobalCopyPanel = "chrome" | "product" | "collection" | "notFound" | "cartCompare";

export type GlobalCopyField = CopyField & { group: GlobalCopyGroup };

const LINK_HELP = "A page on this site (/collections/…, /pages/…) or a full https:// link.";

export const GLOBAL_COPY: GlobalCopyField[] = [
  // Header + mega menu
  { group: "header", key: "laptopsMenuLabel", label: "Menu button", kind: "text", default: "Laptops", max: 20, help: "Opens the laptops menu (desktop)." },
  { group: "header", key: "searchLabel", label: "Search box text", kind: "text", default: "Search model, processor, RAM", max: 40 },
  { group: "header", key: "searchShortLabel", label: "Search box text (narrow screens)", kind: "text", default: "Search laptops", max: 24 },
  { group: "header", key: "menuAllLabel", label: "Menu: all products link", kind: "text", default: "View all products", max: 40, help: "An arrow is added automatically." },
  { group: "header", key: "menuSecondLabel", label: "Menu: second link", kind: "text", default: "Chromebooks", max: 30, help: "Shown in the laptops menu and the phone menu." },
  { group: "header", key: "menuSecondHref", label: "Menu: second link goes to", kind: "link", default: "/collections/chromebooks", max: 500, help: LINK_HELP },
  // Footer
  { group: "footer", key: "footerTagline", label: "Footer description", kind: "textarea", default: "Used Dell, HP and Lenovo laptops. Prices in PKR. Visit us in Bahawalpur or shop online.", max: 220 },
  { group: "footer", key: "footerContactHeading", label: "Contact column heading", kind: "text", default: "Visit & contact", max: 40 },
  { group: "footer", key: "footerWhatsappLabel", label: "WhatsApp button", kind: "text", default: "Chat on WhatsApp", max: 40 },
  // Promotion bar (the promotion text itself comes from the active automatic discount)
  { group: "announcement", key: "announcementCtaLabel", label: "Promotion bar button", kind: "text", default: "Shop now", max: 30, help: "Shown after the promotion text when a discount has its announcement turned on." },
  { group: "announcement", key: "announcementHref", label: "Promotion bar link", kind: "link", default: "/collections/all", max: 500, help: LINK_HELP },
  // Product page (labels only — price, stock, options and the buy buttons are not editable here)
  { group: "product", key: "pdpSpecKicker", label: "Specifications: small label", kind: "text", default: "SPEC SHEET", max: 30 },
  { group: "product", key: "pdpSpecHeading", label: "Specifications: heading", kind: "text", default: "Specifications", max: 60 },
  { group: "product", key: "pdpAboutKicker", label: "Description: small label", kind: "text", default: "LISTING", max: 30 },
  { group: "product", key: "pdpAboutHeading", label: "Description: heading", kind: "text", default: "About this listing", max: 60 },
  { group: "product", key: "pdpNoIntroText", label: "Note when a product has no description", kind: "textarea", default: "Full specifications for this listing are being prepared. Ask us for any detail before you order.", max: 240 },
  { group: "product", key: "pdpPolicyDelivery", label: "Policy link: delivery", kind: "text", default: "Delivery", max: 30, help: "Label only. The policy page itself is edited under Content." },
  { group: "product", key: "pdpPolicyReturns", label: "Policy link: returns", kind: "text", default: "Returns", max: 30, help: "Label only. The policy page itself is edited under Content." },
  { group: "product", key: "pdpPolicyWarranty", label: "Policy link: warranty", kind: "text", default: "Warranty", max: 30, help: "Label only. The policy page itself is edited under Content." },
  { group: "product", key: "pdpPolicyCta", label: "Policy link: small text", kind: "text", default: "READ POLICY", max: 24 },
  { group: "product", key: "pdpRelatedHeading", label: "Related products heading", kind: "text", default: "More from {brand}", max: 60, help: "{brand} is replaced by the product's brand." },
  { group: "product", key: "pdpRelatedCta", label: "Related products link", kind: "text", default: "View all", max: 30, help: "An arrow is added automatically." },
  // Collection and search pages
  { group: "collection", key: "colNoResultsHeading", label: "No matches: heading", kind: "text", default: "No products match these filters", max: 80 },
  { group: "collection", key: "colNoResultsText", label: "No matches: message", kind: "text", default: "Remove a filter or browse the full catalog.", max: 160 },
  { group: "collection", key: "colClearFilters", label: "No matches: clear button", kind: "text", default: "Clear filters", max: 30 },
  { group: "collection", key: "colAllLaptops", label: "No matches: catalog button", kind: "text", default: "All laptops", max: 30 },
  { group: "collection", key: "colLoadMore", label: "Load more button", kind: "text", default: "Load more", max: 30 },
  { group: "collection", key: "colSearchTitle", label: "Search results: heading", kind: "text", default: "Results for", max: 40, help: "The words the shopper searched for are added after it, in quotes." },
  { group: "collection", key: "colCbEmptyHeading", label: "No Chromebooks: heading", kind: "text", default: "No Chromebooks listed right now.", max: 80 },
  { group: "collection", key: "colCbEmptyText", label: "No Chromebooks: message", kind: "textarea", default: "There are no Chromebooks in the catalog at the moment. Tell us the model, budget or specifications you need and our team can tell you what is available.", max: 300 },
  { group: "collection", key: "colCbAsk", label: "No Chromebooks: ask button", kind: "text", default: "Ask about Chromebooks", max: 40 },
  // "Not found" pages
  { group: "notFound", key: "nfTitle", label: "Page not found: heading", kind: "text", default: "This page doesn\u2019t exist", max: 80 },
  { group: "notFound", key: "nfText", label: "Page not found: message", kind: "text", default: "The link may be out of date. Try the catalog or search for a model.", max: 200 },
  { group: "notFound", key: "nfProductTitle", label: "Product not found: heading", kind: "text", default: "This product isn\u2019t in the catalog", max: 80 },
  { group: "notFound", key: "nfProductText", label: "Product not found: message", kind: "text", default: "The link may point to a product that is no longer listed.", max: 200 },
  { group: "notFound", key: "nfButton", label: "Button", kind: "text", default: "Browse all products", max: 40 },
  { group: "notFound", key: "nfButtonHref", label: "Button goes to", kind: "link", default: "/collections/all", max: 500, help: LINK_HELP },
  // P7 (LH-012/G48): cart page, cart drawer and compare page. Totals, prices and the checkout switch stay in code.
  { group: "cart", key: "cartTitle", label: "Cart page: heading", kind: "text", default: "Cart", max: 40 },
  { group: "cart", key: "cartEmptyTitle", label: "Empty cart: message", kind: "text", default: "Your cart is empty", max: 80, help: "Cart page and cart panel." },
  { group: "cart", key: "cartEmptyButton", label: "Empty cart: button", kind: "text", default: "Browse the catalog", max: 40 },
  { group: "cart", key: "cartEmptyHref", label: "Empty cart: button goes to", kind: "link", default: "/collections/all", max: 500, help: LINK_HELP },
  { group: "cart", key: "cartSummaryTitle", label: "Cart page: summary heading", kind: "text", default: "Summary", max: 40 },
  { group: "cart", key: "cartViewButton", label: "Cart panel: button", kind: "text", default: "View cart", max: 30 },
  { group: "cart", key: "cartOpenNote", label: "Note while checkout is open (cart page)", kind: "textarea", default: "Prices, delivery and the order total are confirmed at checkout.", max: 160 },
  { group: "cart", key: "cartClosedNote", label: "Note while checkout is closed (cart page)", kind: "textarea", default: "Online checkout is not open yet. Your cart is saved on this device.", max: 160 },
  { group: "cart", key: "drawerOpenNote", label: "Note while checkout is open (cart panel)", kind: "text", default: "Prices are confirmed at checkout", max: 80 },
  { group: "cart", key: "drawerClosedNote", label: "Note while checkout is closed (cart panel)", kind: "text", default: "Online checkout is not open yet", max: 80 },
  { group: "compare", key: "compareTitle", label: "Compare page: heading", kind: "text", default: "Compare laptops", max: 60 },
  { group: "compare", key: "compareSub", label: "Compare page: line under the heading", kind: "text", default: "Up to 4 at a time. Highlighted rows differ.", max: 120 },
  { group: "compare", key: "compareEmptyTitle", label: "Nothing to compare: heading", kind: "text", default: "Nothing to compare yet", max: 80 },
  { group: "compare", key: "compareEmptyText", label: "Nothing to compare: message", kind: "text", default: "Tap Compare on any laptop card or product page.", max: 160 },
  { group: "compare", key: "compareEmptyButton", label: "Nothing to compare: button", kind: "text", default: "Browse laptops", max: 40 },
  { group: "compare", key: "compareEmptyHref", label: "Nothing to compare: button goes to", kind: "link", default: "/collections/all", max: 500, help: LINK_HELP },
];

export const GLOBAL_COPY_GROUPS: { id: GlobalCopyGroup; title: string; panel: GlobalCopyPanel }[] = [
  { id: "header", title: "Header & menu", panel: "chrome" },
  { id: "footer", title: "Footer", panel: "chrome" },
  { id: "announcement", title: "Promotion bar", panel: "chrome" },
  { id: "product", title: "Product page", panel: "product" },
  { id: "collection", title: "Collection & search pages", panel: "collection" },
  { id: "notFound", title: "Not found pages", panel: "notFound" },
  { id: "cart", title: "Cart", panel: "cartCompare" },
  { id: "compare", title: "Compare", panel: "cartCompare" },
];

/** Editor entries (left list), each showing the groups of its panel. */
export const GLOBAL_COPY_PANELS: { id: GlobalCopyPanel; title: string; badge: string; note: string }[] = [
  {
    id: "chrome",
    title: "Header & footer",
    badge: "All pages",
    note: "Text shown on every page.",
  },
  {
    id: "product",
    title: "Product pages",
    badge: "Template",
    note: "Headings and labels on every product page. Prices, stock, options, buttons and product details are edited under Products, not here.",
  },
  {
    id: "collection",
    title: "Collection pages",
    badge: "Template",
    note: "Messages on collection and search pages (for example when filters match nothing).",
  },
  {
    id: "notFound",
    title: "Page not found",
    badge: "Template",
    note: "Shown when a link points to a page or product that does not exist.",
  },
  {
    id: "cartCompare",
    title: "Cart & compare",
    badge: "Template",
    note: "Headings, messages and empty states on the cart page, the cart panel and the compare page. Prices, totals and whether checkout is open are not edited here.",
  },
];

export const panelFields = (panel: GlobalCopyPanel): GlobalCopyField[] => {
  const groups = new Set(GLOBAL_COPY_GROUPS.filter((g) => g.panel === panel).map((g) => g.id));
  return GLOBAL_COPY.filter((f) => groups.has(f.group));
};

/** "More from {brand}" → "More from Dell". */
export const withBrand = (text: string, brand: string) => text.split("{brand}").join(brand);

export type ThemeGlobals = Record<string, string>;

/** Raw stored overrides (`theme_settings.globals`), or {} when absent/malformed. */
export function globalsFromThemeSettings(themeSettings: unknown): Record<string, unknown> {
  if (!themeSettings || typeof themeSettings !== "object" || Array.isArray(themeSettings)) return {};
  const g = (themeSettings as Record<string, unknown>).globals;
  return g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, unknown>) : {};
}

/** Effective site-wide copy: V5 defaults overridden by valid merchant values. Never throws. */
export function themeGlobals(overrides?: Record<string, unknown> | null): ThemeGlobals {
  return resolveCopy(GLOBAL_COPY, overrides);
}

export const DEFAULT_THEME_GLOBALS: ThemeGlobals = themeGlobals();

/** True when `key` is at its V5 default (drives count-bearing variants such as "View all 42 products →"). */
export const isDefaultGlobal = (g: ThemeGlobals, key: string) => g[key] === DEFAULT_THEME_GLOBALS[key];

/** Save-time validation messages for the draft's site-wide copy. */
export function themeGlobalsProblems(overrides: Record<string, unknown> | null | undefined): string[] {
  return GLOBAL_COPY_PANELS.flatMap((p) => copyValueProblems(panelFields(p.id), overrides, p.title));
}

/**
 * Only known keys with string values survive (unknown keys and non-strings are dropped), so theme_settings never
 * accumulates arbitrary payloads.
 */
export function cleanGlobalsForSave(overrides: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of GLOBAL_COPY) {
    const v = overrides?.[f.key];
    if (typeof v === "string" && v.trim()) out[f.key] = v.trim();
  }
  return out;
}
