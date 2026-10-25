import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { PendingBlock } from "@/components/ui/pending-block";
import { ShippingZoneForm, type ZoneRow } from "./shipping-form";
import { formatPkr } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function readJson(settings: { key: string; value: unknown }[] | null, key: string): Record<string, unknown> {
  const row = (settings || []).find((r) => r.key === key);
  if (row && row.value && typeof row.value === "object") return row.value as Record<string, unknown>;
  return {};
}

export default async function AdminSettingsPage() {
  await requireStaffPage(["owner", "admin", "manager"]);

  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("store_settings").select("key, value");
  const { data: zones } = await supabase
    .from("shipping_zones")
    .select("id, name, provinces, cities, flat_fee_paisa, cod_fee_paisa, is_active, notes")
    .order("name");
  const activeZones = (zones || []).filter((z) => z.is_active).length;
  const codSetting = (settings || []).some(
    (r) => r.key === "cod_checkout" && (r.value as { enabled?: boolean })?.enabled === true,
  );
  const codEnv = process.env.COD_CHECKOUT_ENABLED === "true";

  const identity = readJson(settings, "business_identity");
  const inventory = readJson(settings, "inventory_defaults");
  const seo = readJson(settings, "seo_defaults");

  return (
    <>
      <AdminPageHeader
        title="Store settings"
        description="Business identity, shipping, inventory defaults, and COD readiness. Privileged release controls stay env-gated."
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { label: "Settings" },
        ]}
      />

      <div className="mb-6">
        <PendingBlock title="Checkout readiness" label="Before going live">
          Online checkout opens only when all three are true: at least one active shipping zone ({activeZones} now),
          store setting <code>cod_checkout.enabled</code> ({codSetting ? "on" : "off"}), and the Production switch{" "}
          <code>COD_CHECKOUT_ENABLED</code> ({codEnv ? "on" : "off"}). Production COD must stay off until owner
          approval.
        </PendingBlock>
      </div>

      <StoreSettingsForm
        initial={{
          businessName: String(identity.name || "Laptops HUB"),
          supportEmail: String(identity.support_email || ""),
          supportPhone: String(identity.support_phone || ""),
          inventoryDefaultTracked: Boolean(inventory.tracked),
          lowStockDefault: Number(inventory.low_stock_threshold || 0),
          seoTitleSuffix: String(seo.title_suffix || ""),
        }}
      />

      <div className="mt-8">
        <ShippingZoneForm />
      </div>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold">Shipping zones</h2>
      {(zones || []).length === 0 ? (
        <p className="mt-3 text-sm text-[var(--adm-ink-2)]">No zones yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {zones!.map((z) => (
            <li
              key={z.id}
              className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-sm shadow-[var(--adm-shadow)]"
            >
              <p className="font-semibold">
                {z.name} {z.is_active ? "· Active" : "· Inactive"}
              </p>
              <p className="text-[var(--adm-ink-2)]">
                Provinces: {(z.provinces || []).join(", ") || "—"} · Cities:{" "}
                {(z.cities || []).join(", ") || "(all in province)"}
              </p>
              <p className="text-[var(--adm-ink-2)]">
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
    </>
  );
}
