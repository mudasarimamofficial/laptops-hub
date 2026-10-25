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
import {
  canPersistMerchantSideEffects,
  evaluateMerchantWritePolicy,
} from "@/lib/security/merchant-write-guard";
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
    } else if (c === ",") {
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
  /** The SHA-256 fingerprint from the validated dry run preview */
  previewFingerprint: z.string().max(80).optional(),
});

/**
 * Preview (dryRun=true, default) or commit (dryRun=false + confirmCommit=true).
 *
 * Rules:
 * - Preview environments connected to Production Supabase are strictly read-only.
 * - Genuine Production deployments permit commits by owner/admin with explicit confirmation and dry-run validation.
 * - Local / isolated staging environments permit commits by authorized staff.
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: "Provide valid csvText and strategy.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (Buffer.byteLength(parsed.data.csvText, "utf8") > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large", message: "CSV exceeds 25 MB." }, { status: 413 });
    }

    const dryRun = parsed.data.dryRun !== false;
    const writePolicy = evaluateMerchantWritePolicy();
    const mayPersist = canPersistMerchantSideEffects();

    // 1. Guard against accidental mutations
    if (!dryRun && parsed.data.confirmCommit !== true) {
      return NextResponse.json(
        {
          error: "confirm_required",
          message: "Set confirmCommit=true to apply mutations to the catalog.",
        },
        { status: 400 },
      );
    }

    // 2. Preview-to-Production write protection
    if (!dryRun && !mayPersist) {
      return NextResponse.json(
        {
          error: "merchant_writes_blocked",
          message: `CSV commit refused: ${writePolicy.reason}. Preview deployments sharing Production Supabase are read-only.`,
          writePolicy,
        },
        { status: 403 },
      );
    }

    // 3. In Production, enforce owner/admin role (managers can dry-run, but not commit live)
    if (!dryRun && writePolicy.isProductionSupabase && staff.role !== "owner" && staff.role !== "admin") {
      return NextResponse.json(
        {
          error: "forbidden_role",
          message: "Only store owners and administrators can commit CSV imports to the Production catalog.",
        },
        { status: 403 },
      );
    }

    const { headers, rows } = parseCsv(parsed.data.csvText);
    const detected = detectShopifyCsvProfile(headers);
    if (detected.profile === "unknown") {
      return NextResponse.json(
        {
          error: "unsupported_csv",
          message: "Could not detect Shopify modern or legacy product headers in uploaded CSV.",
          headersFound: headers.slice(0, 20),
        },
        { status: 400 },
      );
    }

    const staged = stageShopifyRows(rows, detected.mapped as Partial<Record<CanonicalField, string>>);
    const stagingSummary = summarizeStaging(staged.products, detected.unknown);
    const fingerprint = createHash("sha256").update(parsed.data.csvText).digest("hex").slice(0, 40);

    // 4. In Production commit, require dry-run fingerprint verification
    if (!dryRun && writePolicy.isProductionSupabase) {
      if (parsed.data.previewFingerprint && parsed.data.previewFingerprint !== fingerprint) {
        return NextResponse.json(
          {
            error: "fingerprint_mismatch",
            message: "The CSV content has changed since the dry-run preview was generated. Please run a fresh dry-run preview before committing.",
          },
          { status: 400 },
        );
      }
    }

    let jobId: string | undefined;

    // 5. Persist job tracking row when allowed
    if (mayPersist) {
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

      jobId = job?.id as string | undefined;
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
    }

    // 6. Execute import
    const { results, summary } = await commitStagedProducts(supabase, staged.products, {
      strategy: parsed.data.strategy as ImportStrategy,
      actorUserId: staff.userId,
      dryRun,
      defaultInventoryMode: "untracked",
      ...(mayPersist ? {} : { dryRun: true }),
    });

    // 7. Update job completion report & audit log
    if (mayPersist && jobId) {
      await supabase
        .from("import_jobs")
        .update({
          status: dryRun ? "dry_run_complete" : summary.failed ? "completed_with_errors" : "completed",
          finished_at: new Date().toISOString(),
          report: { stagingSummary, summary, results: results.slice(0, 500), profile: detected.profile },
          progress: { phase: "done" },
        })
        .eq("id", jobId);

      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: dryRun ? "products.import.dry_run" : "products.import.commit",
        entity_type: "import_jobs",
        entity_id: jobId || null,
        after: {
          summary,
          fingerprint,
          strategy: parsed.data.strategy,
          filename: parsed.data.filename || null,
          productCount: staged.products.length,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        jobId: jobId || null,
        persisted: mayPersist,
        writePolicy: {
          allowed: writePolicy.allowed,
          reason: writePolicy.reason,
          isProductionSupabase: writePolicy.isProductionSupabase,
        },
        profile: detected.profile,
        fingerprint,
        stagingSummary,
        unknownHeaders: detected.unknown,
        rowErrors: staged.errors.slice(0, 100),
        summary,
        results: results.slice(0, 200),
        notice: mayPersist
          ? undefined
          : "In-memory preview only — no import_jobs or audit_logs were written (Preview deployments cannot mutate Production).",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
