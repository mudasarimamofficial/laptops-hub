import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { MERCH_SETTINGS_ROLES } from "@/lib/content/admin-roles";
import {
  clearFeaturedFlamePreset,
  ensureFeaturedFlamePreset,
  getFeaturedFlamePreset,
  setFeaturedFlamePresetEnabled,
  updateFeaturedFlamePresetMeta,
} from "@/lib/content/featured-flame-preset-server";

function refresh() {
  revalidateTag("product-badges", { expire: 0 });
  revalidateTag("featured-flame-preset", { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/admin/merchandising");
}

/** Staff: read current 🔥 Featured preset state. */
export async function GET() {
  try {
    await createAuthorizedStaffWriter(MERCH_SETTINGS_ROLES);
    const preset = await getFeaturedFlamePreset();
    return NextResponse.json({ ok: true, preset }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

const patchSchema = z.object({
  action: z.enum(["ensure", "restore", "enable", "disable", "update", "clear"]),
  label: z.string().trim().min(1).max(40).optional(),
  icon: z.enum(["flame", "star"]).optional(),
  clearSuppressed: z.boolean().optional(),
});

/**
 * Merchant controls for the default 🔥 Featured preset.
 * ensure is idempotent; restore re-applies sensible defaults without inventing sales claims.
 */
export async function PATCH(request: Request) {
  try {
    const { staff } = await createAuthorizedStaffWriter(MERCH_SETTINGS_ROLES);
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Invalid preset action." }, { status: 400 });
    }
    const v = parsed.data;
    const uid = staff.userId;

    if (v.action === "ensure") {
      const result = await ensureFeaturedFlamePreset({ actorUserId: uid });
      refresh();
      return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    }
    if (v.action === "restore") {
      const result = await ensureFeaturedFlamePreset({
        force: true,
        clearSuppressed: v.clearSuppressed === true,
        actorUserId: uid,
      });
      refresh();
      return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    }
    if (v.action === "enable" || v.action === "disable") {
      const preset = await setFeaturedFlamePresetEnabled(v.action === "enable", uid);
      refresh();
      return NextResponse.json({ ok: true, preset }, { headers: { "Cache-Control": "no-store" } });
    }
    if (v.action === "clear") {
      const preset = await clearFeaturedFlamePreset({ suppress: true, actorUserId: uid });
      refresh();
      return NextResponse.json({ ok: true, preset }, { headers: { "Cache-Control": "no-store" } });
    }
    const preset = await updateFeaturedFlamePresetMeta({ label: v.label, icon: v.icon }, uid);
    refresh();
    return NextResponse.json({ ok: true, preset }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
