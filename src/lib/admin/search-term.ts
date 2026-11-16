/**
 * Free-text admin search term made safe for a PostgREST `or=(…ilike…)` filter: characters that PostgREST reads as
 * list/grouping syntax (, ( ) " \) or as LIKE wildcards (% * _) are replaced by spaces (dots are fine: PostgREST
 * splits column.operator.value on the first two dots only), whitespace is collapsed and the
 * term is capped. Without this, a term such as "a,status.eq.draft" changes the filter instead of being searched for
 * (and "(" or "," makes the query fail).
 */
export function adminSearchTerm(raw: unknown, max = 60): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[,()"\\%*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * Digits for matching orders.customer_phone_normalized (the 10-digit national number, e.g. 3001234567): "0300 1234567"
 * and "+92 300 1234567" both become 3001234567. Null when too short to be meaningful.
 */
export function phoneDigits(raw: string, min = 4): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < min) return null;
  return d.length > 10 ? d.slice(-10) : d;
}

/** Response of GET /api/admin/search (identifiers and statuses only). */
export type AdminSearchResult = {
  products: { handle: string; title: string; status: string; sku: string | null }[];
  orders: { orderNumber: string; status: string; paymentStatus: string; totalDuePaisa: number }[];
};
