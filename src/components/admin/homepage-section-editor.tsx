"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { SECTION_REGISTRY, type SectionInstance, type SectionField } from "@/lib/content/site-builder-schema";
import {
  HERO_IMAGE_PRESETS,
  STORY_ANGLE_PRESETS,
  defaultHeroSectionSettings,
  defaultStorySectionSettings,
} from "@/lib/content/homepage-image-presets";

const STORY_ANGLES = ["front", "left", "right", "rear"] as const;

export function HomepageSectionEditor() {
  const hydrated = useHydrated();
  const [sections, setSections] = useState<SectionInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [versionId, setVersionId] = useState<string | null>(null);
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
        setVersionId(data.versionId || null);
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

  function updateNestedAngle(angle: string, url: string) {
    if (!selected) return;
    const current = (selected.settings.angleImages as Record<string, unknown>) || {};
    updateSetting("angleImages", { ...current, [angle]: url });
  }

  function resetImageField(f: SectionField) {
    if (!f.defaultUrl) return;
    updateSetting(f.key, f.defaultUrl);
  }

  function resetAllHeroPresets() {
    if (!selected || selected.type !== "v5_cinematic_hero") return;
    const d = defaultHeroSectionSettings();
    setSections((list) =>
      list.map((s) =>
        s.id === selected.id
          ? {
              ...s,
              settings: {
                ...s.settings,
                ...d,
                productHandles: Array.isArray(s.settings.productHandles)
                  ? s.settings.productHandles
                  : d.productHandles,
              },
            }
          : s,
      ),
    );
  }

  function resetAllStoryAngles() {
    if (!selected || selected.type !== "v5_product_story") return;
    const d = defaultStorySectionSettings();
    setSections((list) =>
      list.map((s) =>
        s.id === selected.id
          ? {
              ...s,
              settings: {
                ...s.settings,
                angleImages: d.angleImages,
              },
            }
          : s,
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
      setVersionId(data.versionId || versionId);
      setNotice(data.notice || "Draft saved. Public storefront unchanged until publish.");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function publishDraft() {
    if (
      !window.confirm(
        "Publish this homepage draft to the live storefront (local stacks only)? Visitors will see these section settings when THEME_PUBLISHED_ENABLED=1.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const saveRes = await fetch("/api/admin/theme/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setErr(saveData.message || saveData.error || "Save before publish failed");
        return;
      }
      const res = await fetch("/api/admin/theme/homepage/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPublish: true, versionId: saveData.versionId || versionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Publish failed (${res.status})`);
        return;
      }
      setNotice(data.notice || "Published.");
    } catch {
      setErr("Network error during publish");
    } finally {
      setBusy(false);
    }
  }

  function renderField(f: SectionField) {
    if (!selected) return null;
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

    if (f.kind === "image_url") {
      const url = String(val ?? "");
      return (
        <div key={f.key} className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3">
          <p className="text-sm font-medium">{f.label}</p>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="mt-2 h-20 w-auto max-w-full rounded object-contain bg-white" />
          ) : (
            <p className="mt-2 text-xs text-[var(--adm-ink-2)]">No image set</p>
          )}
          <label className="mt-2 block text-xs">
            HTTPS image URL
            <input
              className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-xs"
              value={url}
              onChange={(e) => updateSetting(f.key, e.target.value.trim())}
              placeholder="https://cdn.shopify.com/..."
            />
          </label>
          {f.help ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{f.help}</p> : null}
          {f.defaultUrl ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-[var(--lh-action)]"
              onClick={() => resetImageField(f)}
            >
              Reset to approved default
            </button>
          ) : null}
        </div>
      );
    }

    if (f.kind === "angle_images") {
      const angles = (selected.settings.angleImages as Record<string, string>) || {};
      return (
        <div key={f.key} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{f.label}</p>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--lh-action)]"
              onClick={resetAllStoryAngles}
            >
              Reset all angles
            </button>
          </div>
          {f.help ? <p className="text-xs text-[var(--adm-ink-2)]">{f.help}</p> : null}
          {STORY_ANGLES.map((angle) => {
            const preset = STORY_ANGLE_PRESETS[angle];
            const url = angles[angle] || "";
            return (
              <div key={angle} className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide">{angle}</p>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={preset.alt} className="mt-2 h-16 w-auto max-w-full rounded object-contain bg-white" />
                ) : null}
                <input
                  className="mt-2 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-xs"
                  value={url}
                  onChange={(e) => updateNestedAngle(angle, e.target.value.trim())}
                  placeholder={preset.imageUrl}
                />
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-[var(--lh-action)]"
                  onClick={() => updateNestedAngle(angle, preset.imageUrl)}
                >
                  Reset {angle}
                </button>
              </div>
            );
          })}
        </div>
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
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_320px]">
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
          Draft inspector · source {source || "—"}
        </p>
        <p className="mt-2 text-sm text-[var(--adm-ink-2)]">
          Hero and Product Story images are editable presets. Saving a draft never changes the public site. Publish
          (local only) updates the published pointer; visitors see it when THEME_PUBLISHED_ENABLED=1. Without publish,
          the storefront still uses the seven approved CDN defaults via code presets.
        </p>
        {selected?.type === "v5_cinematic_hero" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {(["main", "side1", "side2"] as const).map((slot) => {
              const preset = HERO_IMAGE_PRESETS[slot];
              const key = slot === "main" ? "mainImageUrl" : slot === "side1" ? "side1ImageUrl" : "side2ImageUrl";
              const url = String(selected.settings[key] || preset.imageUrl);
              return (
                <div key={slot} className="rounded-lg border border-[var(--adm-border)] p-2">
                  <p className="text-xs font-semibold">{preset.brand}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={preset.alt} className="mt-1 h-24 w-auto object-contain" />
                </div>
              );
            })}
          </div>
        ) : null}
        {selected?.type === "v5_product_story" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {STORY_ANGLES.map((angle) => {
              const angles = (selected.settings.angleImages as Record<string, string>) || {};
              const url = angles[angle] || STORY_ANGLE_PRESETS[angle].imageUrl;
              return (
                <div key={angle} className="rounded-lg border border-[var(--adm-border)] p-2">
                  <p className="text-xs font-semibold uppercase">{angle}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={STORY_ANGLE_PRESETS[angle].alt} className="mt-1 h-20 w-auto object-contain" />
                </div>
              );
            })}
          </div>
        ) : null}
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
            {selected.type === "v5_cinematic_hero" ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-[var(--lh-action)]"
                onClick={resetAllHeroPresets}
              >
                Reset all hero images to approved defaults
              </button>
            ) : null}
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">{registry.fields.map(renderField)}</div>
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
          {migrationRequired ? "Save blocked (migration)" : busy ? "Working…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={!hydrated || busy || migrationRequired}
          onClick={publishDraft}
          className="mt-2 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Publish (local only)
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
