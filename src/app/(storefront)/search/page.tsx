import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = String((await searchParams).q || "").trim();
  return { title: q ? `Results for “${q}”` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = String(Array.isArray(sp.q) ? sp.q[0] : sp.q || "")
    .trim()
    .slice(0, 120);
  return <CollectionPage q={q} searchParams={sp} />;
}
