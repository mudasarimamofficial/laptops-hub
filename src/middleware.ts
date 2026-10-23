import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { prelaunchDecision } from "@/lib/prelaunch";
import { siteMode } from "@/lib/site-url";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (siteMode() === "restricted") {
    const decision = prelaunchDecision(pathname, searchParams);
    if (decision === "blockApi") {
      return NextResponse.json(
        { error: "prelaunch", message: "Laptops HUB is preparing to launch. Online ordering is not available yet." },
        { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
      );
    }
    if (decision === "blockImage") {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (decision === "comingSoon") {
      const url = request.nextUrl.clone();
      url.pathname = "/coming-soon";
      url.search = "";
      return NextResponse.rewrite(url, { headers: { "Cache-Control": "no-store" } });
    }
  }

  // The image optimiser only needs the gate above; skip the session refresh for it.
  if (pathname === "/_next/image") return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    // _next/image is matched so restricted mode can refuse remote catalog photos.
    "/((?!_next/static|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
