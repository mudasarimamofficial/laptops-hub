import { notFound, redirect } from "next/navigation";
import { getV5Catalog } from "@/lib/catalog/v5";
import { getStaffMembership } from "@/lib/auth/staff";
import { PREVIEW_ROLES, previewMode } from "@/lib/content/homepage-preview-server";

export const dynamic = "force-dynamic";

/**
 * Representative product for the theme editor's "Preview product page" link: the first in-stock public listing
 * (else the first listing). Staff only, like every /preview route; 404 when there is no public product.
 */
export default async function ProductPreviewIndex({ searchParams }: { searchParams: Promise<{ v?: string; embed?: string }> }) {
  const staff = await getStaffMembership();
  if (!staff || !PREVIEW_ROLES.includes(staff.role)) notFound();
  const P = await getV5Catalog();
  const p = P.find((x) => x.avail) ?? P[0];
  if (!p) notFound();
  const { v, embed } = await searchParams;
  redirect(`/preview/product/${encodeURIComponent(p.h)}?v=${previewMode(v)}${embed === "1" ? "&embed=1" : ""}`);
}
