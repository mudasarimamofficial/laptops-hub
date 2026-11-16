import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getGuidesIndex } from "@/lib/content/pages";
import { canonicalFor, robotsFor } from "@/lib/site-url";

// The index is public once any guide is; checked on every request.
export const dynamic = "force-dynamic";

async function load() {
  const page = await getGuidesIndex(true);
  return page.mode !== "gated" || page.preview ? page : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await load();
  if (!page) return { title: "Not found", robots: { index: false } }; // overrides the layout default (Next adds its own noindex too)
  return { title: "Guides", description: page.intro, alternates: canonicalFor("/guides"), robots: robotsFor(page.preview) };
}

export default async function GuidesPage() {
  const page = await load();
  if (!page) notFound();
  return <ContentPage page={page} kind="guides" />;
}
