import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { BADGE_STAFF_ROLES, MERCH_SETTINGS_ROLES } from "@/lib/content/admin-roles";
import {
  computeTopSellers,
  EDITORIAL_LABELS,
  editorialActive,
  parseSocialProof,
  QUALIFYING_STATUSES,
  SOCIAL_PROOF_KEY,
  type EditorialKind,
  type OrderActivityRow,
} from "@/lib/content/social-proof";
import { SocialProofForm } from "@/components/admin/social-proof-form";
import { ProductBadgeForm, RemoveBadgeButton } from "@/components/admin/product-badge-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Badges & social proof", robots: { index: false, follow: false } };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }) : "—");

/**
 * Merchandising: data-backed "Top seller" status, editorial labels, recent-order notices and the reels heading.
 * The page always states how many real qualifying orders exist, so the merchant can see why nothing is shown yet.
 */
export default async function AdminMerchandisingPage() {
  const staff = await requireStaffPage(BADGE_STAFF_ROLES);
  const canSettings = MERCH_SETTINGS_ROLES.includes(staff.role);
  const sb = createServiceClient();
  const now = new Date();

  const [{ data: settingsRow }, { data: badges }, { data: products }] = await Promise.all([
    sb.from("store_settings").select("value").eq("key", SOCIAL_PROOF_KEY).maybeSingle(),
    sb.from("product_badges").select("product_id, kind, starts_at, ends_at, note, updated_at, products(handle, title)").order("updated_at", { ascending: false }).limit(500),
    sb.from("products").select("handle, title").is("deleted_at", null).eq("status", "active").order("title").limit(1000),
  ]);
  const settings = parseSocialProof(settingsRow?.value);

  const windowDays = Math.max(settings.topSeller.windowDays, settings.activity.windowDays);
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
  const { data: orders } = await sb
    .from("orders")
    .select("id, status, created_at, order_items(product_id, handle, title_snapshot, quantity)")
    .in("status", [...QUALIFYING_STATUSES.confirmed])
    .gte("created_at", since)
    .limit(1000);
  const lines: OrderActivityRow[] = (orders || []).flatMap((o) =>
    ((o.order_items ?? []) as { product_id: string | null; handle: string; title_snapshot: string; quantity: number }[]).map((it) => ({
      orderId: o.id,
      status: o.status,
      createdAt: o.created_at,
      city: null,
      productId: it.product_id,
      handle: it.handle,
      title: it.title_snapshot,
      quantity: it.quantity,
    })),
  );
  const qualifying = new Set(lines.filter((l) => (QUALIFYING_STATUSES[settings.topSeller.minStatus] as readonly string[]).includes(l.status)).map((l) => l.orderId)).size;
  const top = computeTopSellers(lines, { ...settings, topSeller: { ...settings.topSeller, enabled: true } }, now);

  return (
    <>
      <AdminPageHeader
        title="Badges & social proof"
        description="Product labels, the data-backed “Top seller” badge, recent order notices and the reels heading. Nothing here can invent sales."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Online store" }, { label: "Badges & social proof" }]}
      />

      <section aria-labelledby="truth" className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 text-sm shadow-[var(--adm-shadow)]">
        <h2 id="truth" className="text-base font-semibold">What the storefront can show right now</h2>
        <ul className="mt-2 space-y-1 text-[var(--adm-ink-2)]" data-testid="social-proof-status">
          <li>
            Qualifying orders in the last {settings.topSeller.windowDays} days: <strong className="text-[var(--adm-ink)]" data-testid="qualifying-orders">{qualifying}</strong>
          </li>
          <li>
            Products that meet the “Top seller” rule ({settings.topSeller.minUnits}+ units):{" "}
            <strong className="text-[var(--adm-ink)]" data-testid="top-seller-count">{top.length}</strong>
            {top.length ? ` — ${top.join(", ")}` : ""}
            {settings.topSeller.enabled ? "" : " (badge switched off)"}
          </li>
          <li>Recent order notices: {settings.activity.enabled ? (qualifying ? "on" : "on, but there are no qualifying orders, so none are shown") : "off"}</li>
        </ul>
      </section>

      <section aria-labelledby="labels" className="mb-6 space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
        <h2 id="labels" className="text-base font-semibold">Editorial labels</h2>
        <p className="text-sm text-[var(--adm-ink-2)]">
          Your own picks, shown with a star and clearly different from the data-backed badge. One label per product; saving again replaces it.
          {settings.editorial.enabled ? "" : " Labels are currently switched off in the settings below."}
        </p>
        <ProductBadgeForm products={(products || []).map((p) => ({ handle: p.handle, title: p.title }))} />
        {badges && badges.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm" data-testid="badge-table">
              <thead className="text-xs uppercase text-[var(--adm-ink-2)]">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Schedule</th>
                  <th className="py-2 pr-3">State</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {badges.map((b) => {
                  const p = b.products as { handle?: string; title?: string } | null;
                  const active = editorialActive({ startsAt: b.starts_at, endsAt: b.ends_at }, now);
                  const future = b.starts_at && Date.parse(b.starts_at) > now.getTime();
                  return (
                    <tr key={b.product_id} className="border-t border-[var(--adm-divider)]" data-testid="badge-row">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{p?.title ?? "(removed product)"}</span>
                        <span className="block font-mono text-xs text-[var(--adm-ink-2)]">{p?.handle}</span>
                      </td>
                      <td className="py-2 pr-3">{EDITORIAL_LABELS[b.kind as EditorialKind] ?? b.kind}</td>
                      <td className="py-2 pr-3 text-xs">
                        {fmt(b.starts_at)} → {fmt(b.ends_at)}
                      </td>
                      <td className="py-2 pr-3">{active ? "Showing" : future ? "Scheduled" : "Ended"}</td>
                      <td className="py-2 text-right">
                        <RemoveBadgeButton productId={b.product_id} title={p?.title ?? "this product"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--adm-ink-2)]">No labels yet.</p>
        )}
      </section>

      {canSettings ? (
        <SocialProofForm initial={settings} />
      ) : (
        <p className="text-sm text-[var(--adm-ink-2)]">Only the owner, admins and managers can change these settings.</p>
      )}
    </>
  );
}
