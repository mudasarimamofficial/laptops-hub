import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { productsToShopifyModernCsv, type ExportProduct } from "@/lib/catalog/shopify-export";

export const dynamic = "force-dynamic";

/**
 * Streaming-friendly Shopify modern CSV export for staff.
 * Caps at 2000 products per request; use filters for larger catalogs later.
 */
export async function GET(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "shopify_modern";
    const status = url.searchParams.get("status");
    const handlesParam = url.searchParams.get("handles");

    if (format !== "shopify_modern") {
      return Response.json(
        { error: "unsupported_format", message: "Currently supported: shopify_modern. Legacy and LH extended follow." },
        { status: 400 },
      );
    }

    let query = supabase
      .from("products")
      .select(
        "handle, title, description_safe, merchant_vendor, manufacturer, product_type, category, status, tags, seo_title, seo_description, product_variants(title, sku, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, option_values), product_media(url, alt, position)",
      )
      .order("title")
      .limit(2000);

    if (status && status !== "all") query = query.eq("status", status);
    if (handlesParam) {
      const handles = handlesParam
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .slice(0, 500);
      if (handles.length) query = query.in("handle", handles);
    }

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const csv = productsToShopifyModernCsv((data || []) as unknown as ExportProduct[]);

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "products.export",
      entity_type: "products",
      after: { format, count: data?.length ?? 0, status },
    });

    const filename = `laptops-hub-products-shopify-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
