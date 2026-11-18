import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CheckoutReadinessPanel } from "@/components/admin/checkout-readiness-panel";
import { loadCheckoutReadiness } from "@/lib/commerce/checkout-readiness-server";
import { requireStaffPage } from "@/lib/auth/staff";
import { emailConfigured } from "@/lib/notify/send-email";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

async function operationalSnapshot() {
  const supabase = createServiceClient();
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const products = () => supabase.from("products").select("id", { count: "exact", head: true });
  // Independent counts run in parallel (previously 12 sequential round trips).
  const [total, active, draft, archived, media, mediaPending, toConfirm, notifyProblems, inquiryOpen] = await Promise.all([
    count(products()),
    count(products().eq("status", "active")),
    count(products().eq("status", "draft")),
    count(products().eq("status", "archived")),
    count(supabase.from("product_media").select("id", { count: "exact", head: true })),
    count(supabase.from("product_media").select("id", { count: "exact", head: true }).eq("approval", "pending")),
    count(
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["placed", "pending_confirmation"]),
    ),
    count(
      supabase
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "failed", "sending"]),
    ),
    count(supabase.from("contact_inquiries").select("id", { count: "exact", head: true }).in("status", ["new", "handling"])),
  ]);
  return { toConfirm, notifyProblems, inquiryOpen, total, active, draft, archived, media, mediaPending };
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
      <Link href={href} className={`${className} transition hover:border-[var(--adm-action)]`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export default async function AdminHomePage() {
  const staff = await requireStaffPage();
  const [counts, readiness] = await Promise.all([operationalSnapshot(), loadCheckoutReadiness()]);
  const mailReady = emailConfigured() && !!process.env.STORE_NOTIFY_EMAIL;

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={`${staff.email ?? "Staff"} · role ${staff.role}. Figures are live database counts in PKR store context — unpaid COD orders are not counted as collected revenue.`}
      />

      {!mailReady ? (
        <div
          role="status"
          className="mb-4 rounded-[var(--adm-radius-lg)] border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          data-testid="overview-email-fallback"
        >
          <p className="font-semibold">Order email alerts are offline</p>
          <p className="mt-1 text-amber-900/90">
            COD is live: monitor{" "}
            <Link href="/admin/orders" className="font-semibold underline">
              Orders
            </Link>{" "}
            for new placements. Confirm stock before courier booking. Resend env vars are not set — unsent notifications are never
            marked delivered.
          </p>
        </div>
      ) : null}

      <div className="mb-6">
        <CheckoutReadinessPanel readiness={readiness} />
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
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-[var(--adm-action)] sm:grid-cols-2 lg:grid-cols-3">
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
