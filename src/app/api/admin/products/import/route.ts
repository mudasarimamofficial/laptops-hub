import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { commitStagedProducts, type ImportStrategy } from "@/lib/catalog/shopify-import-commit";
import {
  detectShopifyCsvProfile,
  stageShopifyRows,
  summarizeStaging,
  type CanonicalField,
} from "@/lib/catalog/shopify-csv";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
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

const bodySchema = z.object({
  csvText: z.string().min(10).max(MAX_BYTES),
  filename: z.string().max(260).optional(),
  strategy: z.enum(["add_only", "update_by_handle", "skip_conflicts"]).default("add_only"),
  dryRun: z.boolean().default(true),
  /** Required true to mutate. Prevents accidental commits from the preview UI. */
  confirmCommit: z.boolean().optional(),
});

/**
 * Preview (dryRun=true, default) or commit (dryRun=false + confirmCommit=true).
 * Production catalog commits still require owner ops approval — this endpoint is
 * intended for isolated stacks and Preview-with-isolated-DB only.
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Provide csvText and strategy." }, { status: 400 });
    }

    if (Buffer.byteLength(parsed.data.csvText, "utf8") > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large", message: "CSV exceeds 25 MB." }, { status: 413 });
    }

    const dryRun = parsed.data.dryRun !== false;
    if (!dryRun && parsed.data.confirmCommit !== true) {
      return NextResponse.json(
        { error: "confirm_required", message: "Set confirmCommit=true to apply mutations." },
        { status: 400 },
      );
    }

    // Refuse mutating against Production host unless explicitly overridden by local URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isLocal = /127\.0\.0\.1|localhost|\[::1\]/.test(supabaseUrl);
    if (!dryRun && !isLocal) {
      return NextResponse.json(
        {
          error: "production_commit_blocked",
          message:
            "CSV commit is blocked against non-local databases. Use isolated Supabase or obtain explicit owner approval for a dedicated staging import path.",
        },
        { status: 403 },
      );
    }

    const { headers, rows } = parseCsv(parsed.data.csvText);
    const detected = detectShopifyCsvProfile(headers);
    if (detected.profile === "unknown") {
      return NextResponse.json(
        { error: "unsupported_csv", message: "Could not detect Shopify modern or legacy product headers." },
        { status: 400 },
      );
    }

    const staged = stageShopifyRows(rows, detected.mapped as Partial<Record<CanonicalField, string>>);
    const stagingSummary = summarizeStaging(staged.products, detected.unknown);
    const fingerprint = createHash("sha256").update(parsed.data.csvText).digest("hex").slice(0, 40);

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({
        source: "shopify_csv",
        status: dryRun ? "dry_run" : "running",
        dry_run: dryRun,
        profile: detected.profile,
        strategy: parsed.data.strategy,
        source_filename: parsed.data.filename || null,
        source_fingerprint: fingerprint,
        actor_user_id: staff.userId,
        progress: { phase: dryRun ? "preview" : "commit", productCount: stagingSummary.productCount },
        report: { stagingSummary, unknownHeaders: detected.unknown },
      })
      .select("id")
      .single();

    // If extended columns missing, insert minimal job
    let jobId = job?.id as string | undefined;
    if (jobErr) {
      const retry = await supabase
        .from("import_jobs")
        .insert({
          source: "shopify_csv",
          status: dryRun ? "dry_run" : "running",
          dry_run: dryRun,
          report: { stagingSummary },
        })
        .select("id")
        .single();
      jobId = retry.data?.id;
    }

    const { results, summary } = await commitStagedProducts(supabase, staged.products, {
      strategy: parsed.data.strategy as ImportStrategy,
      actorUserId: staff.userId,
      dryRun,
      defaultInventoryMode: "untracked",
    });

    if (jobId) {
      await supabase
        .from("import_jobs")
        .update({
          status: dryRun ? "dry_run_complete" : summary.failed ? "completed_with_errors" : "completed",
          finished_at: new Date().toISOString(),
          report: { stagingSummary, summary, results: results.slice(0, 500), profile: detected.profile },
          progress: { phase: "done" },
        })
        .eq("id", jobId);
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: dryRun ? "products.import.dry_run" : "products.import.commit",
      entity_type: "import_jobs",
      entity_id: jobId || null,
      after: { summary, fingerprint, strategy: parsed.data.strategy },
    });

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        jobId: jobId || null,
        profile: detected.profile,
        fingerprint,
        stagingSummary,
        unknownHeaders: detected.unknown,
        rowErrors: staged.errors.slice(0, 100),
        summary,
        results: results.slice(0, 200),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
