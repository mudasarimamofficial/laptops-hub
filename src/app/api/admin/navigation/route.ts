import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse, type StaffSession } from "@/lib/auth/staff";
import {
  DEFAULT_NAVIGATION_CONFIG,
  NAVIGATION_HISTORY_KEY,
  NAVIGATION_KEY,
  NAV_LIMITS,
  getNavigationHistory,
  getPublishedNavigation,
  navigationProblems,
  type FooterNavColumn,
  type NavigationConfig,
  type NavigationHistoryEntry,
  type NavigationItem,
} from "@/lib/content/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const navItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(NAV_LIMITS.label),
  href: z.string().trim().min(1).max(NAV_LIMITS.href),
  isNew: z.boolean().optional(),
  type: z.enum(["collection", "page", "guide", "product", "custom"]).optional(),
});

const footerColSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(NAV_LIMITS.columnTitle),
  links: z.array(navItemSchema).max(NAV_LIMITS.footerLinksPerColumn),
});

const putSchema = z.object({
  headerNav: z.array(navItemSchema).max(NAV_LIMITS.headerItems),
  footerColumns: z.array(footerColSchema).max(NAV_LIMITS.footerColumns),
  /** The version the editor loaded; a save made from an older screen is refused (409) instead of overwriting. */
  expectedVersion: z.number().int().positive(),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore_defaults"), expectedVersion: z.number().int().positive().optional() }),
  z.object({ action: z.literal("restore_version"), version: z.number().int().positive(), expectedVersion: z.number().int().positive() }),
]);

function historySummary(h: NavigationHistoryEntry) {
  return {
    version: h.version,
    savedAt: h.savedAt,
    savedBy: h.savedBy,
    action: h.action,
    restoredFrom: h.restoredFrom ?? null,
    headerLabels: h.headerNav.map((i) => i.label),
    footerTitles: h.footerColumns.map((c) => c.title),
    footerLinkCount: h.footerColumns.reduce((n, c) => n + c.links.length, 0),
  };
}

/**
 * Writes a new navigation version only if nobody else saved since the editor loaded `expectedVersion`
 * (compare-and-swap on the row's updated_at), then records it in the version history.
 */
async function publishNavigation(
  supabase: SupabaseClient,
  staff: StaffSession,
  input: { headerNav: NavigationItem[]; footerColumns: FooterNavColumn[] },
  expectedVersion: number | undefined,
  action: NavigationHistoryEntry["action"],
  restoredFrom?: number,
) {
  const problems = navigationProblems(input.headerNav, input.footerColumns);
  if (problems.length) {
    return NextResponse.json(
      { error: "validation_failed", message: `${problems[0].where}: ${problems[0].message}`, problems },
      { status: 400, headers: NO_STORE },
    );
  }

  const { data: row, error: readErr } = await supabase
    .from("store_settings")
    .select("value, updated_at")
    .eq("key", NAVIGATION_KEY)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: "read_failed", message: "Navigation could not be loaded. Nothing was changed." }, { status: 500, headers: NO_STORE });
  }
  const current = await getPublishedNavigation(supabase);
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    return NextResponse.json(
      {
        error: "stale_version",
        message: `Someone published navigation version ${current.version} after you opened this screen. Nothing was changed — reload to see their version, then make your change again.`,
        currentVersion: current.version,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const value: NavigationConfig = { headerNav: input.headerNav, footerColumns: input.footerColumns, version: nextVersion, updatedAt: now };

  let written = false;
  if (row) {
    const { data: upd, error } = await supabase
      .from("store_settings")
      .update({ value, updated_at: now, updated_by: staff.userId })
      .eq("key", NAVIGATION_KEY)
      .eq("updated_at", row.updated_at)
      .select("key");
    if (error) return NextResponse.json({ error: "persistence_failed", message: "Navigation could not be saved. Nothing was changed." }, { status: 500, headers: NO_STORE });
    written = (upd ?? []).length === 1;
  } else {
    const { error } = await supabase.from("store_settings").insert({ key: NAVIGATION_KEY, value, updated_at: now, updated_by: staff.userId });
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "persistence_failed", message: "Navigation could not be saved. Nothing was changed." }, { status: 500, headers: NO_STORE });
    }
    written = !error;
  }
  if (!written) {
    return NextResponse.json(
      { error: "stale_version", message: "Someone else published navigation at the same moment. Nothing was changed — reload and try again." },
      { status: 409, headers: NO_STORE },
    );
  }

  // Version history: the first edit also keeps what customers saw before it (the V5 defaults or the earlier save).
  let history = await getNavigationHistory(supabase);
  if (history.length === 0) {
    history = [{ version: current.version, savedAt: current.updatedAt, savedBy: null, action: "before_first_edit", headerNav: current.headerNav, footerColumns: current.footerColumns }];
  }
  const entry: NavigationHistoryEntry = { version: nextVersion, savedAt: now, savedBy: staff.email, action, headerNav: input.headerNav, footerColumns: input.footerColumns };
  if (restoredFrom) entry.restoredFrom = restoredFrom;
  history = [entry, ...history.filter((h) => h.version !== nextVersion)].slice(0, NAV_LIMITS.history);
  const { error: histErr } = await supabase
    .from("store_settings")
    .upsert({ key: NAVIGATION_HISTORY_KEY, value: { entries: history }, updated_at: now, updated_by: staff.userId }, { onConflict: "key" });

  await supabase.from("audit_logs").insert({
    actor_user_id: staff.userId,
    action: action === "save" ? "navigation.update" : `navigation.${action}`,
    entity_type: "store_settings",
    entity_id: NAVIGATION_KEY,
    before: { version: current.version },
    after: {
      version: nextVersion,
      restoredFrom: restoredFrom ?? null,
      headerItemCount: input.headerNav.length,
      footerColumnCount: input.footerColumns.length,
    },
  });

  // Every storefront page renders the header and footer: refresh them all, not only the homepage.
  revalidatePath("/", "layout");
  revalidatePath("/admin/navigation");

  const verified = await getPublishedNavigation(supabase);
  return NextResponse.json(
    {
      ok: true,
      navigation: verified,
      history: history.map(historySummary),
      historyWarning: histErr ? "Published, but this version could not be added to the version history." : null,
    },
    { headers: NO_STORE },
  );
}

