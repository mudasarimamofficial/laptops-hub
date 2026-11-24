import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBar } from "@/components/storefront/home/preview-bar";
import { ProductPageView } from "@/components/storefront/product/product-page-view";
import { getV5Catalog } from "@/lib/catalog/v5";
import { loadHomepagePreview, publishedThemesEnabled } from "@/lib/content/homepage-preview-server";
import { globalsFromThemeSettings, themeGlobals } from "@/lib/content/theme-globals";
import { layoutFromThemeSettings, themeLayout } from "@/lib/content/theme-layout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Product page preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Staff-only product page preview: a real public listing rendered by the live product template with the theme's
 * draft (default), published or V5-default copy and layout. `?v=draft|published|default`. Anyone who is not
 * owner/admin/editor gets a plain 404; the response is never cached (next.config.ts `/preview/:path*` headers).
 * Cart and checkout on this page are the real ones: it previews presentation only.
 */
export default async function ProductPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ v?: string; embed?: string }>;
}) {
  const [{ handle }, { v, embed }] = await Promise.all([params, searchParams]);
  const src = await loadHomepagePreview(v);
  if (!src) notFound();
  const P = await getV5Catalog();
  const p = P.find((x) => x.h === handle);
  if (!p) notFound();
  const tc = themeGlobals(globalsFromThemeSettings(src.themeSettings));
  const layout = themeLayout(layoutFromThemeSettings(src.themeSettings));
  return (
    <>
      {embed === "1" ? null : (
        <PreviewBar
          src={src}
          flagOn={publishedThemesEnabled()}
          kind="product"
          title="Product page"
          basePath={`/preview/product/${encodeURIComponent(p.h)}`}
        />
      )}
      <ProductPageView P={P} p={p} tc={tc} layout={layout.product} />
    </>
  );
}
