import type { SupabaseClient } from "@supabase/supabase-js";

type Jwks = { keys: { kid?: string; [k: string]: unknown }[] };

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { value: Jwks; at: number } | null = null;

/**
 * The project's public JWT signing keys, cached per server instance for 10 minutes. Supabase signs sessions with an
 * asymmetric key (ES256), so the signature can be checked locally instead of asking the Auth server on every request.
 * After a key rotation an unknown `kid` is not in this set and auth-js fetches the current keys itself.
 */
async function signingKeys(): Promise<Jwks | undefined> {
  if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.value;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const value = (await res.json()) as Jwks;
    if (!Array.isArray(value?.keys) || value.keys.length === 0) return undefined;
    jwksCache = { value, at: Date.now() };
    return value;
  } catch {
    return undefined;
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * The signed-in user from the session cookie, with the JWT's signature and expiry verified (`auth.getClaims`).
 * With asymmetric signing keys this needs no Auth-server round trip; with a symmetric (HS256) project auth-js falls back
 * to `getUser()`, so it is never less safe than before. An expired access token is refreshed by `getSession()` first.
 *
 * Revocation: a session signed out elsewhere still passes this check until its access token expires (default 1 hour),
 * so use it only as a coarse gate (middleware). Authorisation decisions use requireStaff(), which asks the Auth server.
 */
export async function verifiedUser(supabase: SupabaseClient): Promise<VerifiedUser | null> {
  // No session cookie (most storefront visitors): nothing to verify and no network request at all.
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) return null;
  const jwks = await signingKeys();
  const { data, error } = await supabase.auth.getClaims(token, jwks ? { jwks: jwks as never } : undefined);
  if (error || !data?.claims) return null;
  const c = data.claims as { sub?: string; email?: string; role?: string; is_anonymous?: boolean };
  if (!c.sub || c.role !== "authenticated" || c.is_anonymous) return null;
  return { id: c.sub, email: c.email ?? null };
}
