import { NextResponse } from "next/server";
import { listCompareSummaries } from "@/lib/catalog/queries";
import { COMPARE_LIMIT, parseCompareHandles } from "@/lib/catalog/handles";

export async function GET(request: Request) {
  const requested = parseCompareHandles(new URL(request.url).searchParams.get("handles"), COMPARE_LIMIT);
  if (!requested.length) {
    return NextResponse.json({ items: [], requested: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const items = await listCompareSummaries(requested);
    return NextResponse.json(
      { items, requested },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
