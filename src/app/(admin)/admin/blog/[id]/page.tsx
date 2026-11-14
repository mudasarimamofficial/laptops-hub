import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/admin/post-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post", robots: { index: false, follow: false } };

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireStaffPage(POST_STAFF_ROLES);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { data: p } = await createServiceClient().from("articles").select("id, slug, title, excerpt, body_html, status").eq("id", id).maybeSingle();
  if (!p) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <div className="lh-container max-w-3xl py-10">
      <Link href="/admin/blog" className="text-sm text-[var(--lh-action)]">
        ← Blog
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold [overflow-wrap:anywhere]">{p.title}</h1>
        {p.status === "published" ? (
          <Link href={`/guides/${p.slug}`} target="_blank" className="text-sm text-[var(--lh-action)]">
            View on site ↗
          </Link>
        ) : null}
      </div>
      {saved ? (
        <p role="status" className="mb-4 text-sm text-emerald-700">
          Post saved.
        </p>
      ) : null}
      <PostForm
        id={p.id}
        initial={{ slug: p.slug, title: p.title, excerpt: p.excerpt, bodyHtml: p.body_html, status: p.status as "draft" | "published" }}
      />
    </div>
  );
}
