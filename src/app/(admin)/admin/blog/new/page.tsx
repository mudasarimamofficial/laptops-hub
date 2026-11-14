import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { PostForm } from "@/components/admin/post-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post", robots: { index: false, follow: false } };

export default async function NewPostPage() {
  await requireStaffPage(POST_STAFF_ROLES);
  return (
    <div className="lh-container max-w-3xl py-10">
      <Link href="/admin/blog" className="text-sm text-[var(--lh-action)]">
        ← Blog
      </Link>
      <h1 className="mt-2 mb-6 font-[family-name:var(--font-display)] text-3xl font-bold">New post</h1>
      <PostForm initial={{ slug: "", title: "", excerpt: "", bodyHtml: "", status: "draft" }} />
    </div>
  );
}
