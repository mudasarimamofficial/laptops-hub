"use client";

import { useCallback, useEffect, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

type ImportJob = {
  id: string;
  source: string;
  status: string;
  dry_run: boolean;
  profile?: string | null;
  strategy?: string | null;
  source_filename?: string | null;
  source_fingerprint?: string | null;
  progress?: Record<string, unknown> | null;
  report?: {
    summary?: Record<string, number>;
    stagingSummary?: { productCount?: number };
  } | null;
  created_at: string;
  finished_at?: string | null;
};

type Props = {
  onRetryJob?: (job: ImportJob) => void;
};

export function ImportJobHistory({ onRetryJob }: Props) {
  const hydrated = useHydrated();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/products/import/jobs");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || "Failed to load import history");
        setJobs([]);
        return;
      }
      setJobs((data.jobs || []) as ImportJob[]);
    } catch {
      setErr("Network error loading import history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  return (
    <div
      data-testid="import-job-history"
      className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Import job history</h2>
          <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
            Durable dry-run and commit records. Retry reuses the job strategy; re-attach the same CSV to continue.
          </p>
        </div>
        <button
          type="button"
          data-testid="import-history-refresh"
          disabled={!hydrated || loading}
          onClick={() => void load()}
          className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}

      {!loading && jobs.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--adm-ink-2)]">No import jobs yet.</p>
      ) : null}

      {jobs.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--adm-border)]">
          {jobs.map((job) => {
            const summary = job.report?.summary || {};
            const products = job.report?.stagingSummary?.productCount;
            return (
              <li key={job.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm" data-testid={`import-job-${job.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                      {job.id.slice(0, 8)}
                    </span>{" "}
                    · {job.source_filename || "(unnamed CSV)"}
                  </p>
                  <p className="mt-1 text-[var(--adm-ink-2)]">
                    {job.status}
                    {job.dry_run ? " · dry-run" : " · commit"}
                    {job.profile ? ` · ${job.profile}` : ""}
                    {job.strategy ? ` · ${job.strategy}` : ""}
                    {typeof products === "number" ? ` · ${products} products staged` : ""}
                  </p>
                  {Object.keys(summary).length > 0 ? (
                    <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink)]">
                      {Object.entries(summary)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
                    {new Date(job.created_at).toLocaleString()}
                    {job.source_fingerprint ? ` · fp ${job.source_fingerprint.slice(0, 10)}…` : ""}
                  </p>
                </div>
                {onRetryJob ? (
                  <button
                    type="button"
                    data-testid={`import-retry-${job.id}`}
                    className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-xs font-semibold"
                    onClick={() => onRetryJob(job)}
                  >
                    Retry with CSV…
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
