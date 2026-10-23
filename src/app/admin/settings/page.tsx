import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { PendingBlock } from "@/components/ui/pending-block";
import { ShippingZoneForm, type ZoneRow } from "./shipping-form";
import { formatPkr } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  await requireStaffPage(["owner", "admin", "manager"]);

  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("store_settings").select("key, value");
  const { data: zones } = await supabase
    .from("shipping_zones")
    .select("id, name, provinces, cities, flat_fee_paisa, cod_fee_paisa, is_active, notes")
    .order("name");
  const activeZones = (zones || []).filter((z) => z.is_active).length;
  const codSetting = (settings || []).some((r) => r.key === "cod_checkout" && (r.value as { enabled?: boolean })?.enabled === true);
  const codEnv = process.env.COD_CHECKOUT_ENABLED === "true";

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Store settings</h1>
      <div className="mt-6">
        <PendingBlock title="Checkout readiness" label="Before going live">
          Online checkout opens only when all three are true: at least one active shipping zone (
          {activeZones} now), store setting <code>cod_checkout.enabled</code> ({codSetting ? "on" : "off"}), and the
          Production switch <code>COD_CHECKOUT_ENABLED</code> ({codEnv ? "on" : "off"}). Enter only the cities and fees
          you have agreed with your courier.
        </PendingBlock>
      </div>

      <div className="mt-8">
        <ShippingZoneForm />
      </div>

      <h2 className="mt-10 font-semibold">Shipping zones</h2>
      {(zones || []).length === 0 ? (
        <p className="mt-3 text-sm text-[var(--lh-ink-2)]">No zones yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {zones!.map((z) => (
            <li key={z.id} className="rounded-xl border border-[var(--lh-border)] bg-white p-4 text-sm">
              <p className="font-semibold">
                {z.name} {z.is_active ? "· Active" : "· Inactive"}
              </p>
              <p className="text-[var(--lh-ink-2)]">
                Provinces: {(z.provinces || []).join(", ") || "—"} · Cities: {(z.cities || []).join(", ") || "(all in province)"}
              </p>
              <p className="text-[var(--lh-ink-2)]">
                Delivery {formatPkr(z.flat_fee_paisa)} · COD fee {formatPkr(z.cod_fee_paisa)}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-[var(--lh-action)]">Edit zone</summary>
                <div className="mt-3">
                  <ShippingZoneForm zone={z as ZoneRow} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-semibold">Raw settings</h2>
      <pre className="mt-3 overflow-auto rounded-xl bg-[var(--lh-navy)] p-4 text-xs text-white/80">
        {JSON.stringify(settings, null, 2)}
      </pre>
    </div>
  );
}
