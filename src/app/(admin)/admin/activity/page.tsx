import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { auditActionLabel } from "@/lib/admin/audit-labels";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";


export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminActivityPage() {
  await requireStaffPage(["owner", "admin"]);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data || [];

  return (
    <>
      <AdminPageHeader
        title="Activity log"
        description="Recent staff changes. Sensitive payloads are not shown. This is an audit trail, not a full database backup."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { href: "/admin/settings", label: "Settings" }, { label: "Activity" }]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" description="Saving products, orders, content or settings writes entries here." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">What happened</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Staff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--adm-divider)]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--adm-ink-2)]">
                    {new Date(r.created_at).toLocaleString("en-PK")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{auditActionLabel(r.action)}</span>
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] text-[var(--adm-ink-muted)]">{r.action}</span>
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {r.entity_type} {r.entity_id ? `· ${String(r.entity_id).slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                    {r.actor_user_id ? `${String(r.actor_user_id).slice(0, 8)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
