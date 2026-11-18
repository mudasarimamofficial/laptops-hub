import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/money";
import { ANALYTICS_WINDOWS, orderAnalytics, type CollectionLite, type OrderLite } from "@/lib/orders/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

function dateCutoff(days: number | null): string | null {
  if (days === null) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Honest operational numbers from real orders and recorded cash only. Zero orders shows zeros. */
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaffPage(["owner", "admin", "manager"]);
  const sp = await searchParams;
  const win = ANALYTICS_WINDOWS.find(([k]) => k === sp.range) ?? ANALYTICS_WINDOWS[1];
  const supabase = createServiceClient();

  const cutoff = dateCutoff(win[2]);
  let q = supabase.from("orders").select("id, status, total_due_paisa").order("created_at", { ascending: false }).limit(10_000);
  if (cutoff) q = q.gte("created_at", cutoff);
  const { data: orders } = await q;
  const ids = (orders || []).map((o) => o.id);
  const collections: CollectionLite[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase.from("cod_collections").select("order_id, amount_paisa").in("order_id", ids.slice(i, i + 500));
    collections.push(...(data || []));
  }
  const a = orderAnalytics((orders || []) as OrderLite[], collections);
  const { count: inquiries } = await supabase.from("contact_inquiries").select("id", { count: "exact", head: true });

  const tiles: [string, string, string][] = [
    ["Orders placed", String(a.placed), `Value ${formatPkr(a.placedValuePaisa)} (cash due, not revenue)`],
    ["Delivered", String(a.delivered), ""],
    ["Cash collected", formatPkr(a.cashCollectedPaisa), "COD cash recorded on these orders"],
    ["Outstanding", formatPkr(a.outstandingPaisa), "Delivered, cash not yet recorded"],
    ["In progress", String(a.open), `${formatPkr(a.expectedOnOpenPaisa)} due on delivery`],
    ["Cancelled", String(a.cancelled), ""],
    ["Returned", String(a.returned), ""],
    ["Delivery failed", String(a.deliveryFailed), ""],
  ];

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="From real orders and recorded COD cash only. An order is not revenue until its cash is recorded."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Analytics" }]}
      />
      <nav aria-label="Date range" className="mb-4 flex flex-wrap gap-2 text-sm">
        {ANALYTICS_WINDOWS.map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/analytics?range=${k}`}
            aria-current={win[0] === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${win[0] === k ? "border-[var(--adm-action)] bg-[var(--adm-info-bg)] font-semibold" : "border-[var(--adm-border)] bg-[var(--adm-surface)]"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold" data-testid="metric-value">{value}</p>
            {hint ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{hint}</p> : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--adm-ink-2)]">
        Orders are counted by the day they were placed ({win[1].toLowerCase()}); statuses are their current status. Inquiries (all time): {inquiries ?? 0}.
        There are no visitor or conversion figures here: the shop does not run tracking for them.
      </p>
    </>
  );
}
