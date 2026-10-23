import { NextResponse } from "next/server";
import { getV5Catalog, v5Search, v5SearchHit } from "@/lib/catalog/v5";

/** V5 search overlay: token match over the public catalog, catalog order, first `limit` hits plus the total. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 6) || 6, 1), 24);
  if (!q) return NextResponse.json({ results: [], total: 0 });

  const hits = v5Search(await getV5Catalog(), q);
  return NextResponse.json(
    { results: hits.slice(0, limit).map(v5SearchHit), total: hits.length },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
