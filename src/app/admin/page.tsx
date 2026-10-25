import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

async function operationalSnapshot() {
  const supabase = createServiceClient();
  const { count: total } = await supabase.from("products").select("id", { count: "exact", head: true });
  const { count: active } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: draft } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: archived } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "archived");
  const { count: media } = await supabase.from("product_media").select("id", { count: "exact", head: true });
  const { count: mediaPending } = await supabase
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("approval", "pending");
  const { count: toConfirm } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["placed", "pending_confirmation"]);
  const { count: notifyProblems } = await supabase
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed", "sending"]);
  const { count: inquiryOpen } = await supabase
    .from("contact_inquiries")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "handling"]);
  const { count: zones } = await supabase
    .from("shipping_zones")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  const { data: codRow } = await supabase.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle();
  const codEnabled =
    codRow?.value && typeof codRow.value === "object" && !Array.isArray(codRow.value)
      ? Boolean((codRow.value as { enabled?: boolean }).enabled)
      : false;

  return {
    toConfirm: toConfirm ?? 0,
    notifyProblems: notifyProblems ?? 0,
    inquiryOpen: inquiryOpen ?? 0,
    total: total ?? 0,
    active: active ?? 0,
    draft: draft ?? 0,
    archived: archived ?? 0,
    media: media ?? 0,
    mediaPending: mediaPending ?? 0,
    zones: zones ?? 0,
    codEnabled,
  };
}

function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.03em]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{hint}</p> : null}
    </>
  );
  const className =
    "rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]";
  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:border-[var(--lh-action)]`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export default async function AdminHomePage() {
  const staff = await requireStaffPage();
  const counts = await operationalSnapshot();
  const envCod = process.env.COD_CHECKOUT_ENABLED === "true";

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={`${staff.email ?? "Staff"} · role ${staff.role}. Figures are live database counts in PKR store context — unpaid COD orders are not counted as collected revenue.`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm">
        <span className="font-medium">Store readiness</span>
        <StatusBadge status={counts.codEnabled && envCod ? "active" : "draft"}>
          {counts.codEnabled && envCod ? "COD live" : "COD off"}
        </StatusBadge>
        <span className="text-[var(--adm-ink-2)]">
          Env gate {envCod ? "on" : "off"} · DB setting {counts.codEnabled ? "on" : "off"} · Active shipping zones{" "}
          {counts.zones}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders awaiting action" value={counts.toConfirm} href="/admin/orders" />
        <StatCard label="Open inquiries" value={counts.inquiryOpen} href="/admin/inquiries" />
        <StatCard
          label="Notification issues"
          value={counts.notifyProblems}
          href="/admin/settings"
          hint="Pending, failed, or sending"
        />
        <StatCard
          label="Media rights pending"
          value={counts.mediaPending}
          href="/admin/media"
          hint={`${counts.media} total remote refs`}
        />
        <StatCard label="Products" value={counts.total} href="/admin/products" />
        <StatCard label="Active (public)" value={counts.active} href="/admin/products?status=active" />
        <StatCard label="Drafts" value={counts.draft} href="/admin/products?status=draft" />
        <StatCard label="Archived" value={counts.archived} href="/admin/products?status=archived" />
      </div>

      <section className="mt-8 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Quick actions</h2>
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-[var(--lh-action)] sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Link href="/admin/products/new" className="hover:underline">
              Add product
            </Link>
          </li>
          <li>
            <Link href="/admin/products/import" className="hover:underline">
              Import Shopify CSV
            </Link>
          </li>
          <li>
            <Link href="/admin/collections" className="hover:underline">
              Manage collections
            </Link>
          </li>
          <li>
            <Link href="/admin/online-store" className="hover:underline">
              Customize storefront
            </Link>
          </li>
          <li>
            <Link href="/admin/settings" className="hover:underline">
              Shipping & store settings
            </Link>
          </li>
          <li>
            <Link href="/admin/orders" className="hover:underline">
              Process COD orders
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
