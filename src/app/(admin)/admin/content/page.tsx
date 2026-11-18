import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { ContentEditForm } from "@/components/admin/content-edit-form";
import { LEGAL_CONTENT_SLUGS } from "@/lib/security/sanitize-html";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminContentPage() {
  const staff = await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();
  const { data: pages } = await supabase
    .from("content_pages")
    .select("slug, title, status, body_html, legal_approved, updated_at")
    .order("slug");

  const canApproveLegal = ["owner", "admin", "manager"].includes(staff.role);
  const rows = pages || [];

  return (
    <div>
      <AdminPageHeader
        title="Pages"
        description="Editorial publish and legal approval are separate. Policy pages stay private until both are set."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Pages" }]}
      />

      <div className="space-y-8">
        {rows.length === 0 ? (
          <EmptyState title="No content pages yet" description="CMS pages appear here once seeded. Customers only see published, approved policy pages." />
        ) : (
          rows.map((p) => (
            <ContentEditForm
              key={p.slug}
              slug={p.slug}
              title={p.title}
              status={p.status as "pending" | "draft" | "published"}
              bodyHtml={p.body_html || ""}
              legalApproved={!!p.legal_approved}
              isLegalPage={LEGAL_CONTENT_SLUGS.has(p.slug)}
              canApproveLegal={canApproveLegal}
            />
          ))
        )}
      </div>
    </div>
  );
}
