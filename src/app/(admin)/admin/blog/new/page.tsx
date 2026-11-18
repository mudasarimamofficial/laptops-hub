import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { PostForm } from "@/components/admin/post-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post", robots: { index: false, follow: false } };

export default async function NewPostPage() {
  await requireStaffPage(POST_STAFF_ROLES);
  return (
    <div>
      <AdminPageHeader
        title="Add blog post"
        description="Write a guide for customers. Drafts stay private until you make them visible."
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/blog", label: "Blog posts" },
          { label: "Add blog post" },
        ]}
        actions={
          <Link href="/admin/blog" className="text-sm font-semibold text-[var(--adm-action)] hover:underline">
            ← Blog posts
          </Link>
        }
      />
      <PostForm
        initial={{
          slug: "",
          title: "",
          excerpt: "",
          bodyHtml: "",
          status: "draft",
          seoTitle: "",
          seoDescription: "",
          coverImageUrl: "",
          ogImageUrl: "",
          authorName: "",
          category: "",
          templateKey: "",
          tags: [],
          scheduledFor: "",
        }}
      />
    </div>
  );
}
