import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { createMerchantSnapshot } from "@/lib/admin/merchant-snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner/admin only — list recent merchant CMS backups. */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin"]);
    const { data, error } = await supabase
      .from("merchant_snapshots")
      .select("id, label, kind, status, payload_bytes, checksum, validation, created_at, verified_at, notes")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, backups: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

const createSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

/** Create a validated merchant CMS snapshot and enforce 4-valid retention. */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Invalid backup request" }, { status: 400 });
    }

    const snap = await createMerchantSnapshot(supabase, {
      label: parsed.data.label || `Backup ${new Date().toISOString().slice(0, 16)}`,
      createdBy: staff.userId,
      notes: parsed.data.notes,
    });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "merchant_snapshot.create",
      entity_type: "merchant_snapshots",
      entity_id: snap.id,
      after: { status: snap.status, bytes: snap.payload_bytes },
    });

    return NextResponse.json({ ok: true, backup: snap }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
