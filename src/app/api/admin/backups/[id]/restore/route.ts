import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { restoreMerchantSnapshot } from "@/lib/admin/merchant-snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Owner-only restore of a validated merchant CMS snapshot. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner"]);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "not_found", message: "Backup not found" }, { status: 404 });
    }

    const result = await restoreMerchantSnapshot(supabase, id, staff.userId);
    return NextResponse.json({ ok: result.ok, snapshotId: result.snapshotId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Restore failed";
    if (message.includes("not found") || message.includes("validated") || message.includes("integrity")) {
      return NextResponse.json({ error: "restore_refused", message }, { status: 400 });
    }
    return staffErrorResponse(e);
  }
}
