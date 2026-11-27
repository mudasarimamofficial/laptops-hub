import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ADMIN_NAV, navVisibleForRole } from "@/components/admin/shell/nav";
import { requireStaffPage, type StaffRole } from "@/lib/auth/staff";
import { loadCheckoutReadiness } from "@/lib/commerce/checkout-readiness-server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Everyday tasks, each linked to the screen that does it. Shown only to roles that screen admits (same rule as the sidebar). */
const TASKS: { href: string; label: string; detail: string }[] = [
  { href: "/admin/orders", label: "Confirm, ship and close orders", detail: "Open an order to move it to the next status, add courier tracking or record cash collected." },
  { href: "/admin/products", label: "Add or edit a product", detail: "Prices, variants, stock, photos and specs. Drafts stay hidden from customers." },
  { href: "/admin/inventory", label: "Receive or count stock", detail: "Every change is kept in the stock history." },
  { href: "/admin/products/import", label: "Import products from a CSV", detail: "Always run the check (dry run) first; nothing is saved until you commit." },
  { href: "/admin/discounts", label: "Run a discount", detail: "Percent or fixed, with optional start and end dates." },
  { href: "/admin/collections", label: "Organise collections", detail: "Pick products by hand or with rules." },
  { href: "/admin/online-store", label: "Change the homepage and site text", detail: "Edit a draft, preview it, then publish. Earlier versions can be restored." },
  { href: "/admin/navigation", label: "Change the menu and footer links", detail: "Saved changes go live at once; earlier versions can be restored." },
  { href: "/admin/content", label: "Edit store pages and policies", detail: "Policy pages need legal approval before customers can see them." },
  { href: "/admin/settings", label: "Store details, delivery fees, notifications and backups", detail: "Fee changes affect future quotes only; placed orders keep their amounts." },
  { href: "/admin/staff", label: "Invite staff and set roles", detail: "Each role sees only the screens it needs." },
  { href: "/admin/activity", label: "See who changed what", detail: "Search the activity log by word, staff member or period." },
];

/** Roles of the sidebar entry for href (a child inherits its parent's roles). Unknown links are owner/admin only. */
function rolesFor(href: string): StaffRole[] | undefined {
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (item.href === href) return item.roles;
      const child = item.children?.find((c) => c.href === href);
      if (child) return child.roles ?? item.roles;
    }
  }
  return ["owner", "admin"];
}

export default async function AdminHelpPage() {
  const staff = await requireStaffPage();
  const readiness = await loadCheckoutReadiness();
  const tasks = TASKS.filter((t) => navVisibleForRole({ roles: rolesFor(t.href) }, staff.role));
  return (
    <>
      <AdminPageHeader
        title="Help"
        description="Where to do everyday tasks. You only see the tasks your role can do."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Help" }]}
      />
      <div className="max-w-3xl space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm">
        <p data-testid="help-ordering-status" role="status" className="rounded-[var(--adm-radius)] bg-[var(--adm-surface-2)] px-3 py-2">
          {readiness.open
            ? "Customer ordering (cash on delivery) is open right now."
            : "Customer ordering (cash on delivery) is closed right now."}{" "}
          <Link href="/admin" className="font-semibold text-[var(--adm-action)] underline">
            See why on Overview
          </Link>
          . Opening or closing ordering is an owner decision.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Everyday tasks</h2>
        <ul className="space-y-3" data-testid="help-tasks">
          {tasks.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="font-semibold text-[var(--adm-action)] hover:underline">
                {t.label}
              </Link>
              <span className="block text-[var(--adm-ink-2)]">{t.detail}</span>
            </li>
          ))}
        </ul>
        <p className="text-[var(--adm-ink-2)]">
          Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to search orders and products. Never publish shipping fees, warranty
          terms or photo-rights approvals that the owner has not confirmed.
        </p>
      </div>
    </>
  );
}
