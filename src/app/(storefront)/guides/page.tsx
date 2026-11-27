import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getGuidesIndex } from "@/lib/content/pages";
import { hasGuideFilter, parseGuideFilter } from "@/lib/content/blog";
import { canonicalFor, robotsFor } from "@/lib/site-url";

// The index is public once any guide is; checked on every request.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load() {
  const page = await getGuidesIndex(true);
  return page.mode !== "gated" || page.preview ? page : null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = await load();
  if (!page) return { title: "Not found", robots: { index: false } }; // overrides the layout default (Next adds its own noindex too)
  const filter = parseGuideFilter(await searchParams);
  if (hasGuideFilter(filter)) {
    // G18: category/tag views are navigation aids — not indexed, canonical stays /guides; links are still followed.
    const label = filter.category || `#${filter.tag}`;
    return { title: `Guides: ${label}`, description: page.intro, alternates: canonicalFor("/guides"), robots: { index: false, follow: true } };
  }
  return { title: "Guides", description: page.intro, alternates: canonicalFor("/guides"), robots: robotsFor(page.preview) };
}

export default async function GuidesPage({ searchParams }: Props) {
  const page = await load();
  if (!page) notFound();
  const filter = parseGuideFilter(await searchParams);
  return <ContentPage page={page} kind="guides" filter={filter} />;
}
