import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { ShippingZoneForm, type ZoneRow } from "./shipping-form";
import { formatPkr } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { BackupsPanel } from "@/components/admin/backups-panel";
import { CheckoutReadinessPanel } from "@/components/admin/checkout-readiness-panel";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { loadCheckoutReadiness } from "@/lib/commerce/checkout-readiness-server";
import { parseStorefrontPresentation, STOREFRONT_PRESENTATION_KEY } from "@/lib/content/storefront-presentation";
import {
  INVENTORY_TRACKING_KEY,
  STOREFRONT_CHECKOUT_KEY,
  parseInventoryTracking,
  parseStorefrontCheckout,
} from "@/lib/commerce/store-commerce-settings";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function readJson(settings: { key: string; value: unknown }[] | null, key: string): Record<string, unknown> {
  const row = (settings || []).find((r) => r.key === key);
  if (row && row.value && typeof row.value === "object") return row.value as Record<string, unknown>;
  return {};
}

const HUB = [
  { href: "#general", title: "Store details", blurb: "Business name and support contacts" },
  { href: "#security", title: "Security", blurb: "Change your admin password" },
  { href: "#inventory", title: "Products & inventory", blurb: "Tracking defaults and stock alerts" },
  { href: "#checkout", title: "Checkout & storefront", blurb: "Buy now / cart and presentation" },
  { href: "#shipping", title: "Shipping & COD fees", blurb: "Zones, delivery and COD amounts" },
  { href: "#readiness", title: "COD readiness", blurb: "What still blocks customer ordering" },
  { href: "#backups", title: "Backups & recovery", blurb: "CMS snapshots — not full database backups" },
  { href: "/admin/staff", title: "Staff access", blurb: "Invite and manage admin logins" },
  { href: "/admin/activity", title: "Activity history", blurb: "Who changed what" },
] as const;

export default async function AdminSettingsPage() {
  const staff = await requireStaffPage(["owner", "admin", "manager"]);

  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("store_settings").select("key, value");
  const { data: zones } = await supabase
    .from("shipping_zones")
    .select("id, name, provinces, cities, excluded_cities, flat_fee_paisa, cod_fee_paisa, free_shipping_min_paisa, is_active, notes")
    .order("name");
  const readiness = await loadCheckoutReadiness();

  const identity = readJson(settings, "business_identity");
  const inventory = readJson(settings, "inventory_defaults");
  const seo = readJson(settings, "seo_defaults");
  const tracking = parseInventoryTracking((settings || []).find((r) => r.key === INVENTORY_TRACKING_KEY)?.value);
  const checkout = parseStorefrontCheckout((settings || []).find((r) => r.key === STOREFRONT_CHECKOUT_KEY)?.value);

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Find store details, shipping, inventory, checkout behaviour, staff and CMS recovery. Critical COD readiness stays visible — never hidden."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Settings" }]}
      />

      <nav aria-label="Settings categories" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HUB.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] transition hover:border-[var(--adm-action)]"
          >
            <p className="text-sm font-semibold text-[var(--adm-ink)]">{item.title}</p>
            <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{item.blurb}</p>
          </Link>
        ))}
      </nav>

      <div id="readiness" className="mb-6 scroll-mt-24">
        <CheckoutReadinessPanel readiness={readiness} />
      </div>

      <div id="general" className="scroll-mt-24">
        <StoreSettingsForm
          initial={{
            businessName: String(identity.name || "Laptops HUB"),
            supportEmail: String(identity.support_email || ""),
            supportPhone: String(identity.support_phone || ""),
            trackProductInventory: tracking.enabled,
            inventoryDefaultTracked: Boolean(inventory.tracked),
            lowStockDefault: Number(inventory.low_stock_threshold || 0),
            pdpCta: checkout.pdpCta,
            seoTitleSuffix: String(seo.title_suffix || ""),
            ...parseStorefrontPresentation((settings || []).find((r) => r.key === STOREFRONT_PRESENTATION_KEY)?.value),
          }}
        />
      </div>

      <div id="security" className="mt-8 scroll-mt-24">
        <AdminCard
          title="Security"
          description="Change the password for the account you are signed in with. This does not send an email. Forgotten passwords use recovery from the sign-in screen."
        >
          <ChangePasswordForm email={staff.email || "your account"} />
        </AdminCard>
      </div>

      {(staff.role === "owner" || staff.role === "admin") ? (
        <div id="backups" className="mt-8 scroll-mt-24">
          <AdminCard
            title="Backups & recovery"
            description="These are application/CMS snapshots (settings, blog, reels, reviews, shipping zones). They are not full PostgreSQL database backups. Products, orders, customers and staff are not restored from these snapshots."
          >
            <BackupsPanel canRestore={staff.role === "owner"} />
          </AdminCard>
        </div>
      ) : null}

      <div id="shipping" className="mt-8 scroll-mt-24">
        <AdminCard
          title="Shipping & COD fees"
          description="Saving delivery or COD fees does not open customer ordering. Production COD stays off until the owner approves policies, fees and the COD enablement flags."
        >
          <div className="mb-4 rounded-[var(--adm-radius)] border border-[var(--adm-warning)] bg-[var(--adm-warning-bg)] px-3 py-2 text-sm text-[var(--adm-warning)]">
            Fee changes affect future quotes. Existing placed orders keep the amounts already charged.
          </div>
          <ShippingZoneForm />
        </AdminCard>
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
                {z.excluded_cities?.length ? ` · Not served: ${z.excluded_cities.join(", ")}` : ""}
              </p>
              <p className="text-[var(--adm-ink-2)]">
                Delivery {formatPkr(z.flat_fee_paisa)} · COD fee {formatPkr(z.cod_fee_paisa)}
                {z.free_shipping_min_paisa != null ? ` · Free delivery from ${formatPkr(z.free_shipping_min_paisa)}` : ""}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold text-[var(--adm-action)]">Edit zone</summary>
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
