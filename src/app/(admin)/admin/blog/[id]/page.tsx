import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/admin/post-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post", robots: { index: false, follow: false } };

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireStaffPage(POST_STAFF_ROLES);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { data: p } = await createServiceClient()
    .from("articles")
    .select(
      "id, slug, title, excerpt, body_html, status, seo_title, seo_description, cover_image_url, og_image_url, author_name, category, template_key, tags, scheduled_for",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <div>
      <AdminPageHeader
        title={p.title}
        description={saved ? "Post saved." : undefined}
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/blog", label: "Blog posts" },
          { label: "Edit" },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/blog" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
              ← Blog posts
            </Link>
            {p.status === "published" ? (
              <Link href={`/guides/${p.slug}`} target="_blank" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
                View on site ↗
              </Link>
            ) : null}
          </div>
        }
      />
      <PostForm
        id={p.id}
        initial={{
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || "",
          bodyHtml: p.body_html || "",
          status: p.status as "draft" | "published",
          seoTitle: p.seo_title || "",
          seoDescription: p.seo_description || "",
          coverImageUrl: p.cover_image_url || "",
          ogImageUrl: p.og_image_url || "",
          authorName: p.author_name || "",
          category: p.category || "",
          templateKey: p.template_key || "",
          tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
          scheduledFor: p.scheduled_for || "",
        }}
      />
    </div>
  );
}
