import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";
import { V5_COLS } from "@/lib/catalog/v5";
import { canonicalFor, robotsFor } from "@/lib/site-url";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = V5_COLS[slug];
  if (!col) return { title: "Not found" };
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: col.t,
    alternates: canonicalFor(`/collections/${col.hidden ? "all" : slug}`),
    // Filter/sort permutations stay crawlable for users but are not indexed as separate pages.
    robots: robotsFor(filtered || !!col.hidden),
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!V5_COLS[slug]) notFound();
  return <CollectionPage id={slug} searchParams={await searchParams} />;
}