/** Current navigation, V5 defaults, version history and destination pickers. */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "editor", "manager"]);
    const current = await getPublishedNavigation(supabase);
    const history = await getNavigationHistory(supabase);

    const { data: collections } = await supabase.from("collections").select("slug, title").order("title");
    const { data: pagesRaw } = await supabase.from("content_pages").select("slug, title, status, legal_approved").order("title");
    const pages = (pagesRaw || []).map((p) => ({
      slug: p.slug,
      title: p.title,
      is_published: p.status === "published",
      legal_approved: !!p.legal_approved,
    }));

    return NextResponse.json(
      {
        ok: true,
        navigation: current,
        defaults: DEFAULT_NAVIGATION_CONFIG,
        history: history.map(historySummary),
        availableDestinations: { collections: collections || [], pages },
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Save and publish the header and footer menus. */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "editor"]);
    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      const missingVersion = !!body && typeof body === "object" && !("expectedVersion" in body);
      return NextResponse.json(
        {
          error: missingVersion ? "version_required" : "validation_failed",
          message: missingVersion
            ? "Reload the navigation screen and make your change again (the screen was out of date)."
            : "Some menu entries are not valid. Check names (up to 40 characters), addresses and the number of links.",
          details: parsed.error.flatten(),
        },
        { status: 400, headers: NO_STORE },
      );
    }
    const { expectedVersion, ...input } = parsed.data;
    return await publishNavigation(supabase, staff, input, expectedVersion, "save");
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * `restore_version` (owner/admin/editor): publish an earlier version again as a new version.
 * `restore_defaults` (owner/admin only): publish the approved V5 menus as a new version.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid_action" }, { status: 400, headers: NO_STORE });

    if (parsed.data.action === "restore_defaults") {
      const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin"]);
      return await publishNavigation(
        supabase,
        staff,
        { headerNav: DEFAULT_NAVIGATION_CONFIG.headerNav, footerColumns: DEFAULT_NAVIGATION_CONFIG.footerColumns },
        parsed.data.expectedVersion,
        "restore_defaults",
      );
    }

    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "editor"]);
    const wanted = parsed.data.version;
    const entry = (await getNavigationHistory(supabase)).find((h) => h.version === wanted);
    if (!entry) {
      return NextResponse.json(
        { error: "version_not_found", message: `Version ${wanted} is no longer in the history (only the last ${NAV_LIMITS.history} are kept).` },
        { status: 404, headers: NO_STORE },
      );
    }
    return await publishNavigation(
      supabase,
      staff,
      { headerNav: entry.headerNav, footerColumns: entry.footerColumns },
      parsed.data.expectedVersion,
      "restore_version",
      wanted,
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
