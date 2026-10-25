import { notFound } from "next/navigation";
import { CollectionMembershipEditor, type MemberRow } from "@/components/admin/collection-membership";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
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
      "id, slug, title, description, published, featured, rule, sort_order, collection_products(position, product_id, products(id, handle, title, status))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();

  const members = (
    (data.collection_products as {
      position: number;
      product_id: string;
      products: { id: string; handle: string; title: string; status: string } | { id: string; handle: string; title: string; status: string }[] | null;
    }[]) || []
  )
    .map((row) => {
      const products = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        product_id: row.product_id,
        position: row.position,
        products: products ?? null,
      } satisfies MemberRow;
    })
    .sort((a, b) => a.position - b.position);

  const automated = data.rule && typeof data.rule === "object" && Object.keys(data.rule as object).length > 0;

  return (
    <>
      <AdminPageHeader
        title={data.title}
        description={`Handle ${data.slug} · ${automated ? "Automated rules" : "Manual membership"}`}
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/collections", label: "Collections" },
          { label: data.title },
        ]}
        actions={<StatusBadge status={data.published ? "published" : "draft"} />}
      />
      <div className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 text-sm">
        <p className="text-[var(--adm-ink-2)]">Description</p>
        <p className="mt-1 whitespace-pre-wrap">{data.description || "—"}</p>
        {automated ? (
          <>
            <p className="mt-4 text-[var(--adm-ink-2)]">Rule JSON</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--adm-surface-2)] p-3 font-[family-name:var(--font-mono)] text-xs">
              {JSON.stringify(data.rule ?? {}, null, 2)}
            </pre>
          </>
        ) : null}
      </div>
      {!automated ? <CollectionMembershipEditor slug={data.slug} members={members} /> : null}
      {automated ? (
        <p className="text-sm text-[var(--adm-ink-2)]">
          Automated collections do not use manual membership. Rule evaluation against the catalog index is the next
          Phase 3 slice.
        </p>
      ) : null}
    </>
  );
}
