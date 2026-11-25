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
import { draftStateFingerprint } from "@/lib/content/theme-draft-fingerprint";
import { cleanGlobalsForSave, globalsFromThemeSettings, themeGlobalsProblems } from "@/lib/content/theme-globals";
import { cleanLayoutForSave, layoutFromThemeSettings, themeLayoutProblems } from "@/lib/content/theme-layout";
import { publicationEventFromAudit, publishedHistoryOrder } from "@/lib/content/theme-history";

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
  /**
   * Site-wide copy (header, menu, footer, promotion bar) → theme_settings.globals. Omitted by older clients: the
   * stored value is then kept unchanged.
   */
  globals: z.record(z.string(), z.unknown()).optional(),
  /** Template layout controls (product page sections, …) → theme_settings.layout. Omitted by older clients. */
  layout: z.record(z.string(), z.unknown()).optional(),
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

    // History: versions in the order they were last live (a rollback does not change published_at), see theme-history.ts.
    type HistoryRow = { id: string; label: string; status: string; published_at: string | null; created_at: string };
    const { data: events } = await supabase
      .from("audit_logs")
      .select("after")
      .in("action", ["theme.homepage.publish", "theme.homepage.rollback"])
      .order("created_at", { ascending: false })
      .limit(40);
    const byId = new Map(((publishedList as HistoryRow[] | null) || []).map((v) => [v.id, v]));
    const historyIds = publishedHistoryOrder(
      publication?.published_version_id ?? null,
      (events || []).map((e) => publicationEventFromAudit(e.after)),
      [...byId.keys()],
    );
    const missing = historyIds.filter((id) => !byId.has(id));
    if (missing.length) {
      const { data: older } = await supabase
        .from("theme_versions")
        .select("id, label, status, published_at, created_at")
        .eq("template_id", template.id)
        .eq("status", "published")
        .in("id", missing);
      for (const v of (older as HistoryRow[] | null) || []) byId.set(v.id, v);
    }
    const publishedVersions = historyIds.map((id) => byId.get(id)).filter((v): v is HistoryRow => !!v);

    // Ordered layout: older drafts are read in the V5 order and gain any newer section at its V5 position.
    const sections = normalizeHomepageLayout((version?.sections as SectionInstance[] | undefined) ?? null);

    return NextResponse.json(
      {
        source: "database",
        migrationRequired: false,
        versionId: version?.id ?? null,
        label: version?.label ?? null,
        draftFingerprint: draftStateFingerprint(version?.sections ?? null, version?.theme_settings ?? null),
        sections,
        themeSettings: version?.theme_settings ?? {},
        globals: globalsFromThemeSettings(version?.theme_settings),
        layout: layoutFromThemeSettings(version?.theme_settings),
        livePublishedVersionId: publication?.published_version_id ?? null,
        ...liveState(),
        publishedVersions,
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
      ...themeGlobalsProblems(parsed.data.globals),
      ...themeLayoutProblems(parsed.data.layout),
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
      .select("id, sections, theme_settings")
      .eq("template_id", template.id)
      .eq("label", "working-draft")
      .maybeSingle();

    // Optimistic concurrency: refuse to overwrite a draft saved by someone else since this editor loaded it.
    const currentFingerprint = draftStateFingerprint(existing?.sections ?? null, existing?.theme_settings ?? null);
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

    // save_homepage_draft replaces theme_settings wholesale, so always send the full object: the stored settings,
    // with `globals` replaced only when this request carries them.
    const storedSettings =
      existing?.theme_settings && typeof existing.theme_settings === "object" && !Array.isArray(existing.theme_settings)
        ? (existing.theme_settings as Record<string, unknown>)
        : {};
    const themeSettings: Record<string, unknown> = { ...storedSettings };
    if (parsed.data.globals !== undefined) {
      const g = cleanGlobalsForSave(parsed.data.globals);
      if (Object.keys(g).length) themeSettings.globals = g;
      else delete themeSettings.globals;
    }
    if (parsed.data.layout !== undefined) {
      const l = cleanLayoutForSave(parsed.data.layout);
      if (Object.keys(l).length) themeSettings.layout = l;
      else delete themeSettings.layout;
    }

    const { data: saved, error: saveErr } = await supabase.rpc("save_homepage_draft", {
      payload: {
        actor_user_id: staff.userId,
        // Saved in the order given (validated above); marks the layout as ordered.
        sections: normalizeHomepageLayout(parsed.data.sections as SectionInstance[]),
        theme_settings: themeSettings,
      },
    });
    if (saveErr) {
      const msg = saveErr.message || "save_failed";
      const status = /forbidden/i.test(msg) ? 403 : /invalid|unsafe|unsupported/i.test(msg) ? 400 : 500;
      return NextResponse.json({ error: "draft_save_failed", message: msg }, { status });
    }
    const versionId = (saved as { version_id?: string } | null)?.version_id || existing?.id || null;
    const { data: after } = await supabase
      .from("theme_versions")
      .select("sections, theme_settings")
      .eq("id", versionId)
      .maybeSingle();

    return NextResponse.json(
      {
        ok: true,
        published: false,
        versionId,
        draftFingerprint: draftStateFingerprint(after?.sections ?? null, after?.theme_settings ?? null),
        notice: "Draft saved. Customers still see the currently published homepage until you press Publish.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
