import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CollectionCreateForm } from "@/components/admin/collection-create-form";
import { requireStaffPage } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminNewCollectionPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  return (
    <>
      <AdminPageHeader
        title="Create collection"
        description="Manual collections use membership positions. Automated collections store rule JSON (e.g. HP + RAM ≥ 16) for deterministic matching."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/collections", label: "Collections" },
          { label: "Create" },
        ]}
      />
      <CollectionCreateForm />
    </>
  );
}
