import { NextResponse } from "next/server";
import { getV5Catalog } from "@/lib/catalog/v5";
import { COMPARE_LIMIT, parseCompareHandles } from "@/lib/catalog/handles";

export async function GET(request: Request) {
  const requested = parseCompareHandles(new URL(request.url).searchParams.get("handles"), COMPARE_LIMIT);
  if (!requested.length) {
    return NextResponse.json({ items: [], requested: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    // Served from the cached public catalog: drafts/archived handles are absent and get pruned by the tray.
    const P = await getV5Catalog();
    const items = requested.flatMap((h) => {
      const p = P.find((x) => x.h === h);
      return p ? [{ handle: p.h, title: p.t, model: p.model, imageUrl: p.imgs[0]?.u ?? null, imageAlt: p.imgs[0]?.a || p.t }] : [];
    });
    return NextResponse.json(
      { items, requested },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
