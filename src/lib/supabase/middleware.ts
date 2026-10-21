import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh + coarse /admin gate.
 * NOT sufficient alone — every privileged page/API must call requireStaff().
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith("/order/success")) {
    supabaseResponse.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    supabaseResponse.headers.set("Referrer-Policy", "no-referrer");
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  if (!path.startsWith("/admin")) {
    return supabaseResponse;
  }

  const isLogin = path.startsWith("/admin/login");
  const isForbidden = path.startsWith("/admin/forbidden");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (user && !isLogin && !isForbidden) {
    const { data: membership } = await supabase
      .from("admin_memberships")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/forbidden";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
