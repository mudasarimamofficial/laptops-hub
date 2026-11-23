/**
 * Safe customer-facing product name from brand + model/title parts.
 * Dedupes a leading brand already present in the model (case-insensitive, word-boundary).
 * Does not rewrite catalog rows — presentation only.
 */

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Escape a brand string for RegExp use. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * If `model` already starts with `brand` (ignoring case / extra spaces / common separators),
 * return the model alone; otherwise `Brand Model`.
 *
 * Examples:
 * - Dell + Dell Latitude 3440 → Dell Latitude 3440
 * - HP + EliteBook 840 → HP EliteBook 840
 * - ASUS + ASUS VivoBook 15 → ASUS VivoBook 15
 */
export function formatProductDisplayName(
  brand?: string | null,
  model?: string | null,
): string {
  const b = collapseWs(brand || "");
  const m = collapseWs(model || "");
  if (!b && !m) return "";
  if (!b) return m;
  if (!m) return b;

  // Model already begins with brand (+ optional punctuation/space).
  const leading = new RegExp(`^${escapeRegExp(b)}(?:[\\s\\-–—:/]*)`, "i");
  if (leading.test(m)) {
    return m;
  }

  // Brand is a multi-token prefix with different spacing (e.g. "Hewlett Packard" vs "HP").
  return `${b} ${m}`;
}

/**
 * Collapse accidental adjacent duplicate words ("Dell Dell Latitude" → "Dell Latitude").
 * Word-boundary, case-insensitive; leaves intentional non-adjacent repetition alone.
 */
export function collapseAdjacentDuplicateWords(text: string): string {
  const parts = collapseWs(text).split(" ");
  if (parts.length < 2) return collapseWs(text);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === part.toLowerCase()) continue;
    out.push(part);
  }
  return out.join(" ");
}

/** Brand · model · config style title without duplicating brand into model. */
export function formatProductSeoTitleParts(opts: {
  brand?: string | null;
  model?: string | null;
  title?: string | null;
  config?: string | null;
}): string {
  const display = formatProductDisplayName(opts.brand, opts.model || opts.title);
  const config = collapseWs(opts.config || "");
  const parts = [display, config].filter(Boolean);
  return collapseAdjacentDuplicateWords(parts.join(" · "));
}
