import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getGuidesIndex } from "@/lib/content/pages";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getGuidesIndex();
  return {
    title: "Guides",
    description: page.mode === "gated" ? undefined : page.intro,
    alternates: { canonical: "/guides" },
    robots: page.mode === "gated" || page.preview ? { index: false, follow: true } : undefined,
  };
}

export default async function GuidesPage() {
  return <ContentPage page={await getGuidesIndex()} kind="guides" />;
}
