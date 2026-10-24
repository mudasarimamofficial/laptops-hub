/**
 * Public-link rules for CMS content (pure; see src/lib/content/pages.ts). A link to /pages/<slug> or /guides[/<slug>]
 * is shown only when that page is public; every other link is unaffected.
 */
export type Visibility = { pages: Record<string, boolean>; articles: Record<string, boolean> };

/** Policies that must be public before COD orders are accepted (customers consent to them at checkout). */
export const MANDATORY_POLICY_SLUGS = ["shipping", "returns", "warranty", "privacy", "terms"] as const;

/** Help destinations in order of preference for the header "Support" link and the "Help" breadcrumb. */
const SUPPORT_ORDER = ["/pages/faq", "/pages/contact", "/pages/order-inquiries"] as const;
const SUPPORT_FALLBACK = "/track-order";

export function isLinkPublic(href: string, vis: Visibility): boolean {
  const page = href.match(/^\/pages\/([^/?#]+)/);
  if (page) return !!vis.pages[page[1]];
  const article = href.match(/^\/guides\/([^/?#]+)/);
  if (article) return !!vis.articles[article[1]];
  if (/^\/guides\/?(?:[?#]|$)/.test(href)) return Object.values(vis.articles).some(Boolean);
  return true;
}

export function publicLinks<T extends { href: string }>(links: T[], vis: Visibility): T[] {
  return links.filter((l) => isLinkPublic(l.href, vis));
}

export function supportHref(vis: Visibility): string {
  return SUPPORT_ORDER.find((h) => isLinkPublic(h, vis)) ?? SUPPORT_FALLBACK;
}

/** In published CMS copy, a link to content that is not public becomes plain text (never a link to a 404). */
export function unlinkUnpublished(html: string, vis: Visibility): string {
  return html.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (whole, href: string, inner: string) =>
    href.startsWith("/") && !isLinkPublic(href, vis) ? inner : whole,
  );
}

export function mandatoryPoliciesPublic(vis: Visibility): boolean {
  return MANDATORY_POLICY_SLUGS.every((s) => vis.pages[s]);
}
