import { createClient } from "@/lib/supabase/server";
import { isCrossSite } from "@/lib/validation/contact";

/**
 * Sign out of the admin on this device: ends the session server-side (Supabase refresh token revoked for this
 * session) and clears the auth cookies, then lands on the sign-in page. Works as a plain form POST (no JavaScript
 * needed). Cross-site posts are refused so another site cannot sign staff out.
 */
export async function POST(request: Request) {
  if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  return new Response(null, { status: 303, headers: { Location: "/admin/login?signed_out=1", "Cache-Control": "no-store" } });
}
