import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminAnalyticsPage() {
  await requireStaffPage(["owner", "admin", "manager"]);
  const supabase = createServiceClient();
  const { count: orders } = await supabase.from("orders").select("id", { count: "exact", head: true });
  const { data: collected } = await supabase.from("cod_collections").select("amount_paisa");
  const collectedSum = (collected || []).reduce((n, r) => n + (r.amount_paisa || 0), 0);
  const { count: inquiries } = await supabase.from("contact_inquiries").select("id", { count: "exact", head: true });

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Operational metrics only. Unpaid COD orders are not counted as collected revenue. Currency PKR (paisa integers in DB)."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Analytics" }]}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Orders placed (all time)", String(orders ?? 0)],
          ["COD cash recorded", formatPkr(collectedSum)],
          ["Inquiries (all time)", String(inquiries ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              {label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--adm-ink-2)]">
        Date-range filters and funnel definitions ship after order desk UX polish (Phase 6/7). No fictitious conversion rates.
      </p>
    </>
  );
}
