import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { evaluateMerchantWritePolicy } from "@/lib/security/merchant-write-guard";
import { revalidatePath } from "next/cache";

const schema = z.object({
  confirmPublish: z.literal(true),
  /** Source draft (or prior published) to snapshot — never pointed at directly. */
  sourceVersionId: z.string().uuid().optional(),
  /** @deprecated Accepted for compatibility; always snapshotted, never used as live pointer. */
  versionId: z.string().uuid().optional(),
});

/**
 * Publish homepage: always creates an immutable `published` snapshot, then
 * updates theme_publications to that new row (never points at a draft).
 */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "confirm_required", message: "confirmPublish:true required." },
        { status: 400 },
      );
    }

    const policy = evaluateMerchantWritePolicy();
    if (!policy.isLocalSupabase && policy.reason !== "MERCHANT_WRITES_ALLOW_REMOTE=1") {
      return NextResponse.json(
        {
          error: "production_publish_blocked",
          message:
            "Theme publish is blocked until owner-approved go-live on an authorized environment. Local verified Supabase only for now.",
          writePolicy: { reason: policy.reason },
        },
        { status: 403 },
      );
    }

    const sourceVersionId = parsed.data.sourceVersionId || parsed.data.versionId || null;

    const { data, error } = await supabase.rpc("publish_homepage_theme", {
      payload: {
        actor_user_id: staff.userId,
        source_version_id: sourceVersionId,
      },
    });

    if (error) {
      const msg = error.message || "publish_failed";
      const status =
        /forbidden/i.test(msg) ? 403 : /no_draft|not found/i.test(msg) ? 404 : /migration/i.test(msg) ? 409 : 500;
      return NextResponse.json({ error: "publish_failed", message: msg }, { status });
    }

    const result = data as {
      ok?: boolean;
      published_version_id?: string;
      source_version_id?: string;
      previous_version_id?: string | null;
      label?: string;
      section_count?: number;
    };

    if (!result?.ok || !result.published_version_id) {
      return NextResponse.json(
        { error: "publish_inconsistent", message: "Publish RPC did not return a published version id." },
        { status: 500 },
      );
    }

    // Verify pointer + status consistency before reporting success
    const { data: pub } = await supabase
      .from("theme_publications")
      .select("published_version_id")
      .eq("template_key", "homepage")
      .maybeSingle();
    const { data: ver } = await supabase
      .from("theme_versions")
      .select("id, status")
      .eq("id", result.published_version_id)
      .maybeSingle();

    if (
      !pub ||
      pub.published_version_id !== result.published_version_id ||
      !ver ||
      ver.status !== "published"
    ) {
      return NextResponse.json(
        {
          error: "publish_inconsistent",
          message: "Published snapshot and publication pointer are not consistent. Nothing reported as success.",
        },
        { status: 500 },
      );
    }

    revalidatePath("/");
    revalidatePath("/admin/online-store");

    return NextResponse.json(
      {
        ok: true,
        publishedVersionId: result.published_version_id,
        sourceVersionId: result.source_version_id,
        previousVersionId: result.previous_version_id ?? null,
        label: result.label,
        sectionCount: result.section_count,
        notice:
          "Published immutable snapshot. Visitors see it when THEME_PUBLISHED_ENABLED=1. Draft rows were not used as the live pointer.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
