"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { BLOG_TEMPLATES, RichTextEditor } from "@/components/admin/rich-text-editor";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminEditorLayout } from "@/components/admin/ui/admin-editor-layout";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import { AdminMediaPicker } from "@/components/admin/ui/admin-media-picker";
import { AdminSaveBar } from "@/components/admin/ui/admin-save-bar";

export type PostFormValues = {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  coverImageUrl: string;
  ogImageUrl: string;
  authorName: string;
  category: string;
  templateKey: string;
  tags: string[];
  scheduledFor: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

type RevisionRow = { id: string; title: string; status: string; created_at: string; seo_title: string | null };

function toDatetimeLocalValue(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Blog post editor — Admin VNext two-column layout. */
export function PostForm({ id, initial }: { id?: string; initial: PostFormValues }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<PostFormValues>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [showHtml, setShowHtml] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = useState("");
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [baselineVisibility, setBaselineVisibility] = useState<"hidden" | "visible" | "scheduled">(() => {
    if (initial.status === "published" && initial.scheduledFor && Date.parse(initial.scheduledFor) > Date.parse(new Date().toISOString())) {
      return "scheduled";
    }
    return initial.status === "published" ? "visible" : "hidden";
  });
  const [visibility, setVisibility] = useState<"hidden" | "visible" | "scheduled">(baselineVisibility);

  const dirty = useMemo(
    () => JSON.stringify(v) !== baseline || visibility !== baselineVisibility,
    [v, baseline, visibility, baselineVisibility],
  );

  const set = <K extends keyof PostFormValues>(k: K, val: PostFormValues[K]) => setV((x) => ({ ...x, [k]: val }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/posts/${id}/revisions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setRevisions(data.revisions || []))
      .catch(() => setRevisions([]));
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function syncVisibility(next: "hidden" | "visible" | "scheduled") {
    setVisibility(next);
    if (next === "hidden") {
      set("status", "draft");
      set("scheduledFor", "");
    } else if (next === "visible") {
      set("status", "published");
      set("scheduledFor", "");
    } else {
      set("status", "published");
      if (!v.scheduledFor) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        set("scheduledFor", d.toISOString());
      }
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    setFe({});
    try {
      const payload = {
        ...v,
        status: visibility === "hidden" ? "draft" : "published",
        scheduledFor: visibility === "scheduled" ? v.scheduledFor : "",
      };
      const res = await fetch(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFe(data.fieldErrors || {});
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      if (!id && data.id) {
        router.push(`/admin/blog/${data.id}?saved=1`);
        return;
      }
      const savedValues: PostFormValues = {
        ...payload,
        status: payload.status as PostFormValues["status"],
        scheduledFor: payload.scheduledFor || "",
      };
      const nextVisibility = visibility === "scheduled" ? "scheduled" : payload.status === "published" ? "visible" : "hidden";
      setV(savedValues);
      setBaseline(JSON.stringify(savedValues));
      setVisibility(nextVisibility);
      setBaselineVisibility(nextVisibility);
      setMsg("Post saved.");
      router.refresh();
      if (id) {
        const rev = await fetch(`/api/admin/posts/${id}/revisions`, { cache: "no-store" }).then((r) => r.json());
        setRevisions(rev.revisions || []);
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id || !window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/admin/blog");
    else setErr(`Delete failed (${res.status})`);
  }

  async function restoreRevision(revisionId: string) {
    if (!id || !window.confirm("Restore this revision? Your current text will be saved in history first.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/posts/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || "Restore failed");
        return;
      }
      setMsg("Revision restored.");
      router.refresh();
      window.location.reload();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(key: string) {
    const t = BLOG_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    const ok = !v.bodyHtml.trim() || window.confirm("Replace the current body with this template?");
    if (!ok) return;
    setV((x) => ({ ...x, templateKey: t.key, excerpt: x.excerpt || t.excerpt, bodyHtml: t.bodyHtml }));
  }

  function addTag() {
    const t = tagDraft.trim();
    if (!t) return;
    if (v.tags.includes(t)) {
      setTagDraft("");
      return;
    }
    set("tags", [...v.tags, t].slice(0, 20));
    setTagDraft("");
  }

  const main = (
    <>
      {!id ? (
        <AdminCard title="Start from a template" description="Editable starters — they never invent product facts.">
          <div className="flex flex-wrap gap-2">
            {BLOG_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--adm-action)]"
                onClick={() => applyTemplate(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </AdminCard>
      ) : null}

      <AdminCard title="Title and content">
        <div className="space-y-4">
          <AdminField label="Title" error={fe.title}>
            <input
              className={admInputClass}
              value={v.title}
              required
              maxLength={160}
              placeholder="e.g. How to choose RAM for work laptops"
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </AdminField>
          <AdminField label="Web address" error={fe.slug} hint="Shown on the public site under /guides/">
            <span className="mt-1 flex min-w-0 items-center gap-1">
              <span className="shrink-0 text-sm text-[var(--adm-ink-2)]">/guides/</span>
              <input
                className={admInputClass.replace("mt-1 ", "")}
                value={v.slug}
                required
                maxLength={80}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
              />
            </span>
          </AdminField>
          <RichTextEditor key={id || "new"} value={v.bodyHtml} onChange={(html) => set("bodyHtml", html)} label="Content" />
          {fe.bodyHtml ? (
            <span role="alert" className="text-xs text-[var(--adm-danger)]">
              {fe.bodyHtml}
            </span>
          ) : null}
          <details className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] p-3" open={showHtml} onToggle={(e) => setShowHtml((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-medium">Advanced: HTML source</summary>
            <textarea className={`${admInputClass} font-[family-name:var(--font-mono)] text-xs`} rows={8} value={v.bodyHtml} onChange={(e) => set("bodyHtml", e.target.value)} />
          </details>
        </div>
      </AdminCard>

      <AdminCard title="Excerpt" description="Short summary for the guides list. Plain text is enough.">
        <AdminField label="Summary" optional>
          <input className={admInputClass} value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} maxLength={300} placeholder="One or two sentences customers will see in the list." />
        </AdminField>
      </AdminCard>

      <AdminCard title="Search engine listing">
        <div className="space-y-3">
          <AdminField label={`Page title (${v.seoTitle.length}/70)`} optional>
            <input className={admInputClass} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} placeholder={v.title} />
          </AdminField>
          <AdminField label={`Description (${v.seoDescription.length}/160)`} optional>
            <textarea className={admInputClass} rows={3} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={160} placeholder={v.excerpt} />
          </AdminField>
          <div className="rounded-[var(--adm-radius)] bg-[var(--adm-surface-2)] p-3 text-xs text-[var(--adm-ink-2)]">
            <p className="font-semibold text-[var(--adm-ink)]">Search preview</p>
            <p className="mt-1 text-[var(--adm-action)]">{v.seoTitle || v.title || "Post title"}</p>
            <p className="text-[var(--adm-success)]">laptopshub.pk/guides/{v.slug || "…"}</p>
            <p>{v.seoDescription || v.excerpt || "Meta description appears here."}</p>
          </div>
        </div>
      </AdminCard>

      {id ? (
        <AdminCard title="Revision history" description="Restore a previous version if you need to undo an edit.">
          {revisions.length === 0 ? <p className="text-sm text-[var(--adm-ink-2)]">No revisions yet. They appear after you save changes.</p> : null}
          <ul className="divide-y divide-[var(--adm-divider)]">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">{r.title}</p>
                  <p className="text-xs text-[var(--adm-ink-2)]">
                    {new Date(r.created_at).toLocaleString("en-PK")} · {r.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 py-1.5 text-xs font-semibold"
                  onClick={() => restoreRevision(r.id)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}
    </>
  );

  const aside = (
    <>
      <AdminCard title="Visibility">
        <fieldset className="space-y-2">
          <legend className="sr-only">Visibility</legend>
          {(
            [
              ["hidden", "Hidden — draft, not on the site"],
              ["visible", "Visible — published now"],
              ["scheduled", "Scheduled — publish later"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                className="mt-1"
                checked={visibility === value}
                onChange={() => syncVisibility(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {visibility === "scheduled" ? (
          <AdminField label="Publish at" hint="Asia/Karachi local time on this device. Post stays hidden until then.">
            <input
              type="datetime-local"
              className={admInputClass}
              value={toDatetimeLocalValue(v.scheduledFor)}
              onChange={(e) => {
                const raw = e.target.value;
                set("scheduledFor", raw ? new Date(raw).toISOString() : "");
              }}
            />
          </AdminField>
        ) : null}
      </AdminCard>

      <AdminCard title="Cover image">
        <AdminMediaPicker
          label="Featured image"
          value={v.coverImageUrl}
          onChange={(url) => set("coverImageUrl", url)}
          hint="Choose an approved product photo or paste an https:// image URL."
        />
        <div className="mt-3">
          <AdminField label="Social share image URL" optional hint="Defaults to the cover image when empty.">
            <input className={admInputClass} value={v.ogImageUrl} onChange={(e) => set("ogImageUrl", e.target.value)} maxLength={500} placeholder="https://" />
          </AdminField>
        </div>
      </AdminCard>

      <AdminCard title="Organization">
        <div className="space-y-3">
          <AdminField label="Author" optional>
            <input className={admInputClass} value={v.authorName} onChange={(e) => set("authorName", e.target.value)} maxLength={80} placeholder="Laptops HUB" />
          </AdminField>
          <AdminField label="Category" optional>
            <input className={admInputClass} value={v.category} onChange={(e) => set("category", e.target.value)} maxLength={80} placeholder="Buying guides" />
          </AdminField>
          <div>
            <p className="text-sm font-medium">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {v.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-0.5 text-xs"
                  onClick={() => set("tags", v.tags.filter((x) => x !== t))}
                  title="Remove tag"
                >
                  {t} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className={admInputClass.replace("mt-1 ", "")}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag"
                maxLength={40}
              />
              <button type="button" className="rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-3 text-xs font-semibold" onClick={addTag}>
                Add
              </button>
            </div>
          </div>
        </div>
      </AdminCard>
    </>
  );

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="text-sm"
    >
      <AdminEditorLayout main={main} aside={aside} />
      <AdminSaveBar
        dirty={dirty || !id}
        busy={busy || !hydrated}
        savedMessage={msg}
        error={err}
        onSave={() => void save()}
        saveLabel={id ? "Save" : "Create post"}
        secondary={
          id ? (
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={() => void onDelete()}
              className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-danger)] px-4 text-sm font-semibold text-[var(--adm-danger)] disabled:opacity-50"
            >
              Delete
            </button>
          ) : null
        }
      />
    </form>
  );
}
