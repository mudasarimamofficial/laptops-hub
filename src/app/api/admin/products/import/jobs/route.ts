import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

/** Recent Shopify CSV import jobs for durable history / retry UX. */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const { data, error } = await supabase
      .from("import_jobs")
      .select(
        "id, source, status, dry_run, profile, strategy, source_filename, source_fingerprint, actor_user_id, progress, report, error_export, created_at, finished_at",
      )
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      // Migration columns may be missing on older DBs — fall back to core columns.
      const fallback = await supabase
        .from("import_jobs")
        .select("id, source, status, dry_run, report, created_at, finished_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (fallback.error) {
        return NextResponse.json({ error: "list_failed", message: fallback.error.message }, { status: 500 });
      }
      return NextResponse.json(
        { jobs: fallback.data || [], notice: "Extended import_jobs columns not available yet." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ jobs: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
