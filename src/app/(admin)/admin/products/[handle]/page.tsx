import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDangerZone } from "@/components/admin/product-danger-zone";
import { ProductEditForm } from "@/components/admin/product-edit-form";
import { ProductMediaManager } from "@/components/admin/product-media-manager";
import { ProductVariantMatrix } from "@/components/admin/product-variant-matrix";
import { ProductSpecsForm } from "@/components/admin/product-specs-form";
import { specEditFromStored } from "@/lib/catalog/spec-edit";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import type { OptionValuesMap } from "@/lib/catalog/variant-matrix";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ handle: string }> };

export default async function AdminProductEditPage({ params }: Props) {
  const staff = await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const { handle } = await params;
  const supabase = createServiceClient();
  const full = await supabase
    .from("products")
    .select(
      "handle, title, description_safe, status, featured, manufacturer, product_type, category, media_approval, seo_title, seo_description, specs, option_names, product_variants(id, title, sku, barcode, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, purchasable, option_values, position, allow_oversell, media_id), product_media(id, url, alt, position, approval, origin, rights_note)",
    )
    .eq("handle", handle)
    .maybeSingle();

  // Pre-migration fallback (Production schema without option_names / barcode)
  let data = full.error ? null : full.data;
  if (!data) {
    const fallback = await supabase
      .from("products")
      .select(
        "handle, title, description_safe, status, featured, manufacturer, product_type, category, media_approval, seo_title, seo_description, specs, product_variants(id, title, sku, price_paisa, inventory_mode, quantity_on_hand, purchasable, option_values), product_media(id, url, alt, position, approval)",
      )
      .eq("handle", handle)
      .maybeSingle();
    if (fallback.error || !fallback.data) notFound();
    data = fallback.data as typeof full.data;
  }

  if (!data) notFound();

  const variants = (
    (data.product_variants as {
      id: string;
      title: string;
      sku: string | null;
      barcode?: string | null;
      price_paisa: number;
      compare_at_paisa?: number | null;
      inventory_mode?: string;
      quantity_on_hand?: number | null;
      purchasable?: boolean;
      option_values?: OptionValuesMap;
      position?: number;
      allow_oversell?: boolean;
    }[]) || []
  )
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((v) => ({
      id: v.id,
      title: v.title || "Default",
      sku: v.sku,
      barcode: v.barcode ?? null,
      pricePaisa: v.price_paisa,
      compareAtPaisa: v.compare_at_paisa ?? null,
      inventoryMode: (v.inventory_mode === "tracked" ? "tracked" : "untracked") as "tracked" | "untracked",
      quantityOnHand: v.quantity_on_hand ?? null,
      purchasable: v.purchasable !== false,
      optionValues: (v.option_values || {}) as OptionValuesMap,
      position: v.position,
      allowOversell: v.allow_oversell === true,
    }));

  if (!variants.length) notFound();

  const optionNames = Array.isArray((data as { option_names?: string[] }).option_names)
    ? ((data as { option_names?: string[] }).option_names as string[])
    : [];

  // Which options (variants) use each image as their picture: such an image cannot be removed until changed.
  const usedBy = new Map<string, string[]>();
  for (const v of (data.product_variants as { title?: string | null; media_id?: string | null }[]) || []) {
    if (v.media_id) usedBy.set(v.media_id, [...(usedBy.get(v.media_id) || []), v.title || "Default"]);
  }
  const media = (
    (data.product_media as { id: string; url: string; alt: string; position: number; approval?: string; origin?: string; rights_note?: string | null }[]) || []
  )
    .map((m) => ({ ...m, usedByVariants: usedBy.get(m.id) || [] }))
    .sort((a, b) => a.position - b.position);

  return (
    <>
      <AdminPageHeader
        title={data.title}
        description={`Handle ${data.handle} · media rights ${data.media_approval || "pending"}`}
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: data.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={data.status} />
            <Link
              href={`/products/${data.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[var(--adm-action)] hover:underline"
            >
              View on storefront
            </Link>
          </div>
        }
      />

      <ProductEditForm
        handle={data.handle}
        title={data.title}
        descriptionSafe={data.description_safe || ""}
        status={data.status as "draft" | "active" | "archived"}
        featured={!!data.featured}
        manufacturer={data.manufacturer}
        productType={data.product_type}
        category={data.category}
        seoTitle={data.seo_title}
        seoDescription={data.seo_description}
        variants={variants}
      />

      <ProductSpecsForm handle={data.handle} initial={specEditFromStored(data.specs as Record<string, unknown> | null)} />

      <ProductVariantMatrix
        handle={data.handle}
        optionNames={optionNames}
        variants={variants}
        canSetOversell={staff.role === "owner" || staff.role === "admin"}
      />

      <ProductMediaManager
        handle={data.handle}
        productTitle={data.title}
        initialMedia={media}
        canConfirmRights={staff.role === "owner" || staff.role === "admin"}
      />

      <ProductDangerZone handle={data.handle} title={data.title} status={data.status} />
    </>
  );
}
