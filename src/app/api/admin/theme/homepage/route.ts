import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthorizedStaffClient,
  createAuthorizedStaffWriter,
  staffErrorResponse,
} from "@/lib/auth/staff";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance } from "@/lib/content/site-builder-schema";

const saveSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1).max(80),
      type: z.string().min(1).max(80),
      enabled: z.boolean(),
      label: z.string().max(120),
      settings: z.record(z.string(), z.unknown()),
    }),
  ),
});

/**
 * GET draft homepage sections. Falls back to in-code V5 defaults when DB tables
 * are not yet migrated (Production remains on prior ledger).
 */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "editor"]);

    const { data: template, error: tErr } = await supabase
      .from("theme_templates")
      .select("id, key")
      .eq("key", "homepage")
      .maybeSingle();

    if (tErr || !template) {
      return NextResponse.json(
        {
          source: "code_defaults",
          migrationRequired: true,
          sections: V5_HOMEPAGE_SECTIONS,
          notice: "theme_* tables not applied yet. Showing V5 code defaults. Apply local migration 20261025130000.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: version } = await supabase
      .from("theme_versions")
      .select("id, label, status, sections, theme_settings, created_at")
      .eq("template_id", template.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: publishedList } = await supabase
      .from("theme_versions")
      .select("id, label, status, published_at, created_at")
      .eq("template_id", template.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    const { data: publication } = await supabase
      .from("theme_publications")
      .select("published_version_id, updated_at")
      .eq("template_key", "homepage")
      .maybeSingle();

    const sections = (version?.sections as SectionInstance[] | undefined) || V5_HOMEPAGE_SECTIONS;

    return NextResponse.json(
      {
        source: "database",
        migrationRequired: false,
        versionId: version?.id ?? null,
        label: version?.label ?? null,
        sections,
        themeSettings: version?.theme_settings ?? {},
        livePublishedVersionId: publication?.published_version_id ?? null,
        publishedVersions: publishedList || [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Save draft only — never publishes to the storefront. */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "editor"]);
    const body = await request.json().catch(() => null);
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const { data: template, error: tErr } = await supabase
      .from("theme_templates")
      .select("id")
      .eq("key", "homepage")
      .maybeSingle();

    if (tErr || !template) {
      return NextResponse.json(
        {
          error: "migration_required",
          message: "Apply supabase migration 20261025130000 on an isolated database before saving drafts.",
        },
        { status: 409 },
      );
    }

    const { data: existing } = await supabase
      .from("theme_versions")
      .select("id")
      .eq("template_id", template.id)
      .eq("label", "working-draft")
      .maybeSingle();

    const { data: saved, error: saveErr } = await supabase.rpc("save_homepage_draft", {
      payload: {
        actor_user_id: staff.userId,
        sections: parsed.data.sections,
      },
    });
    if (saveErr) {
      const msg = saveErr.message || "save_failed";
      const status = /forbidden/i.test(msg) ? 403 : /invalid|unsafe|unsupported/i.test(msg) ? 400 : 500;
      return NextResponse.json({ error: "draft_save_failed", message: msg }, { status });
    }
    const versionId = (saved as { version_id?: string } | null)?.version_id || existing?.id || null;

    return NextResponse.json(
      {
        ok: true,
        published: false,
        versionId,
        notice:
          "Draft saved via authorized RPC. Logged-out visitors still see the last published snapshot (or V5 code defaults). Publish creates a new immutable published version.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
