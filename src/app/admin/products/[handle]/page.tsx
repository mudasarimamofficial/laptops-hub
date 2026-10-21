import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { ProductEditForm } from "@/components/admin/product-edit-form";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ handle: string }> };

export default async function AdminProductEditPage({ params }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const { handle } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("products")
    .select(
      "handle, title, description_safe, status, featured, manufacturer, product_type, category, product_variants(price_paisa)",
    )
    .eq("handle", handle)
    .maybeSingle();

  if (!data) notFound();

  const price = (data.product_variants as { price_paisa: number }[] | null)?.[0]?.price_paisa ?? 0;

  return (
    <div className="lh-container py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider text-[var(--lh-ink-2)]">
            {data.handle}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Edit product</h1>
        </div>
        <Link href="/admin/products" className="text-sm text-[var(--lh-action)]">
          ← Catalog
        </Link>
      </div>
      <ProductEditForm
        handle={data.handle}
        title={data.title}
        descriptionSafe={data.description_safe || ""}
        status={data.status as "draft" | "active" | "archived"}
        featured={!!data.featured}
        manufacturer={data.manufacturer}
        productType={data.product_type}
        category={data.category}
        pricePaisa={price}
      />
    </div>
  );
}
