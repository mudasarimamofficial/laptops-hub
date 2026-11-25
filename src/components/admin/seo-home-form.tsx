"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import {
  DEFAULT_HOME_DESCRIPTION,
  DEFAULT_HOME_TITLE,
  HOME_DESCRIPTION_MAX,
  HOME_TITLE_MAX,
  cleanSeoText,
} from "@/lib/content/seo-defaults";

type Props = { initial: { homeTitle: string; homeDescription: string }; origin: string; canEdit: boolean };

/**
 * Admin → SEO → Homepage search appearance. Empty fields use the defaults (brand + city). Plain text only.
 * The preview is a guide: Google may rewrite titles and snippets.
 */
export function SeoHomeForm({ initial, origin, canEdit }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(initial.homeTitle);
  const [description, setDescription] = useState(initial.homeDescription);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const shownTitle = cleanSeoText(title, HOME_TITLE_MAX) || DEFAULT_HOME_TITLE;
  const shownDescription = cleanSeoText(description, HOME_DESCRIPTION_MAX) || DEFAULT_HOME_DESCRIPTION;
  const host = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  })();

  async function save(next: { title: string; description: string }) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seoHomeTitle: next.title, seoHomeDescription: next.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setTitle(cleanSeoText(next.title, HOME_TITLE_MAX));
      setDescription(cleanSeoText(next.description, HOME_DESCRIPTION_MAX));
      setMsg("Homepage search appearance saved. The live homepage uses it within a minute.");
      router.refresh();
    } catch {
      setErr("Network error. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      data-testid="seo-home-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ title, description });
      }}
      className="space-y-4"
    >
      <AdminField label="Homepage search title" hint={`Leave empty to use: “${DEFAULT_HOME_TITLE}”. ${title.length}/${HOME_TITLE_MAX} characters.`}>
        <input
          className={admInputClass}
          value={title}
          maxLength={HOME_TITLE_MAX}
          disabled={!canEdit}
          placeholder={DEFAULT_HOME_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="seo-home-title"
        />
      </AdminField>
      <AdminField
        label="Homepage search description"
        hint={`Leave empty to use the default. ${description.length}/${HOME_DESCRIPTION_MAX} characters. Use only true facts about the store.`}
      >
        <textarea
          className={admInputClass}
          rows={3}
          value={description}
          maxLength={HOME_DESCRIPTION_MAX}
          disabled={!canEdit}
          placeholder={DEFAULT_HOME_DESCRIPTION}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="seo-home-description"
        />
      </AdminField>

      <div className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3" data-testid="seo-home-preview">
        <p className="text-xs text-[var(--adm-ink-2)]">Search result preview (a guide; Google may show different text)</p>
        <p className="mt-2 text-xs text-[var(--adm-ink-2)]">{host}</p>
        <p className="text-base font-medium text-[#1a0dab]">{shownTitle}</p>
        <p className="text-sm text-[var(--adm-ink)]">{shownDescription.length > 160 ? `${shownDescription.slice(0, 157)}…` : shownDescription}</p>
      </div>

      {err ? (
        <p role="alert" className="text-sm text-[var(--adm-danger)]" data-testid="seo-home-error">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="text-sm text-[var(--adm-success)]" data-testid="seo-home-saved">
          {msg}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50" disabled={!hydrated || busy}>
            {busy ? "Saving…" : "Save homepage search appearance"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm font-semibold text-[var(--adm-ink)] disabled:opacity-50"
            disabled={!hydrated || busy || (!initial.homeTitle && !initial.homeDescription && !title && !description)}
            onClick={() => void save({ title: "", description: "" })}
            data-testid="seo-home-reset"
          >
            Reset to default
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--adm-ink-2)]">Only the owner, an admin or a manager can change this.</p>
      )}
    </form>
  );
}
