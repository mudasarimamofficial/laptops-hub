"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { SECTION_REGISTRY, type SectionInstance } from "@/lib/content/site-builder-schema";

export function HomepageSectionEditor() {
  const hydrated = useHydrated();
  const [sections, setSections] = useState<SectionInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/theme/homepage");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setErr(data.message || "Failed to load sections");
          return;
        }
        if (cancelled) return;
        setSections(data.sections || []);
        setSource(data.source || "");
        setMigrationRequired(!!data.migrationRequired);
        setNotice(data.notice || null);
        setSelectedId(data.sections?.[0]?.id ?? null);
      } catch {
        if (!cancelled) setErr("Network error loading theme draft");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = sections.find((s) => s.id === selectedId) || null;
  const registry = selected ? SECTION_REGISTRY[selected.type] : null;

  function move(id: string, dir: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sections.length) return;
    const next = [...sections];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setSections(next);
  }

  function updateSetting(key: string, value: unknown) {
    if (!selected) return;
    setSections((list) =>
      list.map((s) =>
        s.id === selected.id ? { ...s, settings: { ...s.settings, [key]: value } } : s,
      ),
    );
  }

  function toggleEnabled(id: string) {
    setSections((list) => list.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  async function saveDraft() {
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/theme/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setNotice(data.notice || "Draft saved.");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      <aside className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)]">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">Sections</p>
        <ul className="mt-2 space-y-1">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                  selectedId === s.id ? "bg-[var(--lh-ice)] font-semibold" : "hover:bg-[var(--adm-surface-2)]"
                } ${!s.enabled ? "opacity-50" : ""}`}
              >
                <span className="w-5 text-xs text-[var(--adm-ink-2)]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
        <p className="text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
          Preview placeholder · source {source || "—"}
        </p>
        <p className="mt-2 text-sm text-[var(--adm-ink-2)]">
          Live storefront continues to render the approved V5 composition. This editor prepares draft section order and
          settings. Accurate iframe preview and publish/rollback ship after local migration + wiring.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          {sections
            .filter((s) => s.enabled)
            .map((s) => (
              <li key={s.id}>
                <strong>{s.label}</strong>{" "}
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">{s.type}</span>
              </li>
            ))}
        </ol>
      </section>

      <aside className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
        {selected && registry ? (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold">{selected.label}</h2>
            <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{registry.description}</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.enabled} onChange={() => toggleEnabled(selected.id)} />
              Enabled
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold"
                onClick={() => move(selected.id, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs font-semibold"
                onClick={() => move(selected.id, 1)}
              >
                Move down
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {registry.fields.map((f) => {
                const val = selected.settings[f.key];
                if (f.kind === "product_handles") {
                  const text = Array.isArray(val) ? val.join(", ") : String(val ?? "");
                  return (
                    <label key={f.key} className="block text-sm">
                      <span className="font-medium">{f.label}</span>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-xs"
                        rows={3}
                        value={text}
                        onChange={(e) =>
                          updateSetting(
                            f.key,
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                      {f.help ? <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">{f.help}</span> : null}
                    </label>
                  );
                }
                return (
                  <label key={f.key} className="block text-sm">
                    <span className="font-medium">{f.label}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
                      value={String(val ?? "")}
                      onChange={(e) => updateSetting(f.key, e.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--adm-ink-2)]">Select a section</p>
        )}

        <button
          type="button"
          disabled={!hydrated || busy || migrationRequired}
          onClick={saveDraft}
          className="mt-5 w-full rounded-lg bg-[var(--lh-action)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {migrationRequired ? "Save blocked (migration)" : busy ? "Saving…" : "Save draft"}
        </button>
        {notice ? <p className="mt-2 text-xs text-[var(--adm-success)]">{notice}</p> : null}
        {err ? (
          <p className="mt-2 text-xs text-[var(--adm-danger)]" role="alert">
            {err}
          </p>
        ) : null}
        {migrationRequired ? (
          <p className="mt-2 text-xs text-[var(--adm-warning)]">
            Apply <code>20261025130000_site_builder_sections.sql</code> on local Supabase to persist drafts.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
