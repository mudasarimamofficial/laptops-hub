"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";

export type PostFormValues = { slug: string; title: string; excerpt: string; bodyHtml: string; status: "draft" | "published" };

const input = "mt-1 w-full min-w-0 rounded-xl border border-[var(--lh-border)] px-3 py-2";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Blog post editor (public.articles). Body is safe HTML, sanitised on save and on render. */
export function PostForm({ id, initial }: { id?: string; initial: PostFormValues }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<PostFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
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

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-3 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5 text-sm">
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
      <label className="block">
        <span className="font-medium">Body (safe HTML — headings, paragraphs, lists, links)</span>
        <textarea className={`${input} font-[family-name:var(--font-mono)] text-xs`} rows={14} value={v.bodyHtml} onChange={(e) => set("bodyHtml", e.target.value)} />
        <span className="mt-1 block text-xs text-[var(--lh-ink-2)]">Write only facts you can stand behind: no invented prices, stock, warranties or delivery promises.</span>
        {fieldErr("bodyHtml")}
      </label>
      <label className="block">
        <span className="font-medium">Status</span>
        <select className={input} value={v.status} onChange={(e) => set("status", e.target.value as PostFormValues["status"])}>
          <option value="draft">Draft (not public)</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!hydrated || busy} className="rounded-full bg-[var(--lh-action)] px-5 py-2 font-semibold text-white disabled:opacity-50">
          Save post
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
