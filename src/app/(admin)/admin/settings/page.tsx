import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { ShippingZoneForm, type ZoneRow } from "./shipping-form";
import { formatPkr } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { ContactSocialForm } from "@/components/admin/contact-social-form";
import { BackupsPanel } from "@/components/admin/backups-panel";
import { CheckoutReadinessPanel } from "@/components/admin/checkout-readiness-panel";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form";
import { NOTIFICATIONS_KEY, maskEmail, normaliseRecipients, parseNotificationSettings } from "@/lib/notify/settings";
import { emailConfigured } from "@/lib/notify/send-email";
import { RETRIES_STOPPED } from "@/lib/notify/outbox";
import { loadCheckoutReadiness } from "@/lib/commerce/checkout-readiness-server";
import { parseStorefrontPresentation, STOREFRONT_PRESENTATION_KEY } from "@/lib/content/storefront-presentation";
import { CONTACT_SOCIAL_KEY, parseContactSocial } from "@/lib/content/contact-social";
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
  { href: "#general", title: "Store details", blurb: "Inventory, buy button and SEO defaults" },
  { href: "#contact-social", title: "Contact & Social", blurb: "Phones, social links, WhatsApp" },
  { href: "#security", title: "Security", blurb: "Change your admin password" },
  { href: "#notifications", title: "Notifications", blurb: "Staff alerts, customer emails, test send" },
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

  // G15: Contact & Social is the single source for the public business name, email and phones.
  const contact = parseContactSocial((settings || []).find((r) => r.key === CONTACT_SOCIAL_KEY)?.value);
  const inventory = readJson(settings, "inventory_defaults");
  const seo = readJson(settings, "seo_defaults");
  const tracking = parseInventoryTracking((settings || []).find((r) => r.key === INVENTORY_TRACKING_KEY)?.value);
  const checkout = parseStorefrontCheckout((settings || []).find((r) => r.key === STOREFRONT_CHECKOUT_KEY)?.value);
  const canNotify = staff.role === "owner" || staff.role === "admin";
  const notifyRow = (settings || []).find((r) => r.key === NOTIFICATIONS_KEY);
  const notify = parseNotificationSettings(notifyRow?.value ?? null);
  const { data: deliveries } = canNotify
    ? await supabase
        .from("notification_outbox")
        .select("id, template, status, attempts, last_error, created_at, sent_at, next_attempt_at, business_status, customer_status, customer_message_id, orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(15)
    : { data: null };

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Find store details, shipping, inventory, checkout behaviour, staff and CMS recovery. Critical COD readiness stays visible — never hidden."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Settings" }]}
      />

      <nav aria-label="Settings categories" className="mb-8 grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {HUB.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 flex-col justify-center rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)] transition hover:border-[var(--adm-action)] sm:min-h-0 sm:p-4"
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
            businessName: contact.businessName,
            supportEmail: contact.email,
            supportPhone: contact.phones.find((p) => p.enabled)?.display ?? "",
            trackProductInventory: tracking.enabled,
            inventoryDefaultTracked: Boolean(inventory.tracked),
            lowStockDefault: Number(inventory.low_stock_threshold || 0),
            pdpCta: checkout.pdpCta,
            seoTitleSuffix: String(seo.title_suffix || ""),
            ...parseStorefrontPresentation((settings || []).find((r) => r.key === STOREFRONT_PRESENTATION_KEY)?.value),
          }}
        />
      </div>

      <ContactSocialForm initial={contact} />

      <div id="security" className="mt-8 scroll-mt-24">
        <AdminCard
          title="Security"
          description="Change the password for the account you are signed in with. This does not send an email. Forgotten passwords use recovery from the sign-in screen."
        >
          <ChangePasswordForm email={staff.email || "your account"} />
        </AdminCard>
      </div>

      {canNotify ? (
        <div id="notifications" className="mt-8 scroll-mt-24">
          <AdminCard
            title="Notifications"
            description="Who is emailed about new orders and inquiries, whether customers get an order email, and the wording. Changes apply to new and retried notifications."
          >
            <NotificationSettingsForm
              initial={{
                recipients: notify.recipients,
                recipientsSaved: notify.source === "settings",
                customerMode: notify.customerMode,
                inquiryAlerts: notify.inquiryAlerts,
                orderSubject: notify.orderSubject,
                customerSubject: notify.customerSubject,
                customerIntro: notify.customerIntro,
              }}
              providerConfigured={emailConfigured()}
              sender={process.env.STORE_FROM_EMAIL || null}
              fallbackRecipients={normaliseRecipients((process.env.STORE_NOTIFY_EMAIL || "").split(",")).map(maskEmail)}
              isOwner={staff.role === "owner"}
            />
            <h3 className="mt-8 font-semibold">Recent notifications</h3>
            <p className="text-xs text-[var(--adm-ink-2)]">
              “Accepted” means the email provider accepted the message; delivery to the inbox is not confirmed. Failed order alerts can be retried from the order page; others retry automatically.
            </p>
            {(deliveries || []).length === 0 ? (
              <p className="mt-2 text-sm text-[var(--adm-ink-2)]">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm" data-testid="notification-deliveries">
                {(deliveries || []).map((n) => {
                  const ord = Array.isArray(n.orders) ? n.orders[0] : n.orders;
                  const stopped = (n.last_error || "").endsWith(RETRIES_STOPPED);
                  return (
                    <li key={n.id} className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2" data-testid="notification-delivery" data-template={n.template} data-status={n.status}>
                      <div className="font-medium">
                        {n.template === "contact_inquiry" ? (
                          <Link href="/admin/inquiries" className="text-[var(--adm-action)] underline">Inquiry alert</Link>
                        ) : ord?.order_number ? (
                          <Link href={`/admin/orders/${encodeURIComponent(ord.order_number)}`} className="text-[var(--adm-action)] underline">Order {ord.order_number}</Link>
                        ) : (
                          n.template
                        )}{" "}
                        · {new Date(n.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} · <span>{n.status}</span> · attempts {n.attempts}
                      </div>
                      <div className="text-xs text-[var(--adm-ink-2)]">
                        Staff alert: {n.business_status} · Customer email:{" "}
                        {n.customer_status === "skipped" && n.customer_message_id ? "test copy sent to staff" : n.customer_status}
                      </div>
                      {n.status === "failed" && !stopped && Number.isFinite(Date.parse(n.next_attempt_at)) ? (
                        <div className="text-xs text-[var(--adm-ink-2)]">Next automatic attempt after {new Date(n.next_attempt_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</div>
                      ) : null}
                      {stopped ? <div className="text-xs font-semibold text-[var(--adm-danger)]">Needs attention — automatic retries stopped.</div> : null}
                      {n.last_error ? <div className="text-xs text-[var(--adm-danger)]">{n.last_error}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>
        </div>
      ) : null}

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
