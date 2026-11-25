import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ogDefaults } from "@/lib/seo/og";
import { CollectionPage } from "@/components/storefront/collection-page";
import { V5_COLS } from "@/lib/catalog/v5";
import { getCollectionSeo, getStorefrontCollection } from "@/lib/collections/storefront";
import { canonicalFor, robotsFor } from "@/lib/site-url";

export const revalidate = 60;

/** Default collection description: the collection's own name plus facts true of every listing (no stock or price claims). */
function collectionDescription(name: string) {
  return `${name} at Laptops HUB, Bahawalpur, Pakistan. Every listing shows the processor, memory, storage and display, with prices in PKR.`;
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = V5_COLS[slug];
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  if (!col) {
    const custom = await getStorefrontCollection(slug);
    if (!custom) return { title: "Not found" };
    const title = custom.seoTitle || custom.title;
    const description = custom.seoDescription || custom.description || collectionDescription(custom.title);
    return {
      title,
      description,
      alternates: canonicalFor(`/collections/${slug}`),
      robots: robotsFor(filtered),
      openGraph: { ...(await ogDefaults()), type: "website", url: `/collections/${slug}`, title, description },
    };
  }
  // Built-in collection: search fields saved on a matching Admin → Collections row win; else factual defaults.
  const seo = col.hidden ? null : await getCollectionSeo(slug).catch(() => null);
  const path = `/collections/${col.hidden ? "all" : slug}`;
  const title = seo?.seoTitle || col.t;
  const description = seo?.seoDescription || seo?.description || collectionDescription(col.t);
  return {
    title,
    description,
    alternates: canonicalFor(path),
    // Filter/sort permutations stay crawlable for users but are not indexed as separate pages.
    robots: robotsFor(filtered || !!col.hidden),
    openGraph: { ...(await ogDefaults()), type: "website", url: path, title, description },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  if (V5_COLS[slug]) return <CollectionPage id={slug} searchParams={await searchParams} />;
  // Merchant-made collections (Admin → Collections) use the same V5 page.
  const custom = await getStorefrontCollection(slug);
  if (!custom) notFound();
  return <CollectionPage custom={custom} searchParams={await searchParams} />;
}
