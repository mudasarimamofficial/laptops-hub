"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  NAV_LIMITS,
  V5_HEADER_WIDTH,
  destinationHint,
  estimateHeaderWidth,
  destinationProblem,
  navigationProblems,
  newNavId,
  type FooterNavColumn,
  type NavigationConfig,
  type NavigationItem,
} from "@/lib/content/navigation-rules";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { AdminSaveBar } from "@/components/admin/ui/admin-save-bar";
import { isLinkPublic, type Visibility } from "@/lib/content/links";

export type NavigationHistorySummary = {
  version: number;
  savedAt: string;
  savedBy: string | null;
  action: "save" | "restore_version" | "restore_defaults" | "before_first_edit";
  restoredFrom: number | null;
  headerLabels: string[];
  footerTitles: string[];
  footerLinkCount: number;
};

type Props = {
  initialConfig: NavigationConfig;
  initialHistory: NavigationHistorySummary[];
  visibility: Visibility;
  availableCollections: { slug: string; title: string }[];
  availablePages: { slug: string; title: string; is_published: boolean; legal_approved: boolean }[];
  /** Owner/admin only (the server refuses everyone else). */
  canResetDefaults: boolean;
};

const input =
  "w-full rounded border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 py-1.5 text-sm text-[var(--adm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--adm-action)]";
const iconBtn = "rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--adm-surface-3)] disabled:opacity-30";

const ACTION_LABEL: Record<NavigationHistorySummary["action"], string> = {
  save: "Saved",
  restore_version: "Restored",
  restore_defaults: "Reset to V5 defaults",
  before_first_edit: "Before the first edit",
};

