import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

/** Approved product media + merchant CMS uploads for pickers (blog cover, etc.). */
export async function GET(request: Request) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const [cms, products] = await Promise.all([
      supabase
        .from("cms_media_assets")
        .select("id, public_url, alt, created_at")
        .order("created_at", { ascending: false })
        .limit(48),
      supabase
        .from("product_media")
        .select("id, url, alt, products(title, handle)")
        .eq("approval", "approved")
        .order("created_at", { ascending: false })
        .limit(48),
    ]);

    if (cms.error && !cms.error.message.includes("cms_media_assets")) {
      return NextResponse.json({ error: "database_error", message: "Media library could not be loaded." }, { status: 500 });
    }
    if (products.error) {
      return NextResponse.json({ error: "database_error", message: "Media library could not be loaded." }, { status: 500 });
    }

    const cmsItems = (cms.data || []).map((row) => ({
      id: `cms:${row.id}`,
      url: row.public_url as string,
      alt: (row.alt as string) || null,
      label: "Uploaded",
      source: "cms" as const,
    }));

    const productItems = (products.data || []).map((row) => {
      const raw = row.products as unknown;
      const product = (Array.isArray(raw) ? raw[0] : raw) as { title?: string; handle?: string } | null;
      return {
        id: `product:${row.id}`,
        url: row.url as string,
        alt: (row.alt as string | null) || null,
        label: product?.title || product?.handle || "Product image",
        source: "product" as const,
      };
    });

    let items = [...cmsItems, ...productItems];
    if (q) {
      items = items.filter(
        (i) =>
          (i.label || "").toLowerCase().includes(q) ||
          (i.alt || "").toLowerCase().includes(q) ||
          i.url.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
