import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { restoreMerchantSnapshot } from "@/lib/admin/merchant-snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Owner-only restore of a validated merchant CMS snapshot (atomic RPC). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner"]);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "not_found", message: "Backup not found" }, { status: 404 });
    }

    const result = await restoreMerchantSnapshot(supabase, id, staff.userId);

    revalidateTag("settings", { expire: 0 });
    revalidateTag("content", { expire: 0 });
    revalidateTag("reels", { expire: 0 });
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/blog");
    revalidatePath("/admin/reels");
    revalidatePath("/guides");

    return NextResponse.json(
      { ok: result.ok, snapshotId: result.snapshotId, checkpointId: result.checkpointId, keptLive: result.keptLive },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Restore failed";
    if (
      /not found|validated|integrity|checksum|checkpoint|legacy|incomplete|transaction rolled back/i.test(message)
    ) {
      return NextResponse.json({ error: "restore_refused", message }, { status: 400 });
    }
    return staffErrorResponse(e);
  }
}
