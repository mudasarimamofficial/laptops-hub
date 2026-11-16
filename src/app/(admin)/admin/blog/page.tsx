import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";

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
    <div className="lh-container py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Blog</h1>
        <Link href="/admin/blog/new" className="rounded-full bg-[var(--lh-action)] px-5 py-2 text-sm font-semibold text-white">
          New post
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-[var(--lh-ink-2)]">
        Published posts appear at /guides and in the guides list. Drafts are visible only here.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-[var(--lh-ink-2)]">No posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--lh-border)] rounded-xl border border-[var(--lh-border)] bg-white">
          {rows.map((r) => (
            <li key={r.id} data-testid="post-row" className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <Link href={`/admin/blog/${r.id}`} className="min-w-0 font-semibold text-[var(--lh-action)] [overflow-wrap:anywhere]">
                {r.title}
              </Link>
              <span className="text-xs text-[var(--lh-ink-2)]">
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
