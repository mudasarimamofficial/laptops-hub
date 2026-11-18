import Link from "next/link";
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
        title="Content"
        description="CMS pages, blog and Generation reels. Editorial publish and legal approval are separate for policy pages."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Content" }]}
      />

      <nav aria-label="Content desks" className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/content"
          className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-action)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]"
        >
          <p className="text-sm font-semibold text-[var(--adm-ink)]">Pages</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Policies and informational pages</p>
        </Link>
        <Link
          href="/admin/blog"
          className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] transition hover:border-[var(--adm-action)]"
        >
          <p className="text-sm font-semibold text-[var(--adm-ink)]">Blog</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Guides and articles</p>
        </Link>
        <Link
          href="/admin/reels"
          className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] transition hover:border-[var(--adm-action)]"
        >
          <p className="text-sm font-semibold text-[var(--adm-ink)]">Generation reels</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Homepage “Generation Laptops HUB” videos</p>
        </Link>
      </nav>

      <h2 className="mb-4 font-semibold text-[var(--adm-ink)]">Pages</h2>
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
