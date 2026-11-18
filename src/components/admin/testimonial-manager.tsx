"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReviewCard } from "@/components/storefront/home/store-reviews";
import {
  SOURCE_ADMIN_LABEL,
  STATUS_LABEL,
  TESTIMONIAL_SOURCES,
  TESTIMONIAL_STATUSES,
  type PublicTestimonial,
  type TestimonialSource,
  type TestimonialStatus,
} from "@/lib/content/testimonials";

export type AdminTestimonial = {
  id: string;
  author_name: string;
  rating: number | null;
  body: string;
  review_date: string | null;
  source: TestimonialSource;
  source_url: string | null;
  avatar_url: string | null;
  avatar_permission: boolean;
  consent_confirmed: boolean;
  verification_note: string;
  status: TestimonialStatus;
  show_on_homepage: boolean;
  featured: boolean;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
};
export type AuditEntry = { entity_id: string; action: string; actor_user_id: string | null; created_at: string };

type Form = {
  authorName: string;
  rating: string;
  body: string;
  reviewDate: string;
  source: TestimonialSource;
  sourceUrl: string;
  avatarUrl: string;
  avatarPermission: boolean;
  consentConfirmed: boolean;
  verificationNote: string;
  showOnHomepage: boolean;
  featured: boolean;
  sortOrder: string;
};
const EMPTY: Form = {
  authorName: "",
  rating: "",
  body: "",
  reviewDate: "",
  source: "merchant",
  sourceUrl: "",
  avatarUrl: "",
  avatarPermission: false,
  consentConfirmed: false,
  verificationNote: "",
  showOnHomepage: true,
  featured: false,
  sortOrder: "0",
};
const fromRow = (r: AdminTestimonial): Form => ({
  authorName: r.author_name,
  rating: r.rating ? String(r.rating) : "",
  body: r.body,
  reviewDate: r.review_date ?? "",
  source: r.source,
  sourceUrl: r.source_url ?? "",
  avatarUrl: r.avatar_url ?? "",
  avatarPermission: r.avatar_permission,
  consentConfirmed: r.consent_confirmed,
  verificationNote: r.verification_note,
  showOnHomepage: r.show_on_homepage,
  featured: r.featured,
  sortOrder: String(r.sort_order),
});
const toPayload = (f: Form) => ({
  ...f,
  rating: f.rating ? Number(f.rating) : null,
  sortOrder: Number(f.sortOrder) || 0,
});

const STATUS_TONE: Record<TestimonialStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  hidden: "bg-zinc-200 text-zinc-700",
};
const ACTION_LABEL: Record<string, string> = {
  "testimonial.create": "Added",
  "testimonial.update": "Edited",
  "testimonial.status.draft": "Returned to draft",
  "testimonial.status.pending": "Submitted for approval",
  "testimonial.status.published": "Published",
  "testimonial.status.hidden": "Hidden",
};

const input = "mt-1 w-full rounded-lg border border-[var(--adm-border)] bg-white px-3 py-2 text-sm";
const btn = "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold disabled:opacity-50";

