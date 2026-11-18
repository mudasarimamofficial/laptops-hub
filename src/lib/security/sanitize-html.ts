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
  "hr",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "aside",
  // Native, keyboard-accessible FAQ accordion (no attributes allowed).
  "details",
  "summary",
];

const SAFE_IMG_SRC = /^(?:https:\/\/|\/(?!\/))/i;

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
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading"],
      aside: ["data-lh-block", "style"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    // Drop the contents of dangerous elements entirely (not just their tags).
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math"],
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs.href && SAFE_HREF.test(attribs.href.trim())) out.href = attribs.href.trim();
        if (attribs.title) out.title = attribs.title;
        if (attribs.target === "_blank") out.target = "_blank";
        // Always force a safe rel on links.
        out.rel = "noopener noreferrer";
        return { tagName: "a", attribs: out };
      },
      img: (_tagName, attribs) => {
        const src = (attribs.src || "").trim();
        if (!SAFE_IMG_SRC.test(src)) return { tagName: "span", attribs: {} };
        const out: Record<string, string> = { src, loading: "lazy" };
        if (attribs.alt) out.alt = attribs.alt;
        if (attribs.title) out.title = attribs.title;
        return { tagName: "img", attribs: out };
      },
      aside: (_tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs["data-lh-block"] === "callout") out["data-lh-block"] = "callout";
        // Allow only the known callout inline style string pattern (no urls).
        if (attribs.style && !/url\s*\(/i.test(attribs.style) && !/expression/i.test(attribs.style)) {
          out.style = attribs.style;
        }
        return { tagName: "aside", attribs: out };
      },
    },
  });
}
