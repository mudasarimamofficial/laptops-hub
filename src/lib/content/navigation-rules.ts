/**
 * Navigation rules shared by the admin editor (browser), the admin API and the storefront. Pure: no server imports.
 */

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

/** A published version kept for "Restore" (Admin → Navigation → Version history). */
export type NavigationHistoryEntry = {
  version: number;
  savedAt: string;
  savedBy: string | null;
  action: "save" | "restore_version" | "restore_defaults" | "before_first_edit";
  restoredFrom?: number;
  headerNav: NavigationItem[];
  footerColumns: FooterNavColumn[];
};

export const NAV_LIMITS = {
  headerItems: 12,
  footerColumns: 8,
  footerLinksPerColumn: 20,
  label: 40,
  columnTitle: 40,
  href: 240,
  history: 10,
} as const;

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
 * Why a destination cannot be used, in plain words, or null when it is fine. Store addresses start with "/";
 * other websites need a full http(s) address. Admin, API and script addresses are never allowed.
 */
export function destinationProblem(href: unknown): string | null {
  if (typeof href !== "string" || !href.trim()) return "Enter where the link goes, for example /collections/dell.";
  const t = href.trim();
  if (t.length > NAV_LIMITS.href) return `Keep the address under ${NAV_LIMITS.href} characters.`;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(t)) return "Addresses cannot contain spaces.";
  if (/^(javascript|data|vbscript|file):/i.test(t)) return "That kind of address is not allowed.";
  // "//host" and "/\host" are other websites disguised as store addresses.
  if (/^\/[/\\]/.test(t) || t.includes("\\")) return "Use a full https:// address for other websites.";
  if (t.startsWith("/")) {
    if (/^\/(admin|api)/i.test(t)) return "Admin and system addresses cannot be used in customer menus.";
    return null;
  }
  try {
    const url = new URL(t);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "That kind of address is not allowed.";
    if (url.username || url.password) return "Addresses with a user name or password are not allowed.";
    return null;
  } catch {
    return "Store addresses start with / (for example /collections/dell); other websites need https://.";
  }
}

/**
 * Validates and sanitizes a destination URL.
 * Strictly prevents administrative links (/admin/*), internal API calls (/api/*),
 * or dangerous schemas (javascript:, data:).
 */
export function isSafeDestinationUrl(href: string): boolean {
  return destinationProblem(href) === null;
}

export type NavigationProblem = { where: string; message: string };

/** Every problem with a header/footer configuration (empty list = can be saved). */
export function navigationProblems(headerNav: NavigationItem[], footerColumns: FooterNavColumn[]): NavigationProblem[] {
  const out: NavigationProblem[] = [];
  const ids = new Set<string>();
  const checkItem = (item: NavigationItem, where: string) => {
    const label = (item.label ?? "").trim();
    if (!label) out.push({ where, message: "Give the link a name." });
    else if (label.length > NAV_LIMITS.label) out.push({ where, message: `Keep the name under ${NAV_LIMITS.label} characters.` });
    const p = destinationProblem(item.href);
    if (p) out.push({ where, message: p });
    if (!item.id) out.push({ where, message: "Link is missing its id." });
    else if (ids.has(item.id)) out.push({ where, message: "Two links share the same id." });
    else ids.add(item.id);
  };
  if (headerNav.length > NAV_LIMITS.headerItems) {
    out.push({ where: "Header", message: `The header fits at most ${NAV_LIMITS.headerItems} links.` });
  }
  headerNav.forEach((item, i) => checkItem(item, `Header link ${i + 1}${item.label ? ` (“${item.label}”)` : ""}`));
  if (footerColumns.length > NAV_LIMITS.footerColumns) {
    out.push({ where: "Footer", message: `The footer fits at most ${NAV_LIMITS.footerColumns} columns.` });
  }
  footerColumns.forEach((col, ci) => {
    const where = `Footer column ${ci + 1}${col.title ? ` (“${col.title}”)` : ""}`;
    const title = (col.title ?? "").trim();
    if (!title) out.push({ where, message: "Give the column a heading." });
    else if (title.length > NAV_LIMITS.columnTitle) out.push({ where, message: `Keep the heading under ${NAV_LIMITS.columnTitle} characters.` });
    if (!col.id) out.push({ where, message: "Column is missing its id." });
    else if (ids.has(col.id)) out.push({ where, message: "Two columns share the same id." });
    else ids.add(col.id);
    if (col.links.length > NAV_LIMITS.footerLinksPerColumn) {
      out.push({ where, message: `A column fits at most ${NAV_LIMITS.footerLinksPerColumn} links.` });
    }
    col.links.forEach((l, li) => checkItem(l, `${where}, link ${li + 1}`));
  });
  return out;
}

/**
 * A non-blocking hint when a store address points at a collection or page that does not exist or is not public yet.
 * Pages that are not public are hidden from customers automatically, so the link simply does not appear.
 */
export function destinationHint(
  href: string,
  collections: { slug: string }[],
  pages: { slug: string; is_published: boolean }[],
): string | null {
  const c = href.match(/^\/collections\/([^/?#]+)/);
  if (c && c[1] !== "all" && !collections.some((x) => x.slug === c[1])) {
    return "No collection has this address yet; customers would see “not found”.";
  }
  const p = href.match(/^\/pages\/([^/?#]+)/);
  if (p) {
    const page = pages.find((x) => x.slug === p[1]);
    if (!page) return "No page has this address yet; the link stays hidden from customers.";
    if (!page.is_published) return "This page is not published; the link stays hidden from customers until it is.";
  }
  return null;
}

/** A fresh id for a link or column added in the editor. */
export function newNavId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

/**
 * Rough width (px) of the desktop header links: 15px text ≈ 8px per character, 24px padding, 44px for a NEW badge,
 * 2px gap (calibrated on the storefront at 1180px). Used only to warn; the storefront itself never lets the menu push
 * search, compare or cart off the screen.
 */
export function estimateHeaderWidth(items: Pick<NavigationItem, "label" | "isNew">[]): number {
  return items.reduce((w, i) => w + 26 + Math.ceil((i.label ?? "").trim().length * 8) + (i.isNew ? 44 : 0), 0);
}

/** The approved V5 header (with Guides) fills the row on a 1180px laptop screen; wider menus may be cut off there. */
export const V5_HEADER_WIDTH = estimateHeaderWidth(DEFAULT_HEADER_NAV);
