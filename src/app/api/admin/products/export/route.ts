import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import {
  collectionMembershipToCsv,
  productsToInventoryCsv,
  productsToLhExtendedCsv,
  productsToShopifyLegacyCsv,
  productsToShopifyModernCsv,
  type ExportProduct,
} from "@/lib/catalog/shopify-export";

export const dynamic = "force-dynamic";

const FORMATS = ["shopify_modern", "shopify_legacy", "lh_extended", "inventory", "collections"] as const;

/**
 * Staff product/inventory/collection CSV export.
 * Caps at 2000 products per request.
 */
export async function GET(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "shopify_modern") as (typeof FORMATS)[number];
    const status = url.searchParams.get("status");
    const handlesParam = url.searchParams.get("handles");

    if (!FORMATS.includes(format)) {
      return Response.json(
        {
          error: "unsupported_format",
          message: `Supported: ${FORMATS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (format === "collections") {
      const { data, error } = await supabase
        .from("collection_products")
        .select("position, collections(slug, title), products(handle, title)")
        .order("position")
        .limit(10000);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      const rows = (data || []).map((row) => {
        const col = Array.isArray(row.collections) ? row.collections[0] : row.collections;
        const prod = Array.isArray(row.products) ? row.products[0] : row.products;
        return {
          collection_slug: (col as { slug?: string } | null)?.slug || "",
          collection_title: (col as { title?: string } | null)?.title || "",
          product_handle: (prod as { handle?: string } | null)?.handle || "",
          product_title: (prod as { title?: string } | null)?.title || "",
          position: row.position as number,
        };
      });
      const csv = collectionMembershipToCsv(rows);
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "products.export",
        entity_type: "collections",
        after: { format, count: rows.length },
      });
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="laptops-hub-collections-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    let query = supabase
      .from("products")
      .select(
        "handle, title, description_safe, merchant_vendor, manufacturer, product_type, category, status, tags, seo_title, seo_description, product_variants(title, sku, barcode, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, option_values, allow_oversell), product_media(url, alt, position)",
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
    if (error) {
      // Fallback without extended columns
      const fallback = await supabase
        .from("products")
        .select(
          "handle, title, description_safe, merchant_vendor, manufacturer, product_type, category, status, tags, seo_title, seo_description, product_variants(title, sku, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, option_values), product_media(url, alt, position)",
        )
        .order("title")
        .limit(2000);
      if (fallback.error) return Response.json({ error: fallback.error.message }, { status: 500 });
      return buildCsvResponse(format, (fallback.data || []) as unknown as ExportProduct[], staff.userId, supabase, status);
    }

    return buildCsvResponse(format, (data || []) as unknown as ExportProduct[], staff.userId, supabase, status);
  } catch (e) {
    return staffErrorResponse(e);
  }
}

async function buildCsvResponse(
  format: (typeof FORMATS)[number],
  products: ExportProduct[],
  actorUserId: string,
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  status: string | null,
) {
  let csv: string;
  let suffix: string;
  switch (format) {
    case "shopify_legacy":
      csv = productsToShopifyLegacyCsv(products);
      suffix = "shopify-legacy";
      break;
    case "lh_extended":
      csv = productsToLhExtendedCsv(products);
      suffix = "lh-extended";
      break;
    case "inventory":
      csv = productsToInventoryCsv(products);
      suffix = "inventory";
      break;
    default:
      csv = productsToShopifyModernCsv(products);
      suffix = "shopify";
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    action: "products.export",
    entity_type: "products",
    after: { format, count: products.length, status },
  });

  const filename = `laptops-hub-products-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
