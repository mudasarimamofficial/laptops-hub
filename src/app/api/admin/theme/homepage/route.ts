import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
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

    const sections = (version?.sections as SectionInstance[] | undefined) || V5_HOMEPAGE_SECTIONS;

    return NextResponse.json(
      {
        source: "database",
        migrationRequired: false,
        versionId: version?.id ?? null,
        label: version?.label ?? null,
        sections,
        themeSettings: version?.theme_settings ?? {},
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
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "editor"]);
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

    if (existing) {
      const { error } = await supabase
        .from("theme_versions")
        .update({ sections: parsed.data.sections, status: "draft" })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("theme_versions").insert({
        template_id: template.id,
        label: "working-draft",
        status: "draft",
        sections: parsed.data.sections,
        created_by: staff.userId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "theme.homepage.draft_save",
      entity_type: "theme_versions",
      after: { sectionCount: parsed.data.sections.length },
    });

    return NextResponse.json(
      {
        ok: true,
        published: false,
        notice: "Draft saved. Live storefront still uses approved V5 code until an owner-approved publish.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
