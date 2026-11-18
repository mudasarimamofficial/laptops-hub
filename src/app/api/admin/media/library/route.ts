import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

/** Approved product media references for CMS pickers (blog cover, etc.). */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { data, error } = await supabase
      .from("product_media")
      .select("id, url, alt, products(title, handle)")
      .eq("approval", "approved")
      .order("created_at", { ascending: false })
      .limit(48);
    if (error) {
      return NextResponse.json({ error: "database_error", message: "Media library could not be loaded." }, { status: 500 });
    }
    const items = (data || []).map((row) => {
      const raw = row.products as unknown;
      const product = (Array.isArray(raw) ? raw[0] : raw) as { title?: string; handle?: string } | null;
      return {
        id: row.id as string,
        url: row.url as string,
        alt: (row.alt as string | null) || null,
        label: product?.title || product?.handle || undefined,
      };
    });
    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
