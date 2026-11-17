"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StaffRole } from "@/lib/auth/staff";
import { ADMIN_NAV, navVisibleForRole } from "./nav";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** True when another modal dialog (search, confirmations, etc.) owns the UI. */
const otherModalOpen = () => {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[role="dialog"][aria-modal="true"]:not([data-testid="admin-shortcuts-dialog"])');
};

type GoTarget = { letter: string; keys: string; action: string; href: string };

const GO_TARGETS: GoTarget[] = [
  { letter: "h", keys: "G H", action: "Overview", href: "/admin" },
  { letter: "o", keys: "G O", action: "Orders", href: "/admin/orders" },
  { letter: "p", keys: "G P", action: "Products", href: "/admin/products" },
  { letter: "i", keys: "G I", action: "Inventory", href: "/admin/inventory" },
  { letter: "c", keys: "G C", action: "Customers", href: "/admin/customers" },
  { letter: "t", keys: "G T", action: "Online store (theme)", href: "/admin/online-store" },
  { letter: "s", keys: "G S", action: "Settings", href: "/admin/settings" },
];

function hrefAllowed(href: string, role: StaffRole | null): boolean {
  if (href === "/admin") return true;
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (item.href === href) return navVisibleForRole(item, role);
      for (const child of item.children || []) {
        if (child.href === href) return navVisibleForRole(child, role) && navVisibleForRole(item, role);
      }
    }
  }
  return false;
}

/**
 * Shopify-parity merchant shortcuts: `?` opens help; `G` then a letter navigates.
 * Ignores keys while typing, while another modal is open, and destinations the role cannot open.
 */
export function AdminShortcuts({ role }: { role: StaffRole | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const awaitingGo = useRef(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const goRef = useRef<GoTarget[]>([]);

  const allowedGo = useMemo(() => GO_TARGETS.filter((t) => hrefAllowed(t.href, role)), [role]);
  goRef.current = allowedGo;

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    openRef.current = true;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const clearGo = () => {
      awaitingGo.current = false;
      if (goTimer.current) {
        clearTimeout(goTimer.current);
        goTimer.current = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTyping(e.target)) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        if (otherModalOpen() && !openRef.current) return;
        e.preventDefault();
        if (openRef.current) close();
        else show();
        clearGo();
        return;
      }

      if (openRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        return;
      }

      if (otherModalOpen()) {
        clearGo();
        return;
      }

      if (e.key === "Escape") {
        clearGo();
        return;
      }

      const letter = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (!letter || !/[a-z]/.test(letter)) {
        clearGo();
        return;
      }

      if (!awaitingGo.current) {
        if (letter === "g") {
          e.preventDefault();
          awaitingGo.current = true;
          goTimer.current = setTimeout(clearGo, 1500);
        }
        return;
      }

      const target = goRef.current.find((t) => t.letter === letter);
      clearGo();
      if (target) {
        e.preventDefault();
        router.push(target.href);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearGo();
    };
  }, [show, close, router]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  const sections = useMemo(
    () => [
      {
        group: "Search & help",
        rows: [
          { keys: "Ctrl K", action: "Open admin search" },
          { keys: "/", action: "Open admin search" },
          { keys: "?", action: "Show this shortcuts sheet" },
          { keys: "Esc", action: "Close dialog or drawer" },
        ],
      },
      {
        group: "Go to (press G, then the letter)",
        rows: allowedGo.map((t) => ({ keys: t.keys, action: t.action })),
      },
    ],
    [allowedGo],
  );

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--adm-border)] text-[var(--adm-ink-2)] hover:border-[var(--lh-action)] hover:text-[var(--adm-ink)] sm:inline-flex"
        aria-keyshortcuts="?"
        title="Keyboard shortcuts"
        data-testid="admin-shortcuts-open"
      >
        <span className="sr-only">Keyboard shortcuts</span>
        <kbd className="font-[family-name:var(--font-mono)] text-[11px]" aria-hidden="true">
          ?
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[10vh]"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-2xl"
            data-testid="admin-shortcuts-dialog"
          >
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] px-4 py-3">
              <h2 id={titleId} className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--adm-ink)]">
                Keyboard shortcuts
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-[var(--adm-ink-2)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-ink)]"
                data-testid="admin-shortcuts-close"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
              {sections.map((section) => (
                <div key={section.group}>
                  <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--adm-ink-2)]">
                    {section.group}
                  </p>
                  {section.rows.length === 0 ? (
                    <p className="text-sm text-[var(--adm-ink-2)]">No go-to shortcuts for this role.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {section.rows.map((row) => (
                        <li key={row.keys} className="flex items-baseline justify-between gap-4 text-sm">
                          <span className="text-[var(--adm-ink)]">{row.action}</span>
                          <kbd className="shrink-0 rounded border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--adm-ink)]">
                            {row.keys}
                          </kbd>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <p className="border-t border-[var(--adm-border)] px-4 py-2 text-xs text-[var(--adm-ink-2)]">
              Shortcuts are ignored while typing, and while another dialog is open. Esc closes this sheet.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
