import { isCrossSite } from "@/lib/validation/contact";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * G47 — one cross-site check for every admin write API. Browsers always send `Origin` on cross-site POST/PUT/PATCH/
 * DELETE; a request whose Origin is another site is refused before any route code runs (so before the session is read
 * or any data changes). Requests without Origin (server-to-server tools, tests) are left to the route's own staff
 * check, exactly as before. Same-site admin pages are unaffected.
 */
export function isCrossSiteAdminWrite(input: {
  method: string;
  pathname: string;
  origin: string | null;
  url: string;
  host?: string | null;
}): boolean {
  if (!input.pathname.startsWith("/api/admin/")) return false;
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  return isCrossSite(input.origin, input.url, input.host);
}
