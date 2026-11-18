"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { BLOG_TEMPLATES, RichTextEditor } from "@/components/admin/rich-text-editor";

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
};

const input = "mt-1 w-full min-w-0 rounded-xl border border-[var(--lh-border)] px-3 py-2";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Blog post editor (public.articles). Visual editing by default; HTML sanitised on save. */
export function PostForm({ id, initial }: { id?: string; initial: PostFormValues }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<PostFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [showHtml, setShowHtml] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof PostFormValues>(k: K, val: PostFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const fieldErr = (k: string) => (fe[k] ? <span role="alert" className="mt-1 block text-xs text-[var(--lh-error)]">{fe[k]}</span> : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    setFe({});
    try {
      const res = await fetch(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
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
      setMsg("Post saved.");
      router.refresh();
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

  function applyTemplate(key: string) {
    const t = BLOG_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    const ok = !v.bodyHtml.trim() || window.confirm("Replace the current body with this template? You can still edit afterwards.");
    if (!ok) return;
    setV((x) => ({
      ...x,
      templateKey: t.key,
      excerpt: x.excerpt || t.excerpt,
      bodyHtml: t.bodyHtml,
    }));
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5 text-sm">
      {!id ? (
        <fieldset className="space-y-2 rounded-xl border border-[var(--adm-border)] p-3">
          <legend className="px-1 font-semibold">Start from a template</legend>
          <p className="text-xs text-[var(--adm-ink-2)]">Templates are editable starters — they never invent product facts.</p>
          <div className="flex flex-wrap gap-2">
            {BLOG_TEMPLATES.map((t) => (
              <button key={t.key} type="button" className="rounded-full border border-[var(--lh-border)] px-3 py-1.5 text-xs font-semibold" onClick={() => applyTemplate(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="block">
        <span className="font-medium">Title</span>
        <input
          className={input}
          value={v.title}
          required
          maxLength={160}
          onChange={(e) => {
            set("title", e.target.value);
            if (!slugTouched) set("slug", slugify(e.target.value));
          }}
        />
        {fieldErr("title")}
      </label>
      <label className="block">
        <span className="font-medium">Address</span>
        <span className="mt-1 flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-[var(--lh-ink-2)]">/guides/</span>
          <input
            className={input.replace("mt-1 ", "")}
            value={v.slug}
            required
            maxLength={80}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
          />
        </span>
        {fieldErr("slug")}
      </label>
      <label className="block">
        <span className="font-medium">Summary (shown on the guides list)</span>
        <input className={input} value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} maxLength={300} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="font-medium">Author</span>
          <input className={input} value={v.authorName} onChange={(e) => set("authorName", e.target.value)} maxLength={80} placeholder="Laptops HUB" />
        </label>
        <label className="block">
          <span className="font-medium">Category</span>
          <input className={input} value={v.category} onChange={(e) => set("category", e.target.value)} maxLength={80} placeholder="Buying guides" />
        </label>
      </div>
      <RichTextEditor key={id || "new"} value={v.bodyHtml} onChange={(html) => set("bodyHtml", html)} label="Post body" />
      {fieldErr("bodyHtml")}
      <details className="rounded-xl border border-[var(--adm-border)] p-3" open={showHtml} onToggle={(e) => setShowHtml((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-medium">Advanced: HTML source</summary>
        <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Only for rare fixes. Content is sanitised on save.</p>
        <textarea className={`${input} font-[family-name:var(--font-mono)] text-xs`} rows={8} value={v.bodyHtml} onChange={(e) => set("bodyHtml", e.target.value)} />
      </details>
      <fieldset className="space-y-3 rounded-xl border border-[var(--adm-border)] p-3">
        <legend className="px-1 font-semibold">SEO &amp; sharing</legend>
        <label className="block">
          <span className="font-medium">SEO title ({v.seoTitle.length}/70)</span>
          <input className={input} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} placeholder={v.title} />
        </label>
        <label className="block">
          <span className="font-medium">Meta description ({v.seoDescription.length}/160)</span>
          <textarea className={input} rows={3} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={160} placeholder={v.excerpt} />
        </label>
        <label className="block">
          <span className="font-medium">Cover image URL</span>
          <input className={input} value={v.coverImageUrl} onChange={(e) => set("coverImageUrl", e.target.value)} maxLength={500} placeholder="https://" />
        </label>
        <label className="block">
          <span className="font-medium">Social share image URL</span>
          <input className={input} value={v.ogImageUrl} onChange={(e) => set("ogImageUrl", e.target.value)} maxLength={500} placeholder="https://" />
        </label>
        <div className="rounded-lg bg-[var(--adm-canvas,#f8fafc)] p-3 text-xs text-[var(--adm-ink-2)]">
          <p className="font-semibold text-[var(--adm-ink)]">Search preview</p>
          <p className="mt-1 text-[#1748B5]">{v.seoTitle || v.title || "Post title"}</p>
          <p className="text-emerald-700">laptopshub.pk/guides/{v.slug || "…"}</p>
          <p>{v.seoDescription || v.excerpt || "Meta description appears here."}</p>
        </div>
      </fieldset>
      <label className="block">
        <span className="font-medium">Status</span>
        <select className={input} value={v.status} onChange={(e) => set("status", e.target.value as PostFormValues["status"])}>
          <option value="draft">Draft (not public)</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!hydrated || busy} className="rounded-full bg-[var(--lh-action)] px-5 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save post"}
        </button>
        {id ? (
          <button type="button" disabled={!hydrated || busy} onClick={onDelete} className="rounded-full border border-[var(--lh-border)] px-4 py-2">
            Delete
          </button>
        ) : null}
        {err ? <p role="alert" className="text-[var(--lh-error)]">{err}</p> : null}
        {msg ? <p role="status" className="text-emerald-700">{msg}</p> : null}
      </div>
    </form>
  );
}
