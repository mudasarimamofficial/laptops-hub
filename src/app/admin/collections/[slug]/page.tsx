import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
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
    .select("id, slug, title, description, published, featured, rule, sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();

  return (
    <>
      <AdminPageHeader
        title={data.title}
        description={`Handle ${data.slug}`}
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
        <p className="mt-4 text-[var(--adm-ink-2)]">Rule JSON (read-only until editor ships)</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--adm-surface-2)] p-3 font-[family-name:var(--font-mono)] text-xs">
          {JSON.stringify(data.rule ?? {}, null, 2)}
        </pre>
      </div>
      <ModuleStatusPanel
        title="Membership & merchandising editor"
        phase="Phase 3 — next"
        summary="Detail view loads the live collection. Product assignment, drag reorder, SEO fields, and automated rule editing are scheduled immediately after the create API."
        availableNow={[{ label: "All collections", href: "/admin/collections" }]}
      />
    </>
  );
}
