import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { evaluateMerchantWritePolicy } from "@/lib/security/merchant-write-guard";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const schema = z.object({
  confirmRollback: z.literal(true),
  targetVersionId: z.string().uuid(),
});

/**
 * Point homepage publication at a previously published immutable snapshot.
 *
 * Rules:
 * - Blocked if Preview deployment shares Production Supabase.
 * - Allowed in Production and local/staging for authorized owner/admin.
 * - Bounded by THEME_PUBLISH_DISABLED=1 emergency kill switch.
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "confirm_required", message: "confirmRollback:true and targetVersionId required." },
        { status: 400 },
      );
    }

    const policy = evaluateMerchantWritePolicy();
    if (!policy.allowed) {
      return NextResponse.json(
        {
          error: "theme_rollback_blocked",
          message: `Theme rollback refused: ${policy.reason}. Preview deployments sharing Production Supabase are read-only.`,
          writePolicy: { reason: policy.reason },
        },
        { status: 403 },
      );
    }

    if (process.env.THEME_PUBLISH_DISABLED === "1") {
      return NextResponse.json(
        {
          error: "theme_rollback_disabled",
          message: "Theme rollback is disabled by environment configuration (THEME_PUBLISH_DISABLED=1).",
        },
        { status: 403 },
      );
    }

    const { data, error } = await supabase.rpc("rollback_homepage_theme", {
      payload: {
        actor_user_id: staff.userId,
        target_version_id: parsed.data.targetVersionId,
      },
    });

    if (error) {
      const msg = error.message || "rollback_failed";
      const status = /forbidden/i.test(msg) ? 403 : /invalid_target/i.test(msg) ? 400 : 500;
      return NextResponse.json({ error: "rollback_failed", message: msg }, { status });
    }

    const result = data as { ok?: boolean; published_version_id?: string; previous_version_id?: string | null };
    if (!result?.ok || !result.published_version_id) {
      return NextResponse.json({ error: "rollback_inconsistent" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "theme.homepage.rollback",
      entity_type: "theme_publications",
      entity_id: result.published_version_id,
      after: {
        published_version_id: result.published_version_id,
        previous_version_id: result.previous_version_id,
        target_version_id: parsed.data.targetVersionId,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin/online-store");

    return NextResponse.json(
      {
        ok: true,
        publishedVersionId: result.published_version_id,
        previousVersionId: result.previous_version_id ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
