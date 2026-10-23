import { NextResponse } from "next/server";
import { filterPublicProducts } from "@/lib/catalog/queries";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(url.searchParams.get("limit") || 8) || 8, 24);
  if (!q) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const page = await filterPublicProducts({ q, limit, offset: 0, sort: "title" });
  const products = page.products.map((p) => {
    const model = String(p.specs.model || p.title.split(" - ")[0] || p.title);
    const config = String(
      p.specs.config ||
        [p.specs.cpu || p.specs.processor, p.specs.ram, p.specs.storage || p.specs.sto]
          .filter(Boolean)
          .join(" · ") ||
        p.title,
    );
    return {
      handle: p.handle,
      title: p.title,
      model,
      config,
      pricePaisa: p.pricePaisa,
      imageUrl: p.images[0]?.url,
    };
  });

  return NextResponse.json(
    { products, total: page.total },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
