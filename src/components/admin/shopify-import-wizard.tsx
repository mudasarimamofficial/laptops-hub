"use client";

import { useRef, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  detectShopifyCsvProfile,
  stageShopifyRows,
  summarizeStaging,
  type CanonicalField,
} from "@/lib/catalog/shopify-csv";
import { ImportJobHistory } from "@/components/admin/import-job-history";

type PreviewState = {
  profile: string;
  known: string[];
  unknown: string[];
  summary: ReturnType<typeof summarizeStaging>;
  errors: { line: number; message: string }[];
  sampleHandles: string[];
};

type ServerReport = {
  dryRun: boolean;
  jobId?: string | null;
  summary?: Record<string, number>;
  results?: { handle: string; action: string; message?: string }[];
  error?: string;
  message?: string;
};

function parseCsvClient(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows[0] || []).map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return {
    headers,
    rows: dataRows.map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    }),
  };
}

export function ShopifyImportWizard() {
  const hydrated = useHydrated();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"add_only" | "update_by_handle" | "skip_conflicts">("add_only");
  const [busy, setBusy] = useState(false);
  const [serverReport, setServerReport] = useState<ServerReport | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [expectedFingerprint, setExpectedFingerprint] = useState<string | null>(null);

  async function onFile(file: File | null) {
    setErr(null);
    setPreview(null);
    setServerReport(null);
    setCsvText(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErr("Please upload a .csv file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErr("File exceeds 25 MB preview limit.");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const { headers, rows } = parseCsvClient(text);
    const detected = detectShopifyCsvProfile(headers);
    if (detected.profile === "unknown") {
      setErr("Could not detect Shopify modern or legacy product CSV headers. Check the first row.");
      return;
    }
    const staged = stageShopifyRows(rows, detected.mapped as Partial<Record<CanonicalField, string>>);
    const summary = summarizeStaging(staged.products, detected.unknown);
    setPreview({
      profile: detected.profile,
      known: detected.known,
      unknown: detected.unknown,
      summary,
      errors: staged.errors.slice(0, 50),
      sampleHandles: staged.products.slice(0, 12).map((p) => p.handle),
    });
  }

  async function runServer(dryRun: boolean) {
    if (!csvText) return;
    setBusy(true);
    setErr(null);
    setServerReport(null);
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          filename: fileName,
          strategy,
          dryRun,
          confirmCommit: dryRun ? undefined : true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Import failed (${res.status})`);
        setServerReport({ dryRun, error: data.error, message: data.message });
        return;
      }
      setServerReport(data);
      setHistoryKey((k) => k + 1);
      if (expectedFingerprint && data.fingerprint && expectedFingerprint !== data.fingerprint) {
        setErr(
          `CSV fingerprint differs from the job you are retrying (expected ${expectedFingerprint.slice(0, 10)}…). Strategy was restored; verify you attached the same file.`,
        );
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
        <label className="block text-sm font-medium">
          Shopify product CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm"
            disabled={!hydrated}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {fileName ? <p className="mt-2 text-xs text-[var(--adm-ink-2)]">Selected: {fileName}</p> : null}
        {retryHint ? (
          <p className="mt-2 text-sm text-[var(--adm-ink)]" role="status" data-testid="import-retry-hint">
            {retryHint}
          </p>
        ) : null}
        {err ? (
          <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
            {err}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Client preview</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-[var(--adm-ink-2)]">Detected profile</dt>
              <dd className="font-semibold capitalize">{preview.profile}</dd>
            </div>
            <div>
              <dt className="text-[var(--adm-ink-2)]">Products (by handle)</dt>
              <dd className="font-semibold">{preview.summary.productCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--adm-ink-2)]">Variant row signals</dt>
              <dd className="font-semibold">{preview.summary.variantCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--adm-ink-2)]">Unknown columns</dt>
              <dd className="font-semibold">{preview.summary.unknownHeaderCount}</dd>
            </div>
          </dl>

          {preview.unknown.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">
                Unmapped columns (preserved in report, not silently discarded)
              </p>
              <p className="mt-1 text-sm text-[var(--adm-ink)]">{preview.unknown.slice(0, 20).join(", ")}</p>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2)]">Sample handles</p>
            <ul className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink)]">
              {preview.sampleHandles.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>

          {preview.errors.length > 0 ? (
            <div className="mt-4 rounded-lg border border-[var(--adm-warning)] bg-[var(--adm-warning-bg)] p-3 text-sm">
              <p className="font-semibold">Row issues ({preview.errors.length} shown)</p>
              <ul className="mt-2 space-y-1">
                {preview.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="mt-5 block text-sm">
            <span className="font-medium">Import strategy</span>
            <select
              className="mt-1 w-full max-w-md rounded-lg border border-[var(--adm-border)] px-3 py-2"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as typeof strategy)}
            >
              <option value="add_only">Add only (never update existing handles)</option>
              <option value="update_by_handle">Update matching by handle</option>
              <option value="skip_conflicts">Skip conflicts</option>
            </select>
          </label>

          <p className="mt-4 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-sm text-[var(--adm-ink-2)]">
            Missing products from a CSV are never deleted. Image URLs stay as remote references with pending rights.
            Server dry-run writes an import_jobs report. Commit is allowed only against local Supabase.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!hydrated || busy || !csvText}
              onClick={() => runServer(true)}
              className="rounded-lg border border-[var(--adm-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Working…" : "Server dry-run"}
            </button>
            <button
              type="button"
              disabled={!hydrated || busy || !csvText}
              onClick={() => {
                if (!confirm("Commit this import to the connected database? Blocked on Production hosts.")) return;
                runServer(false);
              }}
              className="rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Commit (local DB only)
            </button>
          </div>

          {serverReport ? (
            <div className="mt-5 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-4 text-sm">
              <p className="font-semibold">
                Server {serverReport.dryRun ? "dry-run" : "commit"} report
                {serverReport.jobId ? ` · job ${serverReport.jobId.slice(0, 8)}…` : ""}
              </p>
              {serverReport.summary ? (
                <pre className="mt-2 overflow-x-auto font-[family-name:var(--font-mono)] text-xs">
                  {JSON.stringify(serverReport.summary, null, 2)}
                </pre>
              ) : null}
              {serverReport.results?.length ? (
                <ul className="mt-2 max-h-48 overflow-y-auto font-[family-name:var(--font-mono)] text-xs">
                  {serverReport.results.slice(0, 40).map((r) => (
                    <li key={`${r.handle}-${r.action}`}>
                      {r.handle}: {r.action}
                      {r.message ? ` (${r.message})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ImportJobHistory
        key={historyKey}
        onRetryJob={(job) => {
          const nextStrategy =
            job.strategy === "update_by_handle" || job.strategy === "skip_conflicts" || job.strategy === "add_only"
              ? job.strategy
              : "add_only";
          setStrategy(nextStrategy);
          setExpectedFingerprint(job.source_fingerprint || null);
          setRetryHint(
            `Retrying job ${job.id.slice(0, 8)}… with strategy “${nextStrategy}”. Re-attach ${job.source_filename || "the same CSV"}, then dry-run or commit.`,
          );
          setServerReport(null);
          setPreview(null);
          setCsvText(null);
          setFileName(null);
          fileInputRef.current?.focus();
          fileInputRef.current?.click();
        }}
      />
    </div>
  );
}
