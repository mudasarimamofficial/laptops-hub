import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getArticle } from "@/lib/content/pages";
import { canonicalFor, robotsFor } from "@/lib/site-url";

// Publication is checked on every request (see src/lib/content/pages.ts).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const a = await getArticle(slug, true);
  return a && (a.mode !== "gated" || a.preview) ? a : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) return { title: "Not found", robots: { index: false } };
  return { title: a.title, description: a.intro, alternates: canonicalFor(`/guides/${slug}`), robots: robotsFor(a.preview) };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  return <ContentPage page={a} kind="article" />;
}
