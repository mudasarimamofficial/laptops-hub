import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminOnlineStorePage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  return (
    <>
      <AdminPageHeader
        title="Customize"
        description="Visual section editor for homepage, header, footer, and templates. V5 design tokens stay the default theme."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Online store" }]}
      />
      <ModuleStatusPanel
        title="Site / theme editor"
        phase="Phase 5 — scheduled"
        summary="No-code section schemas, draft/publish/rollback, and accurate preview are Phase 5. Until then, use Pages for CMS HTML and keep the approved V5 storefront composition."
        availableNow={[
          { label: "Content pages", href: "/admin/content" },
          { label: "View live storefront", href: "/" },
        ]}
        nextSteps={[
          "Versioned section instances seeded from current V5 homepage",
          "Left tree / preview / inspector UI",
          "Publish pointer + cache invalidation preserving CMS withdrawal invariant",
        ]}
      />
    </>
  );
}
