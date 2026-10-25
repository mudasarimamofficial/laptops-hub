import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { requireStaffPage } from "@/lib/auth/staff";
import { contentVisibility } from "@/lib/content/pages";
import { getPublishedNavigation } from "@/lib/content/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminNavigationPage() {
  await requireStaffPage(["owner", "admin", "editor"]);

  const supabase = createServiceClient();
  const visibility = await contentVisibility();
  const navConfig = await getPublishedNavigation(supabase);

  const { data: collections } = await supabase
    .from("collections")
    .select("slug, title")
    .order("title");

  const { data: pages } = await supabase
    .from("content_pages")
    .select("slug, title, is_published, legal_approved")
    .order("title");

  return (
    <>
      <AdminPageHeader
        title="Store navigation"
        description="Add, edit, reorder, and remove header and footer navigation items. Unpublished policy links are automatically hidden from customer storefronts."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { label: "Navigation" },
        ]}
      />

      <div className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-xs text-[var(--adm-ink-2)] shadow-[var(--adm-shadow)]">
        <p className="font-semibold text-[var(--adm-ink)]">Customer protection invariant</p>
        <p className="mt-1">
          Links to policy and content pages are governed by <code>isLinkPublic()</code>. If a policy or guide is not published, its link is automatically withheld from public navigation so visitors never encounter broken links or 404s.
        </p>
      </div>

      <NavigationEditor
        initialConfig={navConfig}
        visibility={visibility}
        availableCollections={collections || []}
        availablePages={pages || []}
      />
    </>
  );
}
