"use client";

import { useMemo, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  detectShopifyCsvProfile,
  stageShopifyRows,
  summarizeStaging,
  type CanonicalField,
} from "@/lib/catalog/shopify-csv";

type PreviewState = {
  profile: string;
  known: string[];
  unknown: string[];
  summary: ReturnType<typeof summarizeStaging>;
  errors: { line: number; message: string }[];
  sampleHandles: string[];
};

function parseCsvClient(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Minimal RFC4180-ish parser for browser preview (server commit path will re-parse with csv-parse).
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
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c === "\r") {
      // skip; handle CRLF via \n
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = (rows[0] || []).map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  const mapped = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
  return { headers, rows: mapped };
}

export function ShopifyImportWizard() {
  const hydrated = useHydrated();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"add_only" | "update_by_handle" | "skip_conflicts">("add_only");

  async function onFile(file: File | null) {
    setErr(null);
    setPreview(null);
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

  const canCommitHint = useMemo(() => {
    if (!preview) return null;
    return "Dry-run and commit against Production are blocked until owner approval. Use an isolated Supabase stack for mutation tests.";
  }, [preview]);

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
        <label className="block text-sm font-medium">
          Shopify product CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm"
            disabled={!hydrated}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {fileName ? <p className="mt-2 text-xs text-[var(--adm-ink-2)]">Selected: {fileName}</p> : null}
        {err ? (
          <p className="mt-3 text-sm text-[var(--adm-danger)]" role="alert">
            {err}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow)]">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Preview</h2>
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
            <span className="font-medium">Import strategy (for future commit)</span>
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
            {canCommitHint} Missing products from a CSV are never deleted. Image URLs stay as remote references with
            pending rights.
          </p>

          <button
            type="button"
            disabled
            className="mt-4 rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white opacity-50"
            title="Requires isolated DB + owner approval for Production"
          >
            Commit import (gated)
          </button>
        </div>
      ) : null}
    </div>
  );
}
