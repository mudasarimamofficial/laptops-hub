import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
  "span",
  // Native, keyboard-accessible FAQ accordion (no attributes allowed).
  "details",
  "summary",
];

/** Legal/business policy slugs — require owner/manager legal_approved, not editor publish alone. */
export const LEGAL_CONTENT_SLUGS = new Set([
  "shipping",
  "returns",
  "warranty",
  "privacy",
  "terms",
]);

/** http(s), mailto, tel, site-relative or in-page links only. */
const SAFE_HREF = /^(?:(?:https?|mailto|tel):|\/(?!\/)|#)/i;

/**
 * Allowlist HTML sanitizer for CMS bodies rendered on the storefront.
 * Strips scripts, event handlers, unsafe protocols, and unknown tags.
 *
 * Uses sanitize-html (htmlparser2, no DOM): the previous isomorphic-dompurify/jsdom setup failed to load in the
 * Vercel Node runtime (ERR_REQUIRE_ESM), which broke every server render that sanitized content.
 */
export function sanitizeCmsHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    // Drop the contents of dangerous elements entirely (not just their tags).
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math"],
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs.href && SAFE_HREF.test(attribs.href.trim())) out.href = attribs.href.trim();
        if (attribs.title) out.title = attribs.title;
        if (attribs.target === "_blank") out.target = "_blank";
        // Always force a safe rel on links.
        out.rel = "noopener noreferrer";
        return { tagName, attribs: out };
      },
    },
  });
}
