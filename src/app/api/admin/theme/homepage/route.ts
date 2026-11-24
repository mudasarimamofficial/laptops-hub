import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthorizedStaffClient,
  createAuthorizedStaffWriter,
  staffErrorResponse,
} from "@/lib/auth/staff";
import { type SectionInstance } from "@/lib/content/site-builder-schema";
import { homeSectionSettingProblems } from "@/lib/content/home-sections";
import { homepageLayoutProblems, normalizeHomepageLayout } from "@/lib/content/homepage-layout";
import { publishedThemesLive } from "@/lib/content/published-homepage";
import { draftFingerprint } from "@/lib/content/theme-draft-fingerprint";

/** What customers see right now, for the editor's explanation. */
const liveState = () => ({ publishedThemesEnabled: publishedThemesLive() });

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
  /**
   * Fingerprint of the draft this editor loaded (from GET / the previous PUT). When it no longer matches the stored
   * draft, someone else saved in between and the save is refused (409) instead of silently overwriting their work.
   * Omitted by older clients: then the save is accepted as before.
   */
  baseFingerprint: z.string().max(80).optional(),
  /** Explicit "overwrite the other person's draft" after the editor has shown the conflict. */
  overwrite: z.boolean().optional(),
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
          sections: normalizeHomepageLayout(null),
          ...liveState(),
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

    // Ordered layout: older drafts are read in the V5 order and gain any newer section at its V5 position.
    const sections = normalizeHomepageLayout((version?.sections as SectionInstance[] | undefined) ?? null);

    return NextResponse.json(
      {
        source: "database",
        migrationRequired: false,
        versionId: version?.id ?? null,
        label: version?.label ?? null,
        draftFingerprint: draftFingerprint(version?.sections ?? null),
        sections,
        themeSettings: version?.theme_settings ?? {},
        livePublishedVersionId: publication?.published_version_id ?? null,
        ...liveState(),
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
    const problems = [
      ...homepageLayoutProblems(parsed.data.sections),
      ...homeSectionSettingProblems(parsed.data.sections),
    ];
    if (problems.length) {
      return NextResponse.json({ error: "validation_failed", message: problems.join(" ") }, { status: 400 });
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
      .select("id, sections")
      .eq("template_id", template.id)
      .eq("label", "working-draft")
      .maybeSingle();

    // Optimistic concurrency: refuse to overwrite a draft saved by someone else since this editor loaded it.
    const currentFingerprint = draftFingerprint(existing?.sections ?? null);
    if (parsed.data.baseFingerprint && !parsed.data.overwrite && parsed.data.baseFingerprint !== currentFingerprint) {
      return NextResponse.json(
        {
          error: "draft_conflict",
          message:
            "Someone else saved this draft after you opened the editor. Reload to see their changes, or choose to overwrite them.",
          currentFingerprint,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: saved, error: saveErr } = await supabase.rpc("save_homepage_draft", {
      payload: {
        actor_user_id: staff.userId,
        // Saved in the order given (validated above); marks the layout as ordered.
        sections: normalizeHomepageLayout(parsed.data.sections as SectionInstance[]),
      },
    });
    if (saveErr) {
      const msg = saveErr.message || "save_failed";
      const status = /forbidden/i.test(msg) ? 403 : /invalid|unsafe|unsupported/i.test(msg) ? 400 : 500;
      return NextResponse.json({ error: "draft_save_failed", message: msg }, { status });
    }
    const versionId = (saved as { version_id?: string } | null)?.version_id || existing?.id || null;
    const { data: after } = await supabase.from("theme_versions").select("sections").eq("id", versionId).maybeSingle();

    return NextResponse.json(
      {
        ok: true,
        published: false,
        versionId,
        draftFingerprint: draftFingerprint(after?.sections ?? null),
        notice: "Draft saved. Customers still see the currently published homepage until you press Publish.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
