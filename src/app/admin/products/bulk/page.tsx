import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ModuleStatusPanel } from "@/components/admin/ui/module-status";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBulkEditorPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  return (
    <>
      <AdminPageHeader
        title="Bulk editor"
        description="Spreadsheet-style edits for prices, status, tags, inventory mode, and collections."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { label: "Bulk editor" },
        ]}
      />
      <ModuleStatusPanel
        title="Bulk grid"
        phase="Phase 3 — queued"
        summary="Single-product edit, archive/soft-delete, and media URL management are live. The editable grid with paste, conflict review, and undo history is next."
        availableNow={[{ label: "Edit products one-by-one", href: "/admin/products" }]}
        nextSteps={["Server-paginated editable grid", "Pending-change review + atomic apply", "Undo changeset"]}
      />
    </>
  );
}
