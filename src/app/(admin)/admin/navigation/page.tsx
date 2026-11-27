import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { requireStaffPage } from "@/lib/auth/staff";
import { contentVisibility } from "@/lib/content/pages";
import { getNavigationHistory, getPublishedNavigation } from "@/lib/content/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminNavigationPage() {
  const staff = await requireStaffPage(["owner", "admin", "editor"]);

  const supabase = createServiceClient();
  const visibility = await contentVisibility();
  const navConfig = await getPublishedNavigation(supabase);
  const history = await getNavigationHistory(supabase);

  const { data: collections } = await supabase
    .from("collections")
    .select("slug, title")
    .order("title");

  const { data: pagesRaw } = await supabase
    .from("content_pages")
    .select("slug, title, status, legal_approved")
    .order("title");
  const pages = (pagesRaw || []).map((p) => ({
    slug: p.slug,
    title: p.title,
    is_published: p.status === "published",
    legal_approved: !!p.legal_approved,
  }));

  return (
    <>
      <AdminPageHeader
        title="Store navigation"
        description="Add, rename, re-point, reorder and remove the links in the store header, mobile menu and footer. Links to pages that are not published stay hidden from customers automatically, so visitors never land on a missing page."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { label: "Navigation" },
        ]}
      />

      <NavigationEditor
        initialConfig={navConfig}
        initialHistory={history.map((h) => ({
          version: h.version,
          savedAt: h.savedAt,
          savedBy: h.savedBy,
          action: h.action,
          restoredFrom: h.restoredFrom ?? null,
          headerLabels: h.headerNav.map((i) => i.label),
          footerTitles: h.footerColumns.map((c) => c.title),
          footerLinkCount: h.footerColumns.reduce((n, c) => n + c.links.length, 0),
        }))}
        canResetDefaults={staff.role === "owner" || staff.role === "admin"}
        visibility={visibility}
        availableCollections={collections || []}
        availablePages={pages}
      />
    </>
  );
}
