import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getV5Catalog } from "@/lib/catalog/v5";
import { canonicalFor, siteUrl } from "@/lib/site-url";
import { productSeoFromV5 } from "@/lib/seo/product-meta";
import { getPublishedThemeGlobals, getPublishedThemeLayout } from "@/lib/content/published-homepage";
import { ProductPageView } from "@/components/storefront/product/product-page-view";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }> };

/** Public products only: drafts and archived listings are never in the catalog, so they 404. */
export async function load(handle: string) {
  const P = await getV5Catalog();
  const p = P.find((x) => x.h === handle);
  return p ? { P, p } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const r = await load(handle).catch(() => null);
  if (!r) return { title: "Product not found", robots: { index: false } };
  const { p } = r;
  const seo = productSeoFromV5(p);
  return {
    title: seo.title,
    description: seo.description,
    alternates: canonicalFor(`/products/${p.h}`),
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: p.imgs[0] ? [{ url: p.imgs[0].u }] : undefined,
      type: "website",
      url: `${siteUrl()}/products/${p.h}`,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: p.imgs[0] ? [p.imgs[0].u] : undefined,
    },
  };
}

/** Port of the V5 product template (`isProduct`); layout and copy from the published theme. */
export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const [r, tc, layout] = await Promise.all([load(handle), getPublishedThemeGlobals(), getPublishedThemeLayout()]);
  if (!r) notFound();
  return <ProductPageView P={r.P} p={r.p} tc={tc} layout={layout.product} />;
}
