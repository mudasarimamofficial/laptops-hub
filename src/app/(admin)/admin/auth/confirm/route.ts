import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RESET_PASSWORD_PATH } from "@/lib/auth/recovery";

/**
 * Landing point of the password-recovery email. Accepts the recommended `token_hash` link (works on any device) and
 * the default-template PKCE `code` link (same browser that requested it). Only recovery links are accepted, and the
 * destination is fixed — query parameters cannot redirect elsewhere.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // The session cookies must travel on the redirect response itself, so collect them here.
  const pending: { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        pending.push(...cookies);
      },
    },
  });

  let ok = false;
  if (tokenHash && type === "recovery") {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  // Relative Location: the browser stays on the exact host it arrived on, where the session cookie was set.
  const res = new NextResponse(null, {
    status: 303,
    headers: {
      Location: ok ? RESET_PASSWORD_PATH : "/admin/forgot-password?link=invalid",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);
  return res;
}
