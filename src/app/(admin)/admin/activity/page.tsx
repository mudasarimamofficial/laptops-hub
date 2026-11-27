import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { auditActionLabel, auditActionsMatching } from "@/lib/admin/audit-labels";
import { requireStaffPage } from "@/lib/auth/staff";
import { listStaff } from "@/lib/auth/staff-directory";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const PERIODS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];
const LIMIT = 200;

type Props = { searchParams: Promise<{ q?: string; staff?: string; days?: string }> };

/**
 * Characters that could change a PostgREST filter expression (separators, brackets, quotes, escapes, wildcards) are
 * dropped from the search text. Dots stay, so technical names like "discount.update" can be searched.
 */
function cleanQuery(q: string | undefined): string {
  return (q ?? "").replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Start of the selected period (this page is rendered per request, so "now" is the request time). */
function sinceDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AdminActivityPage({ searchParams }: Props) {
  await requireStaffPage(["owner", "admin"]);
  const sp = await searchParams;
  const q = cleanQuery(sp.q);
  const days = PERIODS.some((p) => p.value === sp.days) ? (sp.days ?? "") : "";
  const supabase = createServiceClient();
  const staffRows = await listStaff(supabase);
  const staffId = staffRows.some((s) => s.userId === sp.staff) ? sp.staff! : "";
  const emailOf = new Map(staffRows.map((s) => [s.userId, s.email]));

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (q) {
    // Free text matches the technical action, the area (entity type), the record id, or the plain-language label.
    const byLabel = auditActionsMatching(q);
    // Values are double-quoted so spaces stay inside one filter; cleanQuery already removed quotes and separators.
    const like = `"*${q}*"`;
    const ors = [`action.ilike.${like}`, `entity_type.ilike.${like}`, `entity_id.ilike.${like}`];
    if (byLabel.length) ors.push(`action.in.(${byLabel.join(",")})`);
    query = query.or(ors.join(","));
  }
  if (staffId) query = query.eq("actor_user_id", staffId);
  if (days) query = query.gte("created_at", sinceDaysAgo(Number(days)));
  const { data, error } = await query;
  const rows = data || [];
  const filtered = Boolean(q || staffId || days);

  return (
    <>
      <AdminPageHeader
        title="Activity log"
        description="Recent staff changes. Sensitive payloads are not shown. This is an audit trail, not a full database backup."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { href: "/admin/settings", label: "Settings" }, { label: "Activity" }]}
      />
      <form method="get" role="search" aria-label="Filter activity" className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
        <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
          Search
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. navigation, order, price"
            className="mt-1 block w-64 max-w-full rounded border border-[var(--adm-border)] px-3 py-2 text-sm text-[var(--adm-ink)]"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
          Staff member
          <select name="staff" defaultValue={staffId} className="mt-1 block rounded border border-[var(--adm-border)] px-3 py-2 text-sm text-[var(--adm-ink)]">
            <option value="">Everyone</option>
            {staffRows.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.email ?? s.userId.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
          Period
          <select name="days" defaultValue={days} className="mt-1 block rounded border border-[var(--adm-border)] px-3 py-2 text-sm text-[var(--adm-ink)]">
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 py-2 text-sm font-semibold text-white">
          Filter
        </button>
        {filtered ? (
          <Link href="/admin/activity" className="py-2 text-sm font-semibold text-[var(--adm-action)] hover:underline">
            Clear filters
          </Link>
        ) : null}
        <p className="w-full text-xs text-[var(--adm-ink-2)]" data-testid="activity-count" role="status">
          {error
            ? "The activity log could not be searched. Try a simpler search."
            : `${rows.length === LIMIT ? `Latest ${LIMIT}` : rows.length} ${rows.length === 1 ? "entry" : "entries"}${filtered ? " match these filters" : ""}.`}
        </p>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No activity matches these filters" : "No audit entries yet"}
          description={filtered ? "Try another word, everyone, or any time." : "Saving products, orders, content or settings writes entries here."}
        />
      ) : (
        <div className="adm-table-scroll overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
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
                <tr key={r.id} data-testid="activity-row" className="border-t border-[var(--adm-divider)]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--adm-ink-2)]">{new Date(r.created_at).toLocaleString("en-PK")}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{auditActionLabel(r.action)}</span>
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] text-[var(--adm-ink-muted)]">{r.action}</span>
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {r.entity_type} {r.entity_id ? `· ${String(r.entity_id).slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--adm-ink-2)]">
                    {r.actor_user_id ? (emailOf.get(r.actor_user_id) ?? `${String(r.actor_user_id).slice(0, 8)}…`) : "—"}
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
