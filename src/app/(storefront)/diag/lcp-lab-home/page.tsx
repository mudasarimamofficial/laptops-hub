import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePageView } from "@/components/storefront/home/home-page-view";
import { isLcpLabEnabled } from "@/lib/diag/lcp-lab-gate";
import { getPublishedHomepageSections } from "@/lib/content/published-homepage";
import { normalizeHomepageLayout } from "@/lib/content/homepage-layout";
import type { SectionInstance, SectionType } from "@/lib/content/site-builder-schema";

export const metadata: Metadata = {
  title: "LCP lab homepage sections",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ only?: string; disableAfter?: string }> };

/**
 * Binary-search homepage sections while keeping real storefront chrome + @after.
 * Example: /diag/lcp-lab-home?only=v5_cinematic_hero
 *          /diag/lcp-lab-home?only=v5_cinematic_hero,v5_product_story
 */
export default async function LcpLabHomePage({ searchParams }: Props) {
  if (!isLcpLabEnabled()) notFound();
  const { only } = await searchParams;
  const published = await getPublishedHomepageSections();
  const base = normalizeHomepageLayout(published);
  let sections: SectionInstance[] = base;
  if (only && only.trim()) {
    const allow = new Set(only.split(",").map((s) => s.trim()).filter(Boolean) as SectionType[]);
    sections = base.map((s) => ({ ...s, enabled: allow.has(s.type) }));
  }
  // No diagnostic banner above the hero — a preceding text node can win FCP and
  // interact with cinematic-hero candidacy during isolation runs.
  return <HomePageView sections={sections} />;
}
