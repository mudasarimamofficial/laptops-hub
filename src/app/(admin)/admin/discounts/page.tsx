import { requireStaffPage } from "@/lib/auth/staff";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DiscountCampaignForm } from "@/components/admin/discount-campaign-form";
import { listDiscountCampaigns } from "@/lib/commerce/discounts-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discounts", robots: { index: false, follow: false } };

export default async function AdminDiscountsPage() {
  await requireStaffPage(["owner", "admin", "manager"]);
  let campaigns = [] as Awaited<ReturnType<typeof listDiscountCampaigns>>;
  let loadError: string | null = null;
  try {
    campaigns = await listDiscountCampaigns();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load discounts";
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AdminPageHeader
        title="Discounts"
        description="Automatic storewide and promotional pricing. Selling prices are calculated server-side at checkout."
      />
      {loadError ? (
        <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 10, background: "#FEF3C7", color: "#92400E" }}>
          Discount tables may not be migrated yet: {loadError}
        </p>
      ) : null}
      <DiscountCampaignForm initial={campaigns} />
    </div>
  );
}