export function TestimonialManager({
  rows,
  history,
  canApprove,
  filters,
  sorts,
  counts,
}: {
  rows: AdminTestimonial[];
  history: Record<string, AuditEntry[]>;
  canApprove: boolean;
  filters: { status: string; source: string; q: string; sort: string };
  sorts: { value: string; label: string }[];
  counts: Record<"draft" | "pending" | "published" | "hidden", number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const preview: PublicTestimonial | null = useMemo(() => {
    if (!editing) return null;
    const f = editing.form;
    return {
      id: "preview",
      authorName: f.authorName || "Customer name",
      rating: f.rating ? Number(f.rating) : null,
      body: f.body || "The review text appears here exactly as the customer wrote it.",
      reviewDate: f.reviewDate || null,
      source: f.source,
      sourceUrl: f.sourceUrl || null,
      avatarUrl: f.avatarUrl && f.avatarPermission ? f.avatarUrl : null,
    };
  }, [editing]);

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json } as { ok: boolean; json: { message?: string; issues?: { path: string; message: string }[] } };
  }

  async function save(status?: "draft" | "pending" | "published") {
    if (!editing) return;
    setBusy("save");
    setIssues({});
    setNotice(null);
    const payload = toPayload(editing.form);
    const r = editing.id
      ? await send(`/api/admin/testimonials/${editing.id}`, "PUT", { data: payload })
      : await send("/api/admin/testimonials", "POST", { data: payload, status: status ?? "draft" });
    setBusy(null);
    if (!r.ok) {
      const map: Record<string, string> = {};
      for (const i of r.json.issues ?? []) map[i.path] = i.message;
      setIssues(map);
      setNotice({ tone: "err", text: r.json.message || "Please fix the highlighted fields." });
      return;
    }
    setNotice({ tone: "ok", text: editing.id ? "Changes saved." : status === "published" ? "Published." : status === "pending" ? "Submitted for approval." : "Saved as a draft." });
    setEditing(null);
    startTransition(() => router.refresh());
  }

  async function setStatus(id: string, status: TestimonialStatus) {
    setBusy(id);
    setNotice(null);
    const r = await send(`/api/admin/testimonials/${id}`, "PATCH", { status });
    setBusy(null);
    if (!r.ok) {
      setNotice({ tone: "err", text: r.json.message || "Could not change the status." });
      return;
    }
    setNotice({ tone: "ok", text: `Status: ${STATUS_LABEL[status]}.` });
    startTransition(() => router.refresh());
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete the testimonial from ${name}? This cannot be undone (hiding it is reversible).`)) return;
    setBusy(id);
    const r = await send(`/api/admin/testimonials/${id}`, "DELETE");
    setBusy(null);
    if (!r.ok) {
      setNotice({ tone: "err", text: r.json.message || "Could not delete." });
      return;
    }
    setNotice({ tone: "ok", text: "Deleted." });
    startTransition(() => router.refresh());
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const err = (k: string) => (issues[k] ? <span className="mt-1 block text-xs text-red-700">{issues[k]}</span> : null);

  return (
    <div className="space-y-4">
      {notice ? (
        <p
          role={notice.tone === "err" ? "alert" : "status"}
          data-testid="testimonial-notice"
          className={`rounded-lg border p-3 text-sm ${notice.tone === "err" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2" role="search" aria-label="Filter testimonials">
          <label className="text-xs font-semibold">
            Search
            <input name="q" defaultValue={filters.q} placeholder="Name or text" className={`${input} w-48`} />
          </label>
          <label className="text-xs font-semibold">
            Status
            <select name="status" defaultValue={filters.status} className={input}>
              <option value="">All ({counts.draft + counts.pending + counts.published + counts.hidden})</option>
              {TESTIMONIAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]} ({counts[s]})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Source
            <select name="source" defaultValue={filters.source} className={input}>
              <option value="">All sources</option>
              {TESTIMONIAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_ADMIN_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Sort
            <select name="sort" defaultValue={filters.sort} className={input}>
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button className={`${btn} border-[var(--adm-border)] bg-white`}>Apply</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {canApprove ? (
            <button
              type="button"
              data-testid="testimonial-import-google-snapshot"
              className={`${btn} border-[var(--adm-border)] bg-white`}
              disabled={busy === "import"}
              onClick={() => {
                void (async () => {
                  if (
                    !window.confirm(
                      "Import the Google review snapshot as unpublished drafts? Existing matching drafts are skipped. Nothing is published.",
                    )
                  ) {
                    return;
                  }
                  setBusy("import");
                  setNotice(null);
                  const r = await send("/api/admin/testimonials/import-google-snapshot", "POST", {});
                  setBusy(null);
                  if (!r.ok) {
                    setNotice({ tone: "err", text: r.json.message || "Import failed." });
                    return;
                  }
                  const j = r.json as { inserted?: number; skipped?: number; message?: string };
                  setNotice({
                    tone: "ok",
                    text: j.message || `Imported ${j.inserted ?? 0} draft(s); skipped ${j.skipped ?? 0}.`,
                  });
                  startTransition(() => router.refresh());
                })();
              }}
            >
              {busy === "import" ? "Importing…" : "Import Google snapshot drafts"}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="testimonial-add"
            className={`${btn} border-[var(--adm-action)] bg-[var(--adm-action)] text-white`}
            onClick={() => {
              setIssues({});
              setEditing({ id: null, form: EMPTY });
            }}
          >
            Add testimonial
          </button>
        </div>
      </div>

      {editing ? (
        <section
          aria-labelledby="testimonial-form-title"
          className="grid gap-4 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] lg:grid-cols-[1fr_360px]"
        >
          <form
            className="space-y-3"
            data-testid="testimonial-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h2 id="testimonial-form-title" className="text-base font-bold">
              {editing.id ? "Edit testimonial" : "Add a genuine testimonial"}
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Enter the customer&apos;s words exactly as given. Do not write or improve reviews. Google reviews may be saved as drafts
              without a Maps link. Google entries need a Maps URL to publish (place listing URLs are allowed but labeled
              honestly). Website/merchant entries also need recorded customer consent. Avatar permission is required when a photo is set.
            </p>
            <label className="block text-sm font-medium">
              Where did this review come from?
              <select className={input} value={editing.form.source} onChange={(e) => set("source", e.target.value as TestimonialSource)} data-testid="testimonial-source">
                {TESTIMONIAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_ADMIN_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Customer name (as shown on the review)
                <input className={input} value={editing.form.authorName} onChange={(e) => set("authorName", e.target.value)} maxLength={80} required data-testid="testimonial-author" />
                {err("authorName")}
              </label>
              <label className="block text-sm font-medium">
                Star rating (only if the customer gave one)
                <select className={input} value={editing.form.rating} onChange={(e) => set("rating", e.target.value)} data-testid="testimonial-rating">
                  <option value="">No rating given</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "star" : "stars"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Review text
              <textarea className={input} rows={5} value={editing.form.body} onChange={(e) => set("body", e.target.value)} maxLength={2000} required data-testid="testimonial-body" />
              <span className="mt-1 block text-xs text-[var(--adm-ink-2)]">{editing.form.body.length}/2000 · shown as plain text</span>
              {err("body")}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Review date (if known)
                <input type="date" className={input} value={editing.form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                {err("reviewDate")}
              </label>
              <label className="block text-sm font-medium">
                {editing.form.source === "google" ? "Link to the review on Google Maps (required to publish)" : "Source link (optional)"}
                <input className={input} value={editing.form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value.trim())} placeholder="https://" data-testid="testimonial-source-url" />
                {editing.form.source === "google" && !editing.form.sourceUrl ? (
                  <span className="mt-1 block text-xs text-amber-800">Drafts can omit this; publishing is blocked until a Maps review link is set.</span>
                ) : null}
                {err("sourceUrl")}
              </label>
            </div>
            <label className="block text-sm font-medium">
              Customer photo link (optional)
              <input className={input} value={editing.form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value.trim())} placeholder="https://" />
              {err("avatarUrl")}
            </label>
            {editing.form.avatarUrl ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={editing.form.avatarPermission} onChange={(e) => set("avatarPermission", e.target.checked)} />
                <span>I have permission to show this photo on the website.{err("avatarPermission")}</span>
              </label>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={editing.form.consentConfirmed} onChange={(e) => set("consentConfirmed", e.target.checked)} data-testid="testimonial-consent" />
              <span>
                {editing.form.source === "google"
                  ? "Optional for Google: only tick if the customer separately agreed to website display. Do not tick merely because text matched a GBP HTML export."
                  : "The customer agreed to this review being shown on the Laptops HUB website (required to publish for website/merchant sources)."}
                {err("consentConfirmed")}
              </span>
            </label>
            <label className="block text-sm font-medium">
              Internal verification note (never shown publicly)
              <textarea className={input} rows={2} value={editing.form.verificationNote} onChange={(e) => set("verificationNote", e.target.value)} maxLength={1000} placeholder="e.g. Matched to order LH-1042; customer agreed on WhatsApp 12 Nov" />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.form.showOnHomepage} onChange={(e) => set("showOnHomepage", e.target.checked)} />
                Show on the homepage
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.form.featured} onChange={(e) => set("featured", e.target.checked)} />
                Featured (shown first)
              </label>
              <label className="text-sm">
                Display order
                <input type="number" className={input} value={editing.form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={busy === "save"} className={`${btn} border-[var(--adm-border)] bg-white`} data-testid="testimonial-save">
                {busy === "save" ? "Saving…" : editing.id ? "Save changes" : "Save as draft"}
              </button>
              {!editing.id ? (
                <button type="button" disabled={busy === "save"} className={`${btn} border-[var(--adm-border)] bg-white`} onClick={() => void save("pending")} data-testid="testimonial-submit">
                  Save and submit for approval
                </button>
              ) : null}
              {!editing.id && canApprove ? (
                <button type="button" disabled={busy === "save"} className={`${btn} border-[var(--adm-action)] bg-[var(--adm-action)] text-white`} onClick={() => void save("published")} data-testid="testimonial-publish-new">
                  Save and publish
                </button>
              ) : null}
              <button type="button" className={`${btn} border-transparent`} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
          <aside aria-label="Preview">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">Preview on the homepage</p>
            {preview ? <ReviewCard t={preview} /> : null}
          </aside>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--adm-border)] p-6 text-sm text-[var(--adm-ink-2)]" data-testid="testimonial-empty">
          No testimonials{filters.status || filters.source || filters.q ? " match these filters" : " yet"}. The homepage reviews section stays hidden until at least
          one is published.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="testimonial-list">
          {rows.map((r) => (
            <li key={r.id} className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4" data-testid="testimonial-row" data-status={r.status}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.author_name}
                    {r.rating ? <span className="ml-2 text-sm text-amber-600">{"★".repeat(r.rating)}</span> : null}
                    {r.featured ? <span className="ml-2 rounded bg-[var(--adm-info-bg)] px-1.5 py-0.5 text-xs">Featured</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--adm-ink-2)]">
                    {SOURCE_ADMIN_LABEL[r.source]}
                    {r.review_date ? ` · ${r.review_date}` : ""}
                    {r.consent_confirmed ? " · consent recorded" : " · no consent recorded"}
                    {!r.show_on_homepage ? " · not on homepage" : ""} · order {r.sort_order}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm">{r.body}</p>
              {r.verification_note ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Note: {r.verification_note}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(canApprove || r.status === "draft" || r.status === "pending") && (
                  <button type="button" className={`${btn} border-[var(--adm-border)] bg-white`} onClick={() => { setIssues({}); setEditing({ id: r.id, form: fromRow(r) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    Edit
                  </button>
                )}
                {r.status === "draft" ? (
                  <button type="button" disabled={busy === r.id} className={`${btn} border-[var(--adm-border)] bg-white`} onClick={() => void setStatus(r.id, "pending")}>
                    Submit for approval
                  </button>
                ) : null}
                {canApprove && r.status !== "published" ? (
                  <button type="button" disabled={busy === r.id} className={`${btn} border-emerald-600 bg-emerald-600 text-white`} onClick={() => void setStatus(r.id, "published")} data-testid="testimonial-publish">
                    {r.status === "pending" ? "Approve and publish" : "Publish"}
                  </button>
                ) : null}
                {canApprove && r.status === "published" ? (
                  <button type="button" disabled={busy === r.id} className={`${btn} border-[var(--adm-border)] bg-white`} onClick={() => void setStatus(r.id, "hidden")} data-testid="testimonial-hide">
                    Hide (unpublish)
                  </button>
                ) : null}
                {r.status === "pending" || (canApprove && r.status === "hidden") ? (
                  <button type="button" disabled={busy === r.id} className={`${btn} border-[var(--adm-border)] bg-white`} onClick={() => void setStatus(r.id, "draft")}>
                    Back to draft
                  </button>
                ) : null}
                {canApprove ? (
                  <button type="button" disabled={busy === r.id} className={`${btn} border-transparent text-red-700`} onClick={() => void remove(r.id, r.author_name)}>
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${btn} border-transparent text-[var(--adm-ink-2)]`}
                  aria-expanded={openHistory === r.id}
                  onClick={() => setOpenHistory((o) => (o === r.id ? null : r.id))}
                >
                  History ({history[r.id]?.length ?? 0})
                </button>
              </div>
              {openHistory === r.id ? (
                <ol className="mt-3 space-y-1 border-t border-[var(--adm-border)] pt-3 text-xs text-[var(--adm-ink-2)]">
                  {(history[r.id] ?? []).map((h, i) => (
                    <li key={i}>
                      {new Date(h.created_at).toLocaleString("en-GB")} — {ACTION_LABEL[h.action] ?? h.action}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
