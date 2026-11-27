"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** G19: start a new content page as a draft. It is not public until it has a body and is published. */
export function ContentCreateForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const address = slugEdited ? slug : toSlug(title);

  return (
    <AdminCard title="New page" description="Created as a draft. Customers see it only after you add text and publish it.">
      <form
        method="post"
        data-testid="content-create"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          setMsg(null);
          try {
            const res = await fetch("/api/admin/content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, slug: address }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setErr(data.message || `The page could not be created (${res.status}).`);
              return;
            }
            setMsg(`Draft page created at /pages/${data.slug}. Edit it below.`);
            setTitle("");
            setSlug("");
            setSlugEdited(false);
            router.refresh();
          } catch {
            setErr("Network error: nothing was created. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <AdminField label="New page title">
          <input className={admInputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </AdminField>
        <AdminField label="New page address" hint={`/pages/${address || "…"}`}>
          <input
            className={admInputClass}
            value={address}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            maxLength={80}
          />
        </AdminField>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={!hydrated || busy || title.trim().length < 2 || address.length < 2}
            className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] border border-[var(--adm-border)] px-5 text-sm font-semibold disabled:opacity-50"
          >
            Create draft page
          </button>
          {err ? (
            <p role="alert" className="mt-2 text-sm text-[var(--adm-danger)]">
              {err}
            </p>
          ) : null}
          {msg ? (
            <p role="status" className="mt-2 text-sm text-[var(--adm-success)]">
              {msg}
            </p>
          ) : null}
        </div>
      </form>
    </AdminCard>
  );
}
