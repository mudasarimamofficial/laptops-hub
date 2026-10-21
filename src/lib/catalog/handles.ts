/** Same format as the products_handle_format DB constraint. */
export const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COMPARE_LIMIT = 4;

export function isValidHandle(h: unknown): h is string {
  return typeof h === "string" && h.length > 0 && h.length <= 200 && HANDLE_RE.test(h);
}

/** Parse "a,b,c" into unique valid handles, preserving order, capped at `max`. */
export function parseCompareHandles(raw: string | null | undefined, max = COMPARE_LIMIT): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const h = part.trim();
    if (isValidHandle(h) && !out.includes(h)) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}
