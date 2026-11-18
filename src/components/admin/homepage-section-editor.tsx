"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  SECTION_REGISTRY,
  V5_HOMEPAGE_SECTIONS,
  type SectionInstance,
  type SectionField,
  type SectionType,
} from "@/lib/content/site-builder-schema";
import { FIXED_REASON, canMove, moveSection, normalizeHomepageLayout } from "@/lib/content/homepage-layout";

const PREVIEW_URL = "/preview/homepage?v=draft";

/** Default settings of a section type (used to show the effective value of a field the draft has not set yet). */
const registryDefaults = (type: SectionType): Record<string, unknown> =>
  V5_HOMEPAGE_SECTIONS.find((d) => d.type === type)?.settings ?? {};
import {
  HERO_IMAGE_PRESETS,
  STORY_ANGLE_PRESETS,
  defaultHeroSectionSettings,
  defaultStorySectionSettings,
} from "@/lib/content/homepage-image-presets";

const STORY_ANGLES = ["front", "left", "right", "rear"] as const;

type PublishedVersion = {
  id: string;
  label: string;
  status: string;
  published_at?: string | null;
  created_at?: string;
};

export function HomepageSectionEditor() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [sections, setSections] = useState<SectionInstance[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [livePublishedVersionId, setLivePublishedVersionId] = useState<string | null>(null);
  const [publishedVersions, setPublishedVersions] = useState<PublishedVersion[]>([]);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [themesLive, setThemesLive] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const moveRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocus = useRef<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(sections) !== savedSnapshot, [sections, savedSnapshot]);

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
        const next = normalizeHomepageLayout((data.sections || []) as SectionInstance[]);
        setSections(next);
        setSavedSnapshot(JSON.stringify(next));
        setSource(data.source || "");
        setVersionId(data.versionId || null);
        setLivePublishedVersionId(data.livePublishedVersionId || null);
        setPublishedVersions(data.publishedVersions || []);
        setMigrationRequired(!!data.migrationRequired);
        setThemesLive(!!data.publishedThemesEnabled);
        setNotice(data.notice || null);
        setSelectedId(next[0]?.id ?? null);
        setLoaded(true);
      } catch {
        if (!cancelled) setErr("Network error loading theme draft");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = sections.find((s) => s.id === selectedId) || null;
  const registry = selected ? SECTION_REGISTRY[selected.type] : null;

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

  /** Move a section one place; keeps keyboard focus on the control that was used (or its pair at an edge). */
  function move(index: number, dir: -1 | 1) {
    const s = sections[index];
    if (!s || !canMove(sections, index, dir)) return;
    const next = moveSection(sections, index, dir);
    setSections(next);
    setSelectedId(s.id);
    const pos = index + dir;
    const stillMovable = canMove(next, pos, dir);
    pendingFocus.current = `${s.id}:${stillMovable ? dir : -dir}`;
    setAnnounce(`${s.label} moved to position ${pos + 1} of ${next.length}.`);
  }

  useEffect(() => {
    if (!pendingFocus.current) return;
    moveRefs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [sections]);

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
        return false;
      }
      setVersionId(data.versionId || versionId);
      setSavedSnapshot(JSON.stringify(sections));
      setFrameKey((k) => k + 1);
      setNotice(data.notice || "Draft saved. Public storefront unchanged until publish.");
      return true;
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
    return false;
  }

  async function publishDraft() {
    if (!loaded || sections.length < 1) {
      setErr("Theme draft is still loading. Wait a moment and try again.");
      return;
    }
    if (dirty && !window.confirm("You have unsaved changes. Save draft and publish?")) return;
    if (
      !window.confirm(
        themesLive
          ? "Publish this draft? Customers will see it on the homepage within about a minute. You can restore an earlier version afterwards."
          : "Publish this draft as a new version? Customers keep seeing the V5 default until published themes are switched on (THEME_PUBLISHED_ENABLED).",
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
      setVersionId(saveData.versionId || versionId);
      setSavedSnapshot(JSON.stringify(sections));

      const res = await fetch("/api/admin/theme/homepage/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPublish: true,
          sourceVersionId: saveData.versionId || versionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Publish failed (${res.status})`);
        return;
      }
      setLivePublishedVersionId(data.publishedVersionId || null);
      setNotice(data.notice || "Published.");
      // refresh published list
      const reload = await fetch("/api/admin/theme/homepage");
      const reloadData = await reload.json().catch(() => ({}));
      if (reload.ok) {
        setPublishedVersions(reloadData.publishedVersions || []);
        setLivePublishedVersionId(reloadData.livePublishedVersionId || data.publishedVersionId);
      }
    } catch {
      setErr("Network error during publish");
    } finally {
      setBusy(false);
    }
  }

  async function rollbackTo(targetVersionId: string) {
    if (
      !window.confirm(
        themesLive
          ? "Restore this published version? Customers will see it on the homepage within about a minute."
          : "Restore this published version as the current publication? Customers keep seeing the V5 default until published themes are switched on.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/theme/homepage/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmRollback: true, targetVersionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Rollback failed (${res.status})`);
        return;
      }
      setLivePublishedVersionId(data.publishedVersionId || targetVersionId);
      setNotice(data.notice || "Rolled back.");
    } catch {
      setErr("Network error during rollback");
    } finally {
      setBusy(false);
    }
  }

  /** Full preview in a new tab. Unsaved changes are saved first, so the preview always shows what was edited. */
  async function openDraftPreview(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return; // plain link: opens the saved draft in a new tab
    e.preventDefault();
    const tab = window.open("about:blank", "_blank");
    const ok = await saveDraft();
    if (!ok) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = PREVIEW_URL;
    else router.push(PREVIEW_URL);
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
              data-testid={`theme-image-${f.key}`}
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
              className="mt-2 text-xs font-semibold text-[var(--adm-action)]"
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
              className="text-xs font-semibold text-[var(--adm-action)]"
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
                  className="mt-1 text-xs font-semibold text-[var(--adm-action)]"
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

    const help = f.help ? <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">{f.help}</span> : null;

    if (f.kind === "boolean") {
      const fallback = (registryDefaults(selected.type)[f.key] as boolean | undefined) ?? false;
      const checked = typeof val === "boolean" ? val : fallback;
      return (
        <div key={f.key} className="text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              data-testid={`theme-field-${f.key}`}
              checked={checked}
              onChange={(e) => updateSetting(f.key, e.target.checked)}
            />
            <span className="font-medium">{f.label}</span>
          </label>
          {help}
        </div>
      );
    }

    if (f.kind === "select" && f.options) {
      const fallback = String(registryDefaults(selected.type)[f.key] ?? f.options[0]?.value ?? "");
      return (
        <label key={f.key} className="block text-sm">
          <span className="font-medium">{f.label}</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] bg-white px-2 py-1.5 text-sm"
            data-testid={`theme-field-${f.key}`}
            value={typeof val === "string" ? val : fallback}
            onChange={(e) => updateSetting(f.key, e.target.value)}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </label>
      );
    }

    if (f.kind === "textarea") {
      return (
        <label key={f.key} className="block text-sm">
          <span className="font-medium">{f.label}</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
            rows={3}
            data-testid={`theme-field-${f.key}`}
            value={String(val ?? "")}
            onChange={(e) => updateSetting(f.key, e.target.value)}
          />
          {help}
        </label>
      );
    }

    return (
      <label key={f.key} className="block text-sm">
        <span className="font-medium">{f.label}</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
          data-testid={`theme-field-${f.key}`}
          value={String(val ?? "")}
          onChange={(e) => updateSetting(f.key, e.target.value)}
        />
        {help}
      </label>
    );
  }

  const previewWidth = viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : 1200;

  // lg: list + settings side by side, preview full width below; xl+: three columns. Fixed tracks at lg overflowed the
  // ~700px admin content area (1024px window with the admin sidebar).
  return (
    <div data-testid="theme-editor-grid" className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside className="min-w-0 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)]">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">
          Sections {dirty ? "· unsaved" : ""}
        </p>
        <p className="mt-1 px-2 text-xs text-[var(--adm-ink-2)]">
          Homepage order, top to bottom. Use the arrows to move a section; the hero stays first and the map stays
          last.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <ol className="mt-2 space-y-1" data-testid="theme-section-list">
          {sections.map((s, i) => {
            const fixed = FIXED_REASON[s.type];
            const arrow = (dir: -1 | 1) => (
              <button
                type="button"
                ref={(el) => {
                  moveRefs.current[`${s.id}:${dir}`] = el;
                }}
                data-testid={`theme-move-${dir < 0 ? "up" : "down"}-${s.type}`}
                aria-label={`Move ${s.label} ${dir < 0 ? "up" : "down"}`}
                disabled={busy || !canMove(sections, i, dir)}
                onClick={() => move(i, dir)}
                className="grid h-7 w-7 place-items-center rounded border border-[var(--adm-border)] text-xs disabled:opacity-30"
              >
                <span aria-hidden="true">{dir < 0 ? "↑" : "↓"}</span>
              </button>
            );
            return (
              <li
                key={s.id}
                data-testid={`theme-section-${s.type}`}
                data-enabled={s.enabled ? "true" : "false"}
                className="flex items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-current={selectedId === s.id ? "true" : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    selectedId === s.id ? "bg-[var(--adm-info-bg)] font-semibold" : "hover:bg-[var(--adm-surface-2)]"
                  } ${!s.enabled ? "opacity-60" : ""}`}
                >
                  <span className="w-5 text-xs text-[var(--adm-ink-2)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {!s.enabled ? (
                    <span className="text-[10px] font-semibold uppercase text-[var(--adm-ink-2)]">Hidden</span>
                  ) : null}
                  {fixed ? (
                    <span className="text-[10px] font-semibold uppercase text-[var(--adm-ink-2)]" title={fixed}>
                      Fixed
                    </span>
                  ) : null}
                </button>
                {fixed ? null : (
                  <>
                    {arrow(-1)}
                    {arrow(1)}
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {publishedVersions.length ? (
          <div className="mt-4 border-t border-[var(--adm-border)] pt-3">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">
              Published history
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {publishedVersions.map((v) => (
                <li key={v.id} className="rounded-lg px-2 py-1.5 text-xs">
                  <div className="font-medium">
                    {v.label}
                    {v.id === livePublishedVersionId ? " · live" : ""}
                  </div>
                  {v.id !== livePublishedVersionId ? (
                    <button
                      type="button"
                      data-testid={`theme-rollback-${v.id}`}
                      className="mt-1 font-semibold text-[var(--adm-action)]"
                      disabled={busy}
                      onClick={() => rollbackTo(v.id)}
                    >
                      Restore this version
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      <section className="min-w-0 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)] lg:order-last lg:col-span-2 xl:order-none xl:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
            Draft inspector · source {source || "—"}
            {livePublishedVersionId ? ` · live ${livePublishedVersionId.slice(0, 8)}…` : " · no live publication"}
          </p>
          <div className="ml-auto flex gap-1">
            {(["desktop", "tablet", "mobile"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  viewport === v ? "border-[var(--adm-action)] bg-[var(--adm-info-bg)]" : "border-[var(--adm-border)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div
          data-testid="theme-live-state"
          className={`mt-3 rounded-lg border p-3 text-sm ${
            themesLive ? "border-[var(--adm-success)]" : "border-[var(--adm-warning)] bg-[var(--adm-surface-2)]"
          }`}
        >
          {themesLive ? (
            <p>
              <strong>Published themes are on.</strong> Customers see the published version
              {livePublishedVersionId ? "" : " (nothing published yet, so the V5 default)"}. Publishing or restoring a
              version updates the live homepage within about a minute.
            </p>
          ) : (
            <p>
              <strong>Published themes are off</strong> (<code>THEME_PUBLISHED_ENABLED</code> is not set). Customers
              see the built-in V5 homepage. Saving and publishing keep versions ready, but the live homepage changes
              only after the owner switches published themes on in the hosting settings.
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
            Saving a draft never changes the public site. Publish creates a new immutable version; drafts are never
            shown to customers.
          </p>
        </div>

        <div
          className="mx-auto mt-4 overflow-hidden rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3"
          style={{ maxWidth: previewWidth }}
        >
          {selected?.type === "v5_cinematic_hero" ? (
            <div className="flex flex-wrap gap-3">
              {(["main", "side1", "side2"] as const).map((slot) => {
                const preset = HERO_IMAGE_PRESETS[slot];
                const key = slot === "main" ? "mainImageUrl" : slot === "side1" ? "side1ImageUrl" : "side2ImageUrl";
                const url = String(selected.settings[key] || preset.imageUrl);
                return (
                  <div key={slot} className="rounded-lg border border-[var(--adm-border)] bg-white p-2">
                    <p className="text-xs font-semibold">{preset.brand}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={preset.alt} className="mt-1 h-24 w-auto object-contain" />
                  </div>
                );
              })}
            </div>
          ) : null}
          {selected?.type === "v5_product_story" ? (
            <div className="flex flex-wrap gap-3">
              {STORY_ANGLES.map((angle) => {
                const angles = (selected.settings.angleImages as Record<string, string>) || {};
                const url = angles[angle] || STORY_ANGLE_PRESETS[angle].imageUrl;
                return (
                  <div key={angle} className="rounded-lg border border-[var(--adm-border)] bg-white p-2">
                    <p className="text-xs font-semibold uppercase">{angle}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={STORY_ANGLE_PRESETS[angle].alt} className="mt-1 h-20 w-auto object-contain" />
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-[var(--adm-ink-2)]" data-testid="theme-frame-note">
            {dirty
              ? "You have unsaved changes. The preview below shows the last saved draft; save to update it."
              : "Saved draft, rendered by the real storefront (scroll inside the frame)."}
          </p>
          {loaded && !migrationRequired ? (
            <iframe
              key={frameKey}
              src={`${PREVIEW_URL}&embed=1`}
              title={`Homepage draft preview, ${viewport} width`}
              data-testid="theme-preview-frame"
              className="mt-2 h-[70vh] w-full rounded border border-[var(--adm-border)] bg-white"
            />
          ) : null}
        </div>
      </section>

      <aside className="min-w-0 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
        {selected && registry ? (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold">{selected.label}</h2>
            <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{registry.description}</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="theme-section-enabled"
                checked={selected.enabled}
                onChange={() => toggleEnabled(selected.id)}
              />
              Show on the homepage
            </label>
            <p className="mt-3 text-xs text-[var(--adm-ink-2)]">
              {FIXED_REASON[selected.type] ??
                `Position ${sections.findIndex((s) => s.id === selected.id) + 1} of ${sections.length}. Move it with the arrows in the section list.`}
              {selected.type === "v5_store_reviews"
                ? " Shown only when at least one store testimonial is published (Reviews → Store testimonials)."
                : ""}
              {selected.type === "v5_featured_products" ? " Published reels follow this section." : ""}
            </p>
            {selected.type === "v5_cinematic_hero" ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-[var(--adm-action)]"
                onClick={resetAllHeroPresets}
              >
                Reset all hero images to approved defaults
              </button>
            ) : null}
            <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto pr-1">{registry.fields.map(renderField)}</div>
          </>
        ) : (
          <p className="text-sm text-[var(--adm-ink-2)]">Select a section</p>
        )}

        <button
          type="button"
          data-testid="theme-save-draft"
          disabled={!hydrated || !loaded || busy || migrationRequired || sections.length < 1}
          onClick={saveDraft}
          className="mt-5 w-full rounded-lg bg-[var(--adm-action)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {migrationRequired ? "Save blocked (migration)" : busy ? "Working…" : dirty ? "Save draft *" : "Save draft"}
        </button>
        {!hydrated || !loaded || busy || migrationRequired || sections.length < 1 ? (
          <span
            aria-disabled="true"
            className="mt-2 block w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-center text-sm font-semibold opacity-50"
          >
            Open full preview
          </span>
        ) : (
          <a
            href={PREVIEW_URL}
            target="_blank"
            rel="noopener"
            data-testid="theme-open-preview"
            onClick={openDraftPreview}
            className="mt-2 block w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-center text-sm font-semibold"
          >
            {dirty ? "Save and open full preview" : "Open full preview"}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        <button
          type="button"
          data-testid="theme-publish"
          disabled={!hydrated || !loaded || busy || migrationRequired || sections.length < 1}
          onClick={publishDraft}
          className="mt-2 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Publish (immutable snapshot)
        </button>
        {notice ? (
          <p data-testid="theme-notice" role="status" className="mt-2 text-xs text-[var(--adm-success)]">
            {notice}
          </p>
        ) : null}
        {err ? (
          <p data-testid="theme-error" className="mt-2 text-xs text-[var(--adm-danger)]" role="alert">
            {err}
          </p>
        ) : null}
        {migrationRequired ? (
          <p className="mt-2 text-xs text-[var(--adm-warning)]">
            Apply <code>20261025130000</code> + <code>20261025140000</code> on local Supabase.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
