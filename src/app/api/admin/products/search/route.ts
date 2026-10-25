import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

export async function GET(request: Request) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (q.length < 2) {
      return NextResponse.json({ products: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, handle, title, status")
      .or(`title.ilike.%${q}%,handle.ilike.%${q}%`)
      .order("title")
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
