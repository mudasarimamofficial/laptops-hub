import { NextResponse } from "next/server";
import { getPublicProductByHandle } from "@/lib/catalog/queries";

export async function GET(request: Request) {
  const handle = new URL(request.url).searchParams.get("handle")?.trim();
  if (!handle) {
    return NextResponse.json({ error: "missing_handle" }, { status: 400 });
  }
  const product = await getPublicProductByHandle(handle);
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({
    product: {
      handle: product.handle,
      title: product.title,
      pricePaisa: product.pricePaisa,
      manufacturer: product.manufacturer,
      sku: product.sku,
      specs: product.specs,
    },
  });
}
