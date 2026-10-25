import type { StaffRole } from "@/lib/auth/staff";

export type AdminNavItem = {
  href: string;
  label: string;
  /** Match prefix for active state; defaults to href */
  match?: string;
  roles?: StaffRole[];
  children?: { href: string; label: string; roles?: StaffRole[] }[];
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Merchant IA — inspired by Shopify ops patterns; LH-specific. */
export const ADMIN_NAV: AdminNavSection[] = [
  {
    id: "ops",
    label: "Operations",
    items: [
      { href: "/admin", label: "Overview", match: "/admin$" },
      {
        href: "/admin/orders",
        label: "Orders",
        roles: ["owner", "admin", "manager", "fulfillment"],
      },
      {
        href: "/admin/inquiries",
        label: "Inquiries",
        roles: ["owner", "admin", "manager", "fulfillment", "editor"],
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        roles: ["owner", "admin", "manager", "editor"],
        children: [
          { href: "/admin/products", label: "All products" },
          { href: "/admin/products/new", label: "Add product" },
          { href: "/admin/products/import", label: "Import" },
          { href: "/admin/products/export", label: "Export" },
          { href: "/admin/products/bulk", label: "Bulk editor" },
        ],
      },
      {
        href: "/admin/collections",
        label: "Collections",
        roles: ["owner", "admin", "manager", "editor"],
      },
      {
        href: "/admin/inventory",
        label: "Inventory",
        roles: ["owner", "admin", "manager"],
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      {
        href: "/admin/customers",
        label: "Customers",
        roles: ["owner", "admin", "manager"],
      },
    ],
  },
  {
    id: "online",
    label: "Online store",
    items: [
      {
        href: "/admin/online-store",
        label: "Customize",
        roles: ["owner", "admin", "editor"],
      },
      {
        href: "/admin/content",
        label: "Pages",
        roles: ["owner", "admin", "editor"],
      },
      {
        href: "/admin/navigation",
        label: "Navigation",
        roles: ["owner", "admin", "editor"],
      },
      {
        href: "/admin/media",
        label: "Media library",
        roles: ["owner", "admin", "manager", "editor"],
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        roles: ["owner", "admin", "manager"],
      },
      {
        href: "/admin/seo",
        label: "SEO & redirects",
        roles: ["owner", "admin", "editor"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        roles: ["owner", "admin", "manager"],
      },
      {
        href: "/admin/activity",
        label: "Activity log",
        roles: ["owner", "admin"],
      },
      {
        href: "/admin/help",
        label: "Help",
      },
    ],
  },
];

export function navVisibleForRole(item: { roles?: StaffRole[] }, role: StaffRole | null): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export function isNavActive(pathname: string, href: string, match?: string): boolean {
  if (match) {
    try {
      return new RegExp(match).test(pathname);
    } catch {
      return pathname === href;
    }
  }
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ADMIN_GUEST_PREFIXES = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/forbidden",
  "/admin/auth",
];

export function isAdminGuestPath(pathname: string): boolean {
  return ADMIN_GUEST_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
