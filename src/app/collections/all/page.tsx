import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";
import { canonicalFor, robotsFor } from "@/lib/site-url";

export const revalidate = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filtered = Object.keys(await searchParams).some((k) => k !== "page");
  return { title: "All products", alternates: canonicalFor("/collections/all"), robots: robotsFor(filtered) };
}

export default async function AllProductsPage({ searchParams }: Props) {
  return <CollectionPage id="all" searchParams={await searchParams} />;
}
