import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

/** Staff product picker (collections, badges): title / handle / SKU contains the text. Drafts included, deleted not. */
export async function GET(request: Request) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ products: [] }, { headers: { "Cache-Control": "no-store" } });
    // The text goes inside a double-quoted PostgREST value, where , . : ( ) are literal; quotes, backslashes and LIKE
    // wildcards are removed so the text can only ever be a plain "contains" match (no filter injection).
    const plain = q.replace(/["\\%_*]/g, " ").trim();
    if (plain.length < 2) return NextResponse.json({ products: [] }, { headers: { "Cache-Control": "no-store" } });
    const term = `"%${plain}%"`;
    const { data: bySku } = await supabase.from("product_variants").select("product_id").ilike("sku", `%${plain}%`).limit(20);
    const skuIds = [...new Set((bySku || []).map((r) => r.product_id))];
    let query = supabase.from("products").select("id, title, handle, status").is("deleted_at", null);
    query = skuIds.length
      ? query.or(`title.ilike.${term},handle.ilike.${term},id.in.(${skuIds.join(",")})`)
      : query.or(`title.ilike.${term},handle.ilike.${term}`);
    const { data, error } = await query.order("title").limit(20);
    if (error) return NextResponse.json({ error: "search_failed", products: [] }, { status: 500 });
    return NextResponse.json({ products: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
