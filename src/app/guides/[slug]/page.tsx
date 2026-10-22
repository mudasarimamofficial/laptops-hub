import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { ARTICLE_SLUGS, getArticle } from "@/lib/content/pages";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTICLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: "Not found", robots: { index: false } };
  return {
    title: a.title,
    description: a.mode === "gated" ? undefined : a.intro,
    alternates: { canonical: `/guides/${slug}` },
    robots: a.mode === "gated" || a.preview ? { index: false, follow: true } : undefined,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  return <ContentPage page={a} kind="article" />;
}
