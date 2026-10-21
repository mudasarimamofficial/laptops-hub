import DOMPurify from "isomorphic-dompurify";

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
];

const ALLOWED_ATTR = ["href", "title", "target", "rel"];

/** Legal/business policy slugs — require owner/manager legal_approved, not editor publish alone. */
export const LEGAL_CONTENT_SLUGS = new Set([
  "shipping",
  "returns",
  "warranty",
  "privacy",
  "terms",
]);

/**
 * Allowlist HTML sanitizer for CMS bodies rendered on the storefront.
 * Strips scripts, event handlers, unsafe protocols, and unknown tags.
 */
export function sanitizeCmsHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
    ADD_ATTR: ["target", "rel"],
  });

  // DOMPurify may strip target; always force safe rel on remaining anchors.
  return clean.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    let next = attrs.replace(/\brel\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").trimEnd();
    next += ' rel="noopener noreferrer"';
    return `<a${next}>`;
  });
}
