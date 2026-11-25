import { notFound } from "next/navigation";
import {
  CollectionMembershipEditor,
  type MemberRow,
} from "@/components/admin/collection-membership";
import { CollectionRuleBuilder } from "@/components/admin/collection-rule-builder";
import { CollectionDetailsForm } from "@/components/admin/collection-details-form";
import { V5_COLS } from "@/lib/catalog/v5-model";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import {
  isAutomatedRule,
  type CollectionRule,
} from "@/lib/collections/rule-eval";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function AdminCollectionDetailPage({ params }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("collections")
    .select(
      "id, slug, title, description, published, featured, rule, sort_order, seo_title, seo_description, collection_products(position, product_id, products(id, handle, title, status))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const builtIn = Object.hasOwn(V5_COLS, data.slug);

  const members = (
    (data.collection_products as {
      position: number;
      product_id: string;
      products:
        | { id: string; handle: string; title: string; status: string }
        | { id: string; handle: string; title: string; status: string }[]
        | null;
    }[]) || []
  )
    .map((row) => {
      const products = Array.isArray(row.products)
        ? row.products[0]
        : row.products;
      return {
        product_id: row.product_id,
        position: row.position,
        products: products ?? null,
      } satisfies MemberRow;
    })
    .sort((a, b) => a.position - b.position);

  const automated = isAutomatedRule(data.rule);
  const rule = (
    data.rule && typeof data.rule === "object" ? data.rule : null
  ) as CollectionRule | null;

  return (
    <>
      <AdminPageHeader
        title={data.title}
        description={`Handle ${data.slug} · ${builtIn ? "Built-in storefront collection" : automated ? "Automated rules" : "Manual membership"}`}
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/collections", label: "Collections" },
          { label: data.title },
        ]}
        actions={
          <StatusBadge
            status={builtIn || data.published ? "published" : "draft"}
          />
        }
      />
      <CollectionDetailsForm
        slug={data.slug}
        builtIn={builtIn}
        initial={{
          title: data.title,
          description: data.description || "",
          published: !!data.published,
          seoTitle: data.seo_title || "",
          seoDescription: data.seo_description || "",
        }}
      />
      {builtIn ? null : (
        <>
          <div className="mb-6">
            <CollectionRuleBuilder
              slug={data.slug}
              initialRule={automated ? rule : null}
            />
          </div>
          {!automated ? (
            <CollectionMembershipEditor slug={data.slug} members={members} />
          ) : null}
          {automated ? (
            <p className="mt-4 text-sm text-[var(--adm-ink-2)]">
              Automated collections use rule matching for storefront membership.
              Clear rules above to switch back to manual product assignment.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
