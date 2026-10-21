import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { ContentEditForm } from "@/components/admin/content-edit-form";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminContentPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();
  const { data: pages } = await supabase
    .from("content_pages")
    .select("slug, title, status, body_html, updated_at")
    .order("slug");

  return (
    <div className="lh-container py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Content</h1>
          <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
            Unapproved legal/business copy stays pending — never auto-published.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-[var(--lh-action)]">
          ← Overview
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        {(pages || []).length === 0 ? (
          <p className="text-[var(--lh-ink-2)]">No content pages yet. Seed pending pages from store settings.</p>
        ) : (
          (pages || []).map((p) => (
            <ContentEditForm
              key={p.slug}
              slug={p.slug}
              title={p.title}
              status={p.status as "pending" | "draft" | "published"}
              bodyHtml={p.body_html || ""}
            />
          ))
        )}
      </div>
    </div>
  );
}