function swap<T>(list: T[], i: number, j: number): T[] {
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function NavigationEditor({
  initialConfig,
  initialHistory,
  visibility,
  availableCollections,
  availablePages,
  canResetDefaults,
}: Props) {
  const router = useRouter();
  const hydrated = useHydrated();

  const [headerNav, setHeaderNav] = useState<NavigationItem[]>(initialConfig.headerNav || []);
  const [footerColumns, setFooterColumns] = useState<FooterNavColumn[]>(initialConfig.footerColumns || []);
  const [version, setVersion] = useState(initialConfig.version);
  const [history, setHistory] = useState<NavigationHistorySummary[]>(initialHistory);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [showAddHeader, setShowAddHeader] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newIsNew, setNewIsNew] = useState(false);
  const [newType, setNewType] = useState<NavigationItem["type"]>("custom");

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");

  const problems = useMemo(() => navigationProblems(headerNav, footerColumns), [headerNav, footerColumns]);
  const headerWidthPct = Math.round((estimateHeaderWidth(headerNav) / V5_HEADER_WIDTH) * 100);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function touch() {
    setDirty(true);
    setMsg(null);
  }

  // Header
  function updateHeader(idx: number, patch: Partial<NavigationItem>) {
    setHeaderNav((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    touch();
  }
  function removeHeaderItem(idx: number) {
    if (!confirm(`Remove "${headerNav[idx].label}" from the header menu?\n\nIt is removed for customers when you save.`)) return;
    setHeaderNav((list) => list.filter((_, i) => i !== idx));
    touch();
  }
  function addHeaderItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || destinationProblem(newHref)) return;
    setHeaderNav((list) => [
      ...list,
      { id: newNavId("h"), label: newLabel.trim(), href: newHref.trim(), isNew: newIsNew || undefined, type: newType },
    ]);
    setNewLabel("");
    setNewHref("");
    setNewIsNew(false);
    setNewType("custom");
    setShowAddHeader(false);
    touch();
  }

  // Footer
  function updateColumn(colIdx: number, patch: Partial<FooterNavColumn>) {
    setFooterColumns((cols) => cols.map((c, i) => (i === colIdx ? { ...c, ...patch } : c)));
    touch();
  }
  function updateFooterLink(colIdx: number, linkIdx: number, patch: Partial<NavigationItem>) {
    setFooterColumns((cols) =>
      cols.map((c, i) => (i === colIdx ? { ...c, links: c.links.map((l, j) => (j === linkIdx ? { ...l, ...patch } : l)) } : c)),
    );
    touch();
  }
  function removeFooterLink(colIdx: number, linkIdx: number) {
    const col = footerColumns[colIdx];
    if (!confirm(`Remove "${col.links[linkIdx].label}" from the "${col.title}" column?`)) return;
    updateColumn(colIdx, { links: col.links.filter((_, j) => j !== linkIdx) });
  }
  function addFooterLink(colIdx: number) {
    const col = footerColumns[colIdx];
    updateColumn(colIdx, { links: [...col.links, { id: newNavId("f"), label: "", href: "", type: "custom" }] });
  }
  function addFooterColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    setFooterColumns((cols) => [...cols, { id: newNavId("col"), title: newColTitle.trim(), links: [] }]);
    setNewColTitle("");
    setShowAddCol(false);
    touch();
  }
  function removeFooterColumn(colIdx: number) {
    const col = footerColumns[colIdx];
    if (!confirm(`Delete the footer column "${col.title}" and its ${col.links.length} links?`)) return;
    setFooterColumns((cols) => cols.filter((_, i) => i !== colIdx));
    touch();
  }

  async function send(method: "PUT" | "POST", body: object, success: string) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/navigation", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStale(res.status === 409 || data.error === "version_required");
        setErr(data.message || data.error || `Could not save (${res.status}). Nothing was changed.`);
        return;
      }
      const nav = data.navigation as NavigationConfig;
      setHeaderNav(nav.headerNav);
      setFooterColumns(nav.footerColumns);
      setVersion(nav.version);
      if (Array.isArray(data.history)) setHistory(data.history);
      setDirty(false);
      setStale(false);
      setMsg(`${success} Version ${nav.version} is live.${data.historyWarning ? ` ${data.historyWarning}` : ""}`);
      router.refresh();
    } catch {
      setErr("Network error: nothing was changed. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (problems.length) {
      setErr(`Fix this first — ${problems[0].where}: ${problems[0].message}`);
      return;
    }
    const emptyParts = [headerNav.length === 0 ? "header" : null, footerColumns.length === 0 ? "footer" : null].filter(Boolean);
    if (emptyParts.length && !confirm(`The ${emptyParts.join(" and ")} menu will be empty for customers. Publish anyway?`)) return;
    void send("PUT", { headerNav, footerColumns, expectedVersion: version }, "Navigation published.");
  }

  function restoreVersion(v: number) {
    const lose = dirty ? "\n\nYour unsaved changes on this screen will be discarded." : "";
    if (!confirm(`Publish version ${v} again? It becomes a new version; nothing in the history is deleted.${lose}`)) return;
    void send("POST", { action: "restore_version", version: v, expectedVersion: version }, `Version ${v} restored.`);
  }

  function restoreDefaults() {
    if (!confirm("Reset the header and footer menus to the approved V5 defaults?\n\nThe current menus stay in the version history, so you can restore them later.")) return;
    void send("POST", { action: "restore_defaults", expectedVersion: version }, "Menus reset to the V5 defaults.");
  }

  const hrefError = (href: string) => (href ? destinationProblem(href) : "Enter where the link goes.");
  const hint = (href: string) => (destinationProblem(href) ? null : destinationHint(href, availableCollections, availablePages));

  return (
    <div className="space-y-8" data-testid="navigation-editor" data-version={version}>
      <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-sm shadow-[var(--adm-shadow)]">
        <p className="font-semibold text-[var(--adm-ink)]">
          Live version <span data-testid="nav-live-version">{version}</span>
          {dirty ? (
            <span className="ml-2 rounded bg-[var(--adm-warning)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Unsaved changes</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
          Saving publishes to every page of the store within a few seconds: the desktop header, the mobile menu (under “Quick links”) and the footer.
        </p>
      </div>

      {stale ? (
        <div role="alert" className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-danger)] bg-[var(--adm-surface)] p-4 text-sm">
          <p className="font-semibold text-[var(--adm-danger)]">This screen is out of date.</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Someone else published navigation after you opened it. Reload to see their version, then make your change again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded border border-[var(--adm-border)] px-3 py-1.5 text-xs font-semibold">
            Reload navigation
          </button>
        </div>
      ) : null}

      {/* Header */}
      <section className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]" aria-labelledby="nav-header-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--adm-divider)] p-5">
          <div>
            <h2 id="nav-header-h" className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--adm-ink)]">
              Header menu
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Links beside the “Laptops” menu on wide screens, and under “Quick links” in the mobile menu. One level only — the “Laptops” menu itself is
              built automatically from your collections. Up to {NAV_LIMITS.headerItems} links.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated || headerNav.length >= NAV_LIMITS.headerItems}
            onClick={() => setShowAddHeader(true)}
            className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--adm-surface)] disabled:opacity-50"
          >
            + Add header link
          </button>
        </div>

        {headerWidthPct > 100 ? (
          <p data-testid="nav-header-width-warning" role="status" className="border-b border-[var(--adm-divider)] px-5 py-3 text-xs text-[var(--adm-warning)]">
            These links take about {headerWidthPct}% of the room the standard header uses. On laptop screens about 1180–1366px wide the last links
            may be cut off (they stay in the mobile menu). Shorten names, drop a “NEW” badge, or move some links to the footer.
          </p>
        ) : null}
        {headerNav.length === 0 ? (
          <p data-testid="nav-header-empty" className="p-5 text-sm text-[var(--adm-ink-2)]">
            The header menu is empty. Customers will see only the “Laptops” menu, search, compare and cart — no extra links. Add a link, or restore an earlier
            version below.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--adm-divider)]">
            {headerNav.map((item, idx) => {
              const n = idx + 1;
              const herr = hrefError(item.href);
              const h = hint(item.href);
              const isPublic = !herr && isLinkPublic(item.href, visibility);
              return (
                <li key={item.id} data-testid="nav-header-row" className="grid gap-2 p-4 sm:grid-cols-[2rem_1fr_1.4fr_auto] sm:items-start">
                  <span className="pt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">{n}</span>
                  <label className="block text-xs font-medium text-[var(--adm-ink-2)]">
                    Name
                    <input
                      className={input}
                      aria-label={`Header link ${n} name`}
                      value={item.label}
                      maxLength={NAV_LIMITS.label}
                      onChange={(e) => updateHeader(idx, { label: e.target.value })}
                    />
                    {!item.label.trim() ? <span className="mt-1 block text-[var(--adm-danger)]">Give the link a name.</span> : null}
                  </label>
                  <div className="text-xs font-medium text-[var(--adm-ink-2)]">
                    <label className="block">
                      Goes to
                      <input
                        className={`${input} font-[family-name:var(--font-mono)]`}
                        aria-label={`Header link ${n} address`}
                        aria-invalid={!!herr}
                        value={item.href}
                        maxLength={NAV_LIMITS.href}
                        onChange={(e) => updateHeader(idx, { href: e.target.value })}
                      />
                    </label>
                    {herr ? <span className="mt-1 block text-[var(--adm-danger)]">{herr}</span> : h ? <span className="mt-1 block text-[var(--adm-warning)]">{h}</span> : null}
                    <span className="mt-1 flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 font-normal">
                        <input type="checkbox" checked={!!item.isNew} onChange={(e) => updateHeader(idx, { isNew: e.target.checked || undefined })} aria-label={`Header link ${n} NEW badge`} />
                        “NEW” badge
                      </label>
                      <StatusBadge status={isPublic ? "active" : "draft"}>{isPublic ? "Shown to customers" : "Hidden until its page is published"}</StatusBadge>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:pt-5">
                    <button type="button" disabled={idx === 0} onClick={() => { setHeaderNav((l) => swap(l, idx, idx - 1)); touch(); }} className={iconBtn} aria-label={`Move header link ${n} up`}>
                      ↑
                    </button>
                    <button type="button" disabled={idx === headerNav.length - 1} onClick={() => { setHeaderNav((l) => swap(l, idx, idx + 1)); touch(); }} className={iconBtn} aria-label={`Move header link ${n} down`}>
                      ↓
                    </button>
                    <button type="button" onClick={() => removeHeaderItem(idx)} className={`${iconBtn} text-[var(--adm-danger)]`} aria-label={`Remove header link ${n}`}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {showAddHeader ? (
        <form
          onSubmit={addHeaderItem}
          aria-label="Add header link"
          className="space-y-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-action)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Add a header link</h3>
            <button type="button" onClick={() => setShowAddHeader(false)} className="text-xs text-[var(--adm-ink-2)] hover:underline">
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Name
              <input className={input} value={newLabel} maxLength={NAV_LIMITS.label} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Workstations" required />
            </label>
            <label className="block text-xs font-medium">
              Goes to
              <input
                className={`${input} font-[family-name:var(--font-mono)]`}
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="/collections/workstations"
                required
              />
              {newHref && destinationProblem(newHref) ? <span className="mt-1 block text-[var(--adm-danger)]">{destinationProblem(newHref)}</span> : null}
            </label>
          </div>
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-[var(--adm-ink-2)]">Or pick an existing collection or page:</p>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Pick a collection"
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs"
                value=""
                onChange={(e) => {
                  const col = availableCollections.find((c) => c.slug === e.target.value);
                  if (col) {
                    setNewLabel(col.title.slice(0, NAV_LIMITS.label));
                    setNewHref(`/collections/${col.slug}`);
                    setNewType("collection");
                  }
                }}
              >
                <option value="">Choose a collection…</option>
                {availableCollections.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title} (/collections/{c.slug})
                  </option>
                ))}
              </select>
              <select
                aria-label="Pick a page"
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs"
                value=""
                onChange={(e) => {
                  const page = availablePages.find((p) => p.slug === e.target.value);
                  if (page) {
                    setNewLabel(page.title.slice(0, NAV_LIMITS.label));
                    setNewHref(`/pages/${page.slug}`);
                    setNewType("page");
                  }
                }}
              >
                <option value="">Choose a page…</option>
                {availablePages.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.title} (/pages/{p.slug}){p.is_published ? "" : " — not published"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={newIsNew} onChange={(e) => setNewIsNew(e.target.checked)} />
            Show a “NEW” badge
          </label>
          <button
            type="submit"
            disabled={!newLabel.trim() || !!destinationProblem(newHref)}
            className="rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
          >
            Add to header
          </button>
        </form>
      ) : null}

      {/* Footer */}
      <section aria-labelledby="nav-footer-h">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="nav-footer-h" className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--adm-ink)]">
              Footer columns
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Each column has a heading and its links (two levels). Links to pages that are not published are hidden from customers automatically, and a
              column with no visible links is hidden. Up to {NAV_LIMITS.footerColumns} columns of {NAV_LIMITS.footerLinksPerColumn} links.
            </p>
          </div>
          <button
            type="button"
            disabled={!hydrated || footerColumns.length >= NAV_LIMITS.footerColumns}
            onClick={() => setShowAddCol(true)}
            className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--adm-surface)] disabled:opacity-50"
          >
            + Add footer column
          </button>
        </div>

        {showAddCol ? (
          <form onSubmit={addFooterColumn} aria-label="Add footer column" className="mb-6 space-y-3 rounded-[var(--adm-radius-lg)] border border-[var(--adm-action)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Add a footer column</h3>
              <button type="button" onClick={() => setShowAddCol(false)} className="text-xs text-[var(--adm-ink-2)] hover:underline">
                Cancel
              </button>
            </div>
            <label className="block max-w-md text-xs font-medium">
              Column heading
              <input className={input} value={newColTitle} maxLength={NAV_LIMITS.columnTitle} onChange={(e) => setNewColTitle(e.target.value)} placeholder="e.g. Services" required />
            </label>
            <button type="submit" className="rounded bg-[var(--adm-action)] px-3 py-1.5 text-xs font-semibold text-white">
              Create column
            </button>
          </form>
        ) : null}

        {footerColumns.length === 0 ? (
          <p data-testid="nav-footer-empty" className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 text-sm text-[var(--adm-ink-2)]">
            The footer has no link columns. Customers will see only the store name, tagline, contact details and social links. Add a column, or restore
            an earlier version below.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {footerColumns.map((col, colIdx) => {
              const c = colIdx + 1;
              return (
                <div key={col.id} data-testid="nav-footer-column" className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
                  <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] px-4 py-3">
                    <label className="block min-w-0 flex-1 text-xs font-medium text-[var(--adm-ink-2)]">
                      Column {c} heading
                      <input
                        className={`${input} font-semibold`}
                        aria-label={`Footer column ${c} heading`}
                        value={col.title}
                        maxLength={NAV_LIMITS.columnTitle}
                        onChange={(e) => updateColumn(colIdx, { title: e.target.value })}
                      />
                      {!col.title.trim() ? <span className="mt-1 block text-[var(--adm-danger)]">Give the column a heading.</span> : null}
                    </label>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={colIdx === 0} onClick={() => { setFooterColumns((l) => swap(l, colIdx, colIdx - 1)); touch(); }} className={iconBtn} aria-label={`Move footer column ${c} left`}>
                        ←
                      </button>
                      <button type="button" disabled={colIdx === footerColumns.length - 1} onClick={() => { setFooterColumns((l) => swap(l, colIdx, colIdx + 1)); touch(); }} className={iconBtn} aria-label={`Move footer column ${c} right`}>
                        →
                      </button>
                      <button type="button" onClick={() => removeFooterColumn(colIdx)} className={`${iconBtn} text-[var(--adm-danger)]`} aria-label={`Delete footer column ${c}`}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <ul className="divide-y divide-[var(--adm-divider)] text-xs">
                    {col.links.length === 0 ? <li className="px-4 py-3 text-[var(--adm-ink-2)]">No links yet — this column stays hidden from customers until it has one.</li> : null}
                    {col.links.map((link, linkIdx) => {
                      const l = linkIdx + 1;
                      const herr = hrefError(link.href);
                      const h = hint(link.href);
                      const isPublic = !herr && isLinkPublic(link.href, visibility);
                      return (
                        <li key={link.id} data-testid="nav-footer-link" className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-start">
                          <label className="block font-medium text-[var(--adm-ink-2)]">
                            Name
                            <input className={input} aria-label={`Footer column ${c} link ${l} name`} value={link.label} maxLength={NAV_LIMITS.label} onChange={(e) => updateFooterLink(colIdx, linkIdx, { label: e.target.value })} />
                            {!link.label.trim() ? <span className="mt-1 block text-[var(--adm-danger)]">Give the link a name.</span> : null}
                          </label>
                          <label className="block font-medium text-[var(--adm-ink-2)]">
                            Goes to
                            <input
                              className={`${input} font-[family-name:var(--font-mono)]`}
                              aria-label={`Footer column ${c} link ${l} address`}
                              aria-invalid={!!herr}
                              value={link.href}
                              maxLength={NAV_LIMITS.href}
                              onChange={(e) => updateFooterLink(colIdx, linkIdx, { href: e.target.value })}
                            />
                            {herr ? <span className="mt-1 block text-[var(--adm-danger)]">{herr}</span> : h ? <span className="mt-1 block text-[var(--adm-warning)]">{h}</span> : null}
                            {!herr ? (
                              <span className="mt-1 block">
                                <StatusBadge status={isPublic ? "active" : "draft"}>{isPublic ? "Shown" : "Hidden until published"}</StatusBadge>
                              </span>
                            ) : null}
                          </label>
                          <div className="flex items-center gap-1 sm:pt-5">
                            <button type="button" disabled={linkIdx === 0} onClick={() => updateColumn(colIdx, { links: swap(col.links, linkIdx, linkIdx - 1) })} className={iconBtn} aria-label={`Move footer column ${c} link ${l} up`}>
                              ↑
                            </button>
                            <button type="button" disabled={linkIdx === col.links.length - 1} onClick={() => updateColumn(colIdx, { links: swap(col.links, linkIdx, linkIdx + 1) })} className={iconBtn} aria-label={`Move footer column ${c} link ${l} down`}>
                              ↓
                            </button>
                            <button type="button" onClick={() => removeFooterLink(colIdx, linkIdx)} className={`${iconBtn} text-[var(--adm-danger)]`} aria-label={`Remove footer column ${c} link ${l}`}>
                              ✕
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="border-t border-[var(--adm-divider)] px-4 py-2">
                    <button
                      type="button"
                      disabled={col.links.length >= NAV_LIMITS.footerLinksPerColumn}
                      onClick={() => addFooterLink(colIdx)}
                      className="text-xs font-semibold text-[var(--adm-action)] hover:underline disabled:opacity-50"
                    >
                      + Add link to “{col.title || `column ${c}`}”
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]" aria-labelledby="nav-history-h">
        <div className="border-b border-[var(--adm-divider)] p-5">
          <h2 id="nav-history-h" className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--adm-ink)]">
            Version history
          </h2>
          <p className="text-xs text-[var(--adm-ink-2)]">
            The last {NAV_LIMITS.history} published versions. Restoring publishes that version again as a new version; nothing is deleted.
            {canResetDefaults ? "" : " Only an owner or admin can reset to the V5 defaults; you can restore any version listed here."}
          </p>
        </div>
        {history.length === 0 ? (
          <p className="p-5 text-sm text-[var(--adm-ink-2)]">No saved versions yet. The store shows the approved V5 menus until the first save.</p>
        ) : (
          <ul className="divide-y divide-[var(--adm-divider)] text-xs">
            {history.map((h) => (
              <li key={h.version} data-testid="nav-history-row" data-version={h.version} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--adm-ink)]">
                    Version {h.version} · {ACTION_LABEL[h.action]}
                    {h.restoredFrom ? ` from version ${h.restoredFrom}` : ""}
                    {h.version === version ? <span className="ml-2 text-[var(--adm-success)]">Live now</span> : null}
                  </p>
                  <p className="text-[var(--adm-ink-2)]">
                    {hydrated ? new Date(h.savedAt).toLocaleString() : h.savedAt}
                    {h.savedBy ? ` · ${h.savedBy}` : ""} · Header: {h.headerLabels.length ? h.headerLabels.join(", ") : "empty"} · Footer: {h.footerTitles.length} columns,{" "}
                    {h.footerLinkCount} links
                  </p>
                </div>
                {h.version !== version ? (
                  <button
                    type="button"
                    disabled={!hydrated || busy}
                    onClick={() => restoreVersion(h.version)}
                    className="rounded border border-[var(--adm-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--adm-surface-2)] disabled:opacity-50"
                    aria-label={`Restore version ${h.version}`}
                  >
                    Restore
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {problems.length ? (
        <div data-testid="nav-problems" role="status" className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-danger)] bg-[var(--adm-surface)] p-4 text-xs">
          <p className="font-semibold text-[var(--adm-danger)]">Fix before publishing ({problems.length})</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--adm-ink-2)]">
            {problems.slice(0, 6).map((p, i) => (
              <li key={i}>
                {p.where}: {p.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdminSaveBar
        dirty={dirty}
        busy={busy || !hydrated}
        savedMessage={msg}
        error={err}
        onSave={save}
        saveLabel="Save & publish navigation"
        secondary={
          canResetDefaults ? (
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={restoreDefaults}
              className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Reset to V5 defaults
            </button>
          ) : null
        }
      />
    </div>
  );
}
