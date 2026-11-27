"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ContentHistory } from "@/components/admin/content-history";

type Props = {
  slug: string;
  title: string;
  status: "pending" | "draft" | "published";
  bodyHtml: string;
  legalApproved: boolean;
  isLegalPage: boolean;
  canApproveLegal: boolean;
  /** G19 (null until the database update adds page history). */
  version: number | null;
  seoTitle: string;
  seoDescription: string;
  /** Merchant-made pages only: built-in and policy pages keep their address. */
  canRename: boolean;
};

export function ContentEditForm(props: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(props.title);
  const [status, setStatus] = useState(props.status);
  const [bodyHtml, setBodyHtml] = useState(props.bodyHtml);
  const [legalApproved, setLegalApproved] = useState(props.legalApproved);
  const [approveTemplate, setApproveTemplate] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [seoTitle, setSeoTitle] = useState(props.seoTitle);
  const [seoDescription, setSeoDescription] = useState(props.seoDescription);
  const [newSlug, setNewSlug] = useState(props.slug);
  // The version this form last saved, valid until the server sends a newer one (avoids a false "changed elsewhere").
  const [savedVersion, setSavedVersion] = useState<{ from: number | null; to: number } | null>(null);
  const version = savedVersion && savedVersion.from === props.version ? savedVersion.to : props.version;
  // A newer version from the server that this form did not save (a restore, another tab): show it instead of keeping
  // stale fields that a later save would write back over it.
  const [seenVersion, setSeenVersion] = useState(props.version);
  const [editorKey, setEditorKey] = useState(0);
  if (props.version !== seenVersion) {
    setSeenVersion(props.version);
    if (savedVersion?.to !== props.version) {
      setTitle(props.title);
      setStatus(props.status);
      setBodyHtml(props.bodyHtml);
      setLegalApproved(props.legalApproved);
      setSeoTitle(props.seoTitle);
      setSeoDescription(props.seoDescription);
      setNewSlug(props.slug);
      setEditorKey((k) => k + 1);
    }
  }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (version === null) {
        setErr("Page history is not switched on yet (database update pending). Nothing was saved.");
        return;
      }
      const body: Record<string, unknown> = { title, status, bodyHtml, expectedVersion: version, seoTitle, seoDescription };
      if (props.canRename && newSlug.trim() !== props.slug) body.newSlug = newSlug.trim();
      if (props.isLegalPage && props.canApproveLegal) body.legalApproved = legalApproved;
      if (status === "published" && !bodyHtml.trim()) body.approveTemplate = approveTemplate;
      const res = await fetch(`/api/admin/content/${encodeURIComponent(props.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setSavedVersion({ from: props.version, to: data.version });
      if (data.slug && data.slug !== props.slug) {
        setMsg(`Saved as version ${data.version}. The page moved to /pages/${data.slug}; the old address redirects there.`);
      } else {
        setMsg(`Saved as version ${data.version}.`);
      }
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <AdminCard
        title={props.slug}
        description={`${props.status}${version ? ` · version ${version}` : ""}${props.isLegalPage ? (props.legalApproved ? " · legally approved" : " · needs legal approval") : ""}`}
      >
        {props.isLegalPage ? (
          <p className="mb-3 text-xs text-[var(--adm-ink-2)]">
            Saving or publishing editorial copy is not the same as approving warranty, shipping, privacy or returns
            commitments. Legal approval is a separate owner/manager action.
          </p>
        ) : null}
        <div className="space-y-3">
          <AdminField label="Title">
            <input className={admInputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </AdminField>
          {props.canRename ? (
            <AdminField label="Page address" hint={`/pages/${newSlug || "…"} · changing it keeps a redirect from the old address`}>
              <input className={admInputClass} value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} maxLength={80} />
            </AdminField>
          ) : null}
          <AdminField label="Editorial status">
            <select className={admInputClass} value={status} onChange={(e) => setStatus(e.target.value as Props["status"])}>
              <option value="pending">Pending (not public)</option>
              <option value="draft">Draft (not public)</option>
              <option value="published">Published</option>
            </select>
          </AdminField>
          {props.isLegalPage && props.canApproveLegal ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={legalApproved} onChange={(e) => setLegalApproved(e.target.checked)} />
              Legal / business approval (required before public policy pages)
            </label>
          ) : null}
          <div className="space-y-2">
            <RichTextEditor key={`${props.slug}:${editorKey}`} value={bodyHtml} onChange={setBodyHtml} label="Body" />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--adm-action)] underline"
              onClick={() => setShowSource((v) => !v)}
            >
              {showSource ? "Hide HTML source" : "Show HTML source (advanced)"}
            </button>
            {showSource ? (
              <AdminField label="HTML source" hint="Rare fixes only. Content is sanitised again on save.">
                <textarea
                  className={`${admInputClass} font-[family-name:var(--font-mono)] text-xs`}
                  rows={8}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                />
              </AdminField>
            ) : null}
            <p className="text-xs text-[var(--adm-ink-2)]">
              Leave the body empty only when you approve publishing the V5 template copy for this page.
            </p>
          </div>
          <AdminField label="Search title" optional hint={`${seoTitle.length}/120 · shown in Google results; the page title is used when empty`}>
            <input className={admInputClass} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={120} />
          </AdminField>
          <AdminField label="Search description" optional hint={`${seoDescription.length}/320 · the page introduction is used when empty`}>
            <textarea className={admInputClass} rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={320} />
          </AdminField>
          {status === "published" && !bodyHtml.trim() ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={approveTemplate} onChange={(e) => setApproveTemplate(e.target.checked)} />
              I have reviewed the V5 template copy for this page and approve publishing it
            </label>
          ) : null}
          {err ? (
            <p role="alert" className="text-sm text-[var(--adm-danger)]">
              {err}
            </p>
          ) : null}
          {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
          <button
            type="submit"
            disabled={busy || !hydrated}
            className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-5 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save page"}
          </button>
          <ContentHistory slug={props.slug} version={version} />
        </div>
      </AdminCard>
    </form>
  );
}
