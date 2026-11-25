"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import { AdminSearch } from "./admin-search";
import { AdminShortcuts } from "./admin-shortcuts";
import { ADMIN_NAV, isAdminGuestPath, isNavActive, navVisibleForRole } from "./nav";

export type AdminShellStaff = {
  email: string | null;
  role: StaffRole;
};

type Props = {
  staff: AdminShellStaff | null;
  children: React.ReactNode;
};

export function AdminShell({ staff, children }: Props) {
  const pathname = usePathname() || "/admin";
  const guest = isAdminGuestPath(pathname);
  const [open, setOpen] = useState(false);
  const [openPath, setOpenPath] = useState(pathname);
  const [isNarrow, setIsNarrow] = useState(false);
  const navId = useId();

  // Close the mobile drawer on navigation (state adjusted during render, not in an effect).
  if (openPath !== pathname) {
    setOpenPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const mobileDrawerClosed = isNarrow && !open;

  if (guest) {
    return <div className="admin-app min-h-screen">{children}</div>;
  }

  const role = staff?.role ?? null;

  return (
    <div className="admin-app min-h-screen">
      <a href="#admin-main" className="adm-skip">
        Skip to content
      </a>

      {/* Mobile overlay */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id={navId}
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--adm-sidebar-w)] flex-col border-r border-[var(--adm-sidebar-border)] bg-[var(--adm-sidebar-bg)] text-[var(--adm-sidebar-text)] transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin navigation"
        aria-hidden={mobileDrawerClosed || undefined}
        data-admin-nav-open={open ? "true" : "false"}
        {...(mobileDrawerClosed ? { inert: true } : {})}
      >
        <div className="flex h-[var(--adm-topbar-h)] items-center gap-2 border-b border-[var(--adm-sidebar-border)] px-4">
          <Link href="/admin" className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[-0.02em] text-white uppercase">
            LAPTOPS <span className="rounded bg-[var(--lh-signal)] px-1.5 normal-case tracking-[0.12em] text-white">HUB</span>
          </Link>
          <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--adm-sidebar-muted)]">
            Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
          {ADMIN_NAV.map((section) => {
            const items = section.items.filter((item) => navVisibleForRole(item, role));
            if (items.length === 0) return null;
            return (
              <div key={section.id} className="mb-4">
                <p className="mb-1 px-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--adm-sidebar-muted)]">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavActive(pathname, item.href, item.match);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            active
                              ? "bg-[var(--adm-sidebar-active)] text-white"
                              : "text-[var(--adm-sidebar-text)] hover:bg-[var(--adm-sidebar-hover)] hover:text-white"
                          }`}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                        {active && item.children ? (
                          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--adm-sidebar-border)] pl-2">
                            {item.children
                              .filter((c) => navVisibleForRole(c, role))
                              .map((child) => {
                                const childActive =
                                  child.href === item.href
                                    ? pathname === child.href
                                    : pathname === child.href || pathname.startsWith(`${child.href}/`);
                                return (
                                  <li key={child.href}>
                                    <Link
                                      href={child.href}
                                      className={`block rounded-md px-2 py-1.5 text-xs ${
                                        childActive
                                          ? "text-white"
                                          : "text-[var(--adm-sidebar-muted)] hover:text-white"
                                      }`}
                                      aria-current={childActive ? "page" : undefined}
                                    >
                                      {child.label}
                                    </Link>
                                  </li>
                                );
                              })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--adm-sidebar-border)] p-3">
          <p className="truncate text-xs text-white">{staff?.email ?? "Staff"}</p>
          <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--adm-sidebar-muted)]">
            {staff?.role ?? "—"}
          </p>
          <Link
            href="/admin/account"
            className="mt-2 inline-flex min-h-[44px] items-center text-sm text-[var(--adm-sidebar-muted)] hover:text-white hover:underline"
            data-testid="admin-account-link"
          >
            Your account
          </Link>
          <form action="/api/admin/account/sign-out" method="post" className="mt-2">
            <button
              type="submit"
              className="mt-1 inline-flex min-h-[44px] items-center text-sm text-[var(--adm-sidebar-muted)] hover:text-white hover:underline"
              data-testid="admin-sign-out"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-[var(--adm-sidebar-w)]">
        <header className="sticky top-0 z-30 flex h-[var(--adm-topbar-h)] items-center gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--adm-surface)]/80">
          <button
            type="button"
            data-testid="admin-nav-open"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--adm-border)] text-[var(--adm-ink)] lg:hidden"
            aria-expanded={open}
            aria-controls={navId}
            aria-label="Open admin menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
          <AdminSearch role={role} />
          <AdminShortcuts role={role} />
          <p className="hidden truncate text-sm text-[var(--adm-ink-2)] md:block">
            Merchant console · <span className="text-[var(--adm-ink)]">PKR</span> · COD only
          </p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className="hidden text-sm font-medium text-[var(--adm-action)] hover:underline sm:inline"
            >
              View storefront
            </Link>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 overflow-x-hidden px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
