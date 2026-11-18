import Link from "next/link";
import Image from "next/image";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { articleVisibilityLabel } from "@/lib/content/blog";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { ImportGuideDraftsButton } from "@/components/admin/import-guide-drafts-button";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog posts", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

/** Blog posts (public at /guides once published and past schedule). */
export default async function AdminBlogPage({ searchParams }: Props) {
  await requireStaffPage(POST_STAFF_ROLES);
  const sp = await searchParams;
  const q = (sp.q || "").trim().toLowerCase();
  const statusFilter = sp.status === "draft" || sp.status === "published" || sp.status === "scheduled" ? sp.status : "all";

  const { data } = await createServiceClient()
    .from("articles")
    .select("id, slug, title, status, published_at, updated_at, cover_image_url, author_name, category, scheduled_for")
    .order("updated_at", { ascending: false })
    .limit(200);

  let rows = data || [];
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.author_name || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q),
    );
  }
  if (statusFilter !== "all") {
    rows = rows.filter((r) => {
      const label = articleVisibilityLabel(r);
      if (statusFilter === "scheduled") return label === "Scheduled";
      if (statusFilter === "published") return label === "Published";
      return label === "Draft";
    });
  }

  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q || "", status: statusFilter === "all" ? "" : statusFilter, ...next };
    if (merged.q) p.set("q", merged.q);
    if (merged.status && merged.status !== "all") p.set("status", merged.status);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <AdminPageHeader
        title="Blog posts"
        description="Published posts appear at /guides. Drafts and future schedules stay private. Do not invent store policies in guides."
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Blog posts" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <ImportGuideDraftsButton />
            <Link
              href="/admin/blog/new"
              className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)]"
            >
              Add blog post
            </Link>
          </div>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)]">
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-[var(--adm-ink-2)]">
          Search
          <input
            name="q"
            defaultValue={sp.q || ""}
            placeholder="Title, address, author…"
            className="mt-1 w-full rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-[var(--adm-ink-2)]">
          Status
          <select name="status" defaultValue={statusFilter} className="mt-1 block rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-4 text-sm font-semibold">
          Apply
        </button>
        {q || statusFilter !== "all" ? (
          <Link href="/admin/blog" className="min-h-10 content-center text-sm font-semibold text-[var(--adm-action)]">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["all", "All"],
            ["draft", "Drafts"],
            ["published", "Published"],
            ["scheduled", "Scheduled"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/blog${qs({ status: key })}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              statusFilter === key ? "bg-[var(--adm-action)] text-white" : "bg-[var(--adm-surface-2)] text-[var(--adm-ink-2)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={q || statusFilter !== "all" ? "No matching posts" : "No posts yet"}
          description={
            q || statusFilter !== "all"
              ? "Try a different search or status filter."
              : "Import the factual guide drafts as unpublished posts, or write a new article. /guides stays empty until something is visible."
          }
          actionHref="/admin/blog/new"
          actionLabel="Add blog post"
        />
      ) : (
        <ul className="divide-y divide-[var(--adm-border)] rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          {rows.map((r) => {
            const label = articleVisibilityLabel(r);
            const badgeStatus = label === "Published" ? "published" : label === "Scheduled" ? "scheduled" : "draft";
            return (
              <li key={r.id} data-testid="post-row" className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--adm-surface-2)]">
                  {r.cover_image_url ? (
                    <Image src={r.cover_image_url} alt="" fill className="object-cover" sizes="64px" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-[var(--adm-ink-muted)]">No image</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/blog/${r.id}`} className="font-semibold text-[var(--adm-action)] [overflow-wrap:anywhere] hover:underline">
                    {r.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--adm-ink-2)]">
                    /guides/{r.slug}
                    {r.author_name ? ` · ${r.author_name}` : ""}
                    {r.category ? ` · ${r.category}` : ""}
                    {" · "}
                    updated {new Date(r.updated_at).toLocaleDateString("en-PK")}
                  </p>
                </div>
                <StatusBadge status={badgeStatus} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
