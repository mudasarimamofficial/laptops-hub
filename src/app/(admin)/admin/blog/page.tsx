import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ImportGuideDraftsButton } from "@/components/admin/import-guide-drafts-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog", robots: { index: false, follow: false } };

/** Blog posts (public at /guides once published). */
export default async function AdminBlogPage() {
  await requireStaffPage(POST_STAFF_ROLES);
  const { data } = await createServiceClient()
    .from("articles")
    .select("id, slug, title, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  const rows = data || [];

  return (
    <div>
      <AdminPageHeader
        title="Blog"
        description="Published posts appear at /guides and in the guides list. Drafts stay here until you publish them. Do not invent store policies in guides."
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Blog" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <ImportGuideDraftsButton />
            <Link
              href="/admin/blog/new"
              className="inline-flex min-h-10 items-center rounded-lg bg-[var(--adm-action,#1748B5)] px-4 text-sm font-semibold text-white"
            >
              New post
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <div
          data-testid="blog-empty"
          className="rounded-[var(--adm-radius-lg)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] p-8 text-center"
        >
          <p className="font-semibold text-[var(--adm-ink)]">No posts yet</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--adm-ink-2)]">
            Import the four factual guide drafts (processors, RAM, storage, business lines) as unpublished drafts, or write a
            new post. /guides stays hidden until something is published.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--adm-border)] rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
          {rows.map((r) => (
            <li key={r.id} data-testid="post-row" className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <Link href={`/admin/blog/${r.id}`} className="min-w-0 font-semibold text-[var(--adm-action,#1748B5)] [overflow-wrap:anywhere]">
                {r.title}
              </Link>
              <span className="text-xs text-[var(--adm-ink-2)]">
                /guides/{r.slug} · {r.status}
                {r.status === "published" && r.published_at ? ` ${new Date(r.published_at).toLocaleDateString("en-PK")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
