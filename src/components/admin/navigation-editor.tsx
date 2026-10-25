"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { FooterNavColumn, NavigationConfig, NavigationItem } from "@/lib/content/navigation";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { isLinkPublic, type Visibility } from "@/lib/content/links";

type Props = {
  initialConfig: NavigationConfig;
  visibility: Visibility;
  availableCollections: { slug: string; title: string }[];
  availablePages: { slug: string; title: string; is_published: boolean; legal_approved: boolean }[];
};

export function NavigationEditor({
  initialConfig,
  visibility,
  availableCollections,
  availablePages,
}: Props) {
  const router = useRouter();
  const hydrated = useHydrated();

  const [headerNav, setHeaderNav] = useState<NavigationItem[]>(initialConfig.headerNav || []);
  const [footerColumns, setFooterColumns] = useState<FooterNavColumn[]>(initialConfig.footerColumns || []);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Add item form state
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newIsNew, setNewIsNew] = useState(false);
  const [newType, setNewType] = useState<NavigationItem["type"]>("custom");
  const [showAddHeaderModal, setShowAddHeaderModal] = useState(false);

  // Footer column add state
  const [newColTitle, setNewColTitle] = useState("");
  const [showAddColModal, setShowAddColModal] = useState(false);

  // Link inside footer column add state
  const [targetColId, setTargetColId] = useState<string | null>(null);
  const [colLinkLabel, setColLinkLabel] = useState("");
  const [colLinkHref, setColLinkHref] = useState("");

  // Edit item state
  const [editingItem, setEditingItem] = useState<{
    target: "header" | "footer";
    colId?: string;
    item: NavigationItem;
  } | null>(null);

  // Move helpers
  function moveHeaderItem(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= headerNav.length) return;
    const next = [...headerNav];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setHeaderNav(next);
    setDirty(true);
  }

  function removeHeaderItem(index: number) {
    if (!confirm(`Remove "${headerNav[index].label}" from header navigation?`)) return;
    setHeaderNav(headerNav.filter((_, i) => i !== index));
    setDirty(true);
  }

  function addHeaderItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newHref.trim()) return;
    const item: NavigationItem = {
      id: `h-custom-${Date.now()}`,
      label: newLabel.trim(),
      href: newHref.trim(),
      isNew: newIsNew,
      type: newType,
    };
    setHeaderNav([...headerNav, item]);
    setNewLabel("");
    setNewHref("");
    setNewIsNew(false);
    setNewType("custom");
    setShowAddHeaderModal(false);
    setDirty(true);
  }

  // Footer helpers
  function moveFooterLink(colIndex: number, linkIndex: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? linkIndex - 1 : linkIndex + 1;
    const col = footerColumns[colIndex];
    if (targetIdx < 0 || targetIdx >= col.links.length) return;
    const nextLinks = [...col.links];
    const temp = nextLinks[linkIndex];
    nextLinks[linkIndex] = nextLinks[targetIdx];
    nextLinks[targetIdx] = temp;

    const nextCols = [...footerColumns];
    nextCols[colIndex] = { ...col, links: nextLinks };
    setFooterColumns(nextCols);
    setDirty(true);
  }

  function removeFooterLink(colIndex: number, linkIndex: number) {
    const col = footerColumns[colIndex];
    if (!confirm(`Remove "${col.links[linkIndex].label}" from column "${col.title}"?`)) return;
    const nextCols = [...footerColumns];
    nextCols[colIndex] = {
      ...col,
      links: col.links.filter((_, i) => i !== linkIndex),
    };
    setFooterColumns(nextCols);
    setDirty(true);
  }

  function addFooterLink(e: React.FormEvent) {
    e.preventDefault();
    if (!targetColId || !colLinkLabel.trim() || !colLinkHref.trim()) return;
    const item: NavigationItem = {
      id: `f-link-${Date.now()}`,
      label: colLinkLabel.trim(),
      href: colLinkHref.trim(),
      type: "custom",
    };
    setFooterColumns(
      footerColumns.map((col) =>
        col.id === targetColId ? { ...col, links: [...col.links, item] } : col,
      ),
    );
    setTargetColId(null);
    setColLinkLabel("");
    setColLinkHref("");
    setDirty(true);
  }

  function addFooterColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    const col: FooterNavColumn = {
      id: `col-${Date.now()}`,
      title: newColTitle.trim(),
      links: [],
    };
    setFooterColumns([...footerColumns, col]);
    setNewColTitle("");
    setShowAddColModal(false);
    setDirty(true);
  }

  function removeFooterColumn(colId: string) {
    const col = footerColumns.find((c) => c.id === colId);
    if (!col) return;
    if (!confirm(`Delete footer column "${col.title}" and its ${col.links.length} links?`)) return;
    setFooterColumns(footerColumns.filter((c) => c.id !== colId));
    setDirty(true);
  }

  function updateFooterColumnTitle(colId: string, title: string) {
    setFooterColumns(
      footerColumns.map((c) => (c.id === colId ? { ...c, title } : c)),
    );
    setDirty(true);
  }

  // Save changes
  async function saveNavigation() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headerNav,
          footerColumns,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Failed to save navigation (${res.status})`);
        return;
      }
      setMsg("Navigation configuration published to storefront.");
      setDirty(false);
      router.refresh();
    } catch {
      setErr("Network error while saving navigation.");
    } finally {
      setBusy(false);
    }
  }

  // Restore defaults
  async function restoreDefaults() {
    if (
      !confirm(
        "Reset all header and footer menus to the approved V5 defaults?\n\nAny custom links will be overwritten with the original layout.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_defaults" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Reset failed (${res.status})`);
        return;
      }
      if (data.navigation) {
        setHeaderNav(data.navigation.headerNav || []);
        setFooterColumns(data.navigation.footerColumns || []);
      }
      setMsg("Navigation reset to approved V5 defaults.");
      setDirty(false);
      router.refresh();
    } catch {
      setErr("Network error while resetting navigation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
        <div>
          <p className="font-semibold text-sm text-[var(--adm-ink)]">
            Storefront Menu Controls
            {dirty ? (
              <span className="ml-2 rounded bg-[var(--lh-signal)] px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                Unsaved changes
              </span>
            ) : null}
          </p>
          <p className="text-xs text-[var(--adm-ink-2)]">
            Changes published here immediately update customer header and footer menus without code changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!hydrated || busy}
            onClick={restoreDefaults}
            className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--adm-surface-2)] disabled:opacity-50"
          >
            Reset to V5 defaults
          </button>
          <button
            type="button"
            disabled={!hydrated || busy || !dirty}
            onClick={saveNavigation}
            className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--lh-action-hover)] disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Save & publish navigation"}
          </button>
        </div>
      </div>

      {msg ? <p className="text-sm font-semibold text-[var(--adm-success)]">{msg}</p> : null}
      {err ? <p className="text-sm font-semibold text-[var(--adm-danger)]" role="alert">{err}</p> : null}

      {/* Primary Header Navigation */}
      <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
        <div className="flex flex-wrap items-center justify-between border-b border-[var(--adm-divider)] p-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--adm-ink)]">
              Primary Header Navigation
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Shown on desktop viewports and in the customer slide-out navigation drawer.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => setShowAddHeaderModal(true)}
            className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--adm-surface)]"
          >
            + Add menu item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
              <tr>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Label</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Badge</th>
                <th className="px-5 py-3">Storefront status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--adm-divider)]">
              {headerNav.map((item, idx) => {
                const isPublic = isLinkPublic(item.href, visibility);
                return (
                  <tr key={item.id || item.href} className="hover:bg-[var(--adm-surface-2)]">
                    <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {item.label}
                    </td>
                    <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                      {item.href}
                    </td>
                    <td className="px-5 py-3">
                      {item.isNew ? (
                        <span className="rounded bg-[var(--lh-signal)] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          New
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--adm-ink-2)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={isPublic ? "active" : "draft"}>
                        {isPublic ? "Visible to public" : "Gated (draft)"}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveHeaderItem(idx, "up")}
                        className="rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--adm-surface-3)] disabled:opacity-30"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === headerNav.length - 1}
                        onClick={() => moveHeaderItem(idx, "down")}
                        className="rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--adm-surface-3)] disabled:opacity-30"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHeaderItem(idx)}
                        className="rounded px-2 py-1 text-xs font-semibold text-[var(--adm-danger)] hover:bg-[var(--adm-surface-3)]"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Header Item Form */}
      {showAddHeaderModal ? (
        <form
          onSubmit={addHeaderItem}
          className="rounded-[var(--adm-radius-lg)] border border-[var(--lh-action)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Add Item to Header Menu</h3>
            <button
              type="button"
              onClick={() => setShowAddHeaderModal(false)}
              className="text-xs text-[var(--adm-ink-2)] hover:underline"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Menu Label
              <input
                className="mt-1 w-full rounded border border-[var(--adm-border)] px-3 py-1.5 text-sm"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Workstations"
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Destination URL
              <input
                className="mt-1 w-full rounded border border-[var(--adm-border)] px-3 py-1.5 text-sm font-[family-name:var(--font-mono)]"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="/collections/workstations"
                required
              />
            </label>
          </div>

          {/* Quick pickers */}
          <div className="text-xs space-y-2">
            <p className="font-semibold text-[var(--adm-ink-2)]">Or pick an existing destination:</p>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const col = availableCollections.find((c) => c.slug === e.target.value);
                  if (col) {
                    setNewLabel(col.title);
                    setNewHref(`/collections/${col.slug}`);
                    setNewType("collection");
                  }
                }}
              >
                <option value="">Choose Collection…</option>
                {availableCollections.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title} (/collections/{c.slug})
                  </option>
                ))}
              </select>

              <select
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const page = availablePages.find((p) => p.slug === e.target.value);
                  if (page) {
                    setNewLabel(page.title);
                    setNewHref(`/pages/${page.slug}`);
                    setNewType("page");
                  }
                }}
              >
                <option value="">Choose Policy / Page…</option>
                {availablePages.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.title} (/pages/{p.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={newIsNew}
              onChange={(e) => setNewIsNew(e.target.checked)}
            />
            Display "NEW" badge on menu
          </label>

          <button
            type="submit"
            className="rounded bg-[var(--lh-action)] px-4 py-2 text-xs font-semibold text-white"
          >
            Add to Header Menu
          </button>
        </form>
      ) : null}

      {/* Footer Columns Navigation */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--adm-ink)]">
              Footer Navigation Columns
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Organize footer columns and links. Unpublished policy pages are automatically hidden from customer view.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => setShowAddColModal(true)}
            className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--adm-surface)]"
          >
            + Add Footer Column
          </button>
        </div>

        {/* Add column modal */}
        {showAddColModal ? (
          <form
            onSubmit={addFooterColumn}
            className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--lh-action)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Add New Footer Column</h3>
              <button
                type="button"
                onClick={() => setShowAddColModal(false)}
                className="text-xs text-[var(--adm-ink-2)] hover:underline"
              >
                Cancel
              </button>
            </div>
            <input
              className="w-full max-w-md rounded border border-[var(--adm-border)] px-3 py-1.5 text-sm"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              placeholder="e.g. Services"
              required
            />
            <button
              type="submit"
              className="rounded bg-[var(--lh-action)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Create Column
            </button>
          </form>
        ) : null}

        {/* Add link to specific column form */}
        {targetColId ? (
          <form
            onSubmit={addFooterLink}
            className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--lh-action)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Add Link to Column: {footerColumns.find((c) => c.id === targetColId)?.title}
              </h3>
              <button
                type="button"
                onClick={() => setTargetColId(null)}
                className="text-xs text-[var(--adm-ink-2)] hover:underline"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-[var(--adm-border)] px-3 py-1.5 text-sm"
                value={colLinkLabel}
                onChange={(e) => setColLinkLabel(e.target.value)}
                placeholder="Link text"
                required
              />
              <input
                className="rounded border border-[var(--adm-border)] px-3 py-1.5 text-sm font-[family-name:var(--font-mono)]"
                value={colLinkHref}
                onChange={(e) => setColLinkHref(e.target.value)}
                placeholder="Destination URL (/pages/...)"
                required
              />
            </div>
            <button
              type="submit"
              className="rounded bg-[var(--lh-action)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Add Link
            </button>
          </form>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {footerColumns.map((col, colIdx) => (
            <div
              key={col.id || col.title}
              className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] px-4 py-3">
                <input
                  className="font-semibold text-sm text-[var(--adm-ink)] bg-transparent border-0 focus:ring-1 focus:ring-[var(--lh-action)] rounded px-1"
                  value={col.title}
                  onChange={(e) => updateFooterColumnTitle(col.id, e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetColId(col.id);
                      setColLinkLabel("");
                      setColLinkHref("");
                    }}
                    className="text-xs font-semibold text-[var(--lh-action)] hover:underline"
                    title="Add link to column"
                  >
                    + Link
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFooterColumn(col.id)}
                    className="text-xs text-[var(--adm-danger)] hover:underline"
                    title="Delete column"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-[var(--adm-divider)] text-xs">
                {col.links.length === 0 ? (
                  <li className="px-4 py-3 text-[var(--adm-ink-2)]">No links in this column yet.</li>
                ) : (
                  col.links.map((link, linkIdx) => {
                    const isPublic = isLinkPublic(link.href, visibility);
                    return (
                      <li key={link.id || `${link.href}-${linkIdx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--adm-surface-2)]">
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium text-[var(--adm-ink)]">{link.label}</p>
                          <p className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--adm-ink-2)]">
                            {link.href}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={isPublic ? "active" : "draft"}>
                            {isPublic ? "Visible" : "Hidden"}
                          </StatusBadge>
                          <button
                            type="button"
                            disabled={linkIdx === 0}
                            onClick={() => moveFooterLink(colIdx, linkIdx, "up")}
                            className="px-1 text-xs hover:bg-[var(--adm-surface-3)] rounded disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={linkIdx === col.links.length - 1}
                            onClick={() => moveFooterLink(colIdx, linkIdx, "down")}
                            className="px-1 text-xs hover:bg-[var(--adm-surface-3)] rounded disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFooterLink(colIdx, linkIdx)}
                            className="px-1 text-xs text-[var(--adm-danger)] hover:bg-[var(--adm-surface-3)] rounded"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
