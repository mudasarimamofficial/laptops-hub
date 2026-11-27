"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { diffLines, htmlToLines } from "@/lib/content/text-diff";

type Revision = {
  version: number;
  action: string;
  slug: string;
  title: string;
  body_html: string;
  status: string;
  legal_approved: boolean;
  seo_title: string | null;
  seo_description: string | null;
  savedBy: string;
  saved_at: string;
  note: string;
  restored_from: number | null;
};

const ACTION: Record<string, string> = {
  baseline: "Starting point",
  create: "Created",
  save: "Saved",
  publish: "Published",
  unpublish: "Unpublished",
  restore: "Restored",
  rename: "Address changed",
};

const btn = "rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold disabled:opacity-40";

/**
 * G19: a page's saved versions. Compare shows what changed between that version and the current one (text only);
 * restore brings back its title, body and search fields as a new version (status, approval and address stay).
 */
export function ContentHistory({ slug, version }: { slug: string; version: number | null }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Revision[] | null>(null);
  const [compare, setCompare] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const api = `/api/admin/content/${encodeURIComponent(slug)}/revisions`;

  async function load() {
    setErr(null);
    const res = await fetch(api, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.message || `History could not be loaded (${res.status}).`);
      return;
    }
    setList(data.revisions as Revision[]);
  }

  async function restore(v: number) {
    if (version === null) return;
    if (!window.confirm(`Restore version ${v}? Its title, text and search fields become a new version. Nothing is deleted.`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: v, expectedVersion: version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `Restore failed (${res.status}). Nothing was changed.`);
        return;
      }
      setMsg(data.message || "Restored.");
      setCompare(null);
      await load();
      router.refresh();
    } catch {
      setErr("Network error: nothing was changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const current = list?.[0];
  const other = list?.find((r) => r.version === compare);

  return (
    <div className="mt-4 border-t border-[var(--adm-divider)] pt-3" data-testid="content-history">
      <button
        type="button"
        className={btn}
        disabled={!hydrated || version === null}
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        {version === null ? "History available after the database update" : open ? "Hide history" : "Show history"}
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-sm">
          {list === null && !err ? <p className="text-[var(--adm-ink-2)]">Loading…</p> : null}
          <ol className="space-y-2">
            {(list || []).map((r) => (
              <li key={r.version} data-testid="content-revision" data-version={r.version} className="rounded border border-[var(--adm-border)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Version {r.version}</span>
                  <span>{ACTION[r.action] || r.action}</span>
                  {r.restored_from ? <span className="text-xs">(from version {r.restored_from})</span> : null}
                  <span className="text-xs text-[var(--adm-ink-2)]">
                    {new Date(r.saved_at).toLocaleString("en-PK")} · {r.savedBy} · {r.status}
                    {r.legal_approved ? " · legally approved" : ""}
                  </span>
                  {r.version === current?.version ? <span className="text-xs font-semibold">Current</span> : null}
                </div>
                {r.note ? <div className="text-xs text-[var(--adm-ink-2)]">{r.note}</div> : null}
                {r.version !== current?.version ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btn} onClick={() => setCompare(compare === r.version ? null : r.version)} aria-expanded={compare === r.version}>
                      {compare === r.version ? "Hide changes" : `Compare version ${r.version} with current`}
                    </button>
                    <button type="button" className={btn} disabled={!hydrated || busy} onClick={() => void restore(r.version)}>
                      Restore version {r.version}
                    </button>
                  </div>
                ) : null}
                {compare === r.version && other && current ? <Changes from={other} to={current} /> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {err ? (
        <p role="alert" className="mt-2 text-sm text-[var(--adm-danger)]">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="mt-2 text-sm text-[var(--adm-success)]" data-testid="content-history-msg">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

function Changes({ from, to }: { from: Revision; to: Revision }) {
  const fields: [string, string, string][] = [
    ["Title", from.title, to.title],
    ["Search title", from.seo_title || "", to.seo_title || ""],
    ["Search description", from.seo_description || "", to.seo_description || ""],
  ];
  const lines = diffLines(htmlToLines(from.body_html), htmlToLines(to.body_html));
  const changed = lines.some((l) => l.kind !== "same");
  return (
    <div className="mt-2 space-y-2 rounded bg-[var(--adm-surface-2)] p-2 text-xs" data-testid="content-diff">
      {fields
        .filter(([, a, b]) => a !== b)
        .map(([label, a, b]) => (
          <p key={label}>
            <span className="font-semibold">{label}:</span> <del>{a || "(empty)"}</del> → <ins>{b || "(empty)"}</ins>
          </p>
        ))}
      {changed ? (
        <ul aria-label={`Text changes from version ${from.version} to the current version`} className="space-y-0.5">
          {lines
            .filter((l) => l.kind !== "same")
            .map((l, i) => (
              <li key={i} className={l.kind === "added" ? "text-[var(--adm-success)]" : "text-[var(--adm-danger)]"}>
                {l.kind === "added" ? "+ Added: " : "− Removed: "}
                {l.text}
              </li>
            ))}
        </ul>
      ) : (
        <p>The text is the same.</p>
      )}
    </div>
  );
}
