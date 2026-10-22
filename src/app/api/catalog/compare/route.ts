import { NextResponse } from "next/server";
import { getV5Catalog, v5CompareCol } from "@/lib/catalog/v5";
import { COMPARE_LIMIT, parseCompareHandles } from "@/lib/catalog/handles";

/** V5 compare table data for up to four public handles; unknown, draft or archived handles are omitted. */
export async function GET(request: Request) {
  const requested = parseCompareHandles(new URL(request.url).searchParams.get("handles"), COMPARE_LIMIT);
  if (!requested.length) return NextResponse.json({ cols: [], requested: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const P = await getV5Catalog();
    const cols = requested.map((h) => P.find((p) => p.h === h)).filter((p) => !!p).map((p) => v5CompareCol(p!));
    return NextResponse.json({ cols, requested }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
