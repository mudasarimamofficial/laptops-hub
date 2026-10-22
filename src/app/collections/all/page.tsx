import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const revalidate = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filtered = Object.keys(await searchParams).some((k) => k !== "page");
  return { title: "All products", alternates: { canonical: "/collections/all" }, robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function AllProductsPage({ searchParams }: Props) {
  return <CollectionPage id="all" searchParams={await searchParams} />;
}
