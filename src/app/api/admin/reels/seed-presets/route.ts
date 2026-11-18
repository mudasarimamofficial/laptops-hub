import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { presetToDraftReel, type ReelPreset } from "@/lib/content/reels-presets";

function loadManifest() {
  const raw = readFileSync(join(process.cwd(), "data", "reels-presets-manifest.json"), "utf8");
  return JSON.parse(raw) as { sectionHeading?: string; presets?: ReelPreset[] };
}

export const dynamic = "force-dynamic";

/**
 * Idempotent seed of the six Generation Laptops HUB preset drafts.
 * Skips titles that already exist. Never publishes; never stores blocked hosts as playable media.
 */
export async function POST() {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REEL_STAFF_ROLES);
    const manifest = loadManifest();
    const presets = manifest.presets || [];
    let inserted = 0;
    let skipped = 0;

    for (const p of presets) {
      const { data: existing } = await supabase.from("reels").select("id").eq("title", p.title).limit(1).maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }
      const row = presetToDraftReel(p);
      // Draft placeholder only (not published). Storefront shows published+rights-cleared reels exclusively.
      const videoUrl = row.video_url?.trim() || "https://cdn.example.com/awaiting-owned-media.mp4";
      const { error } = await supabase.from("reels").insert({
        ...row,
        video_url: videoUrl,
        // Avoid creator_consent constraint while rights/media are pending.
        creator_name: "",
        creator_consent: false,
      });
      if (error) {
        return NextResponse.json({ error: "seed_failed", message: error.message, title: p.title }, { status: 500 });
      }
      inserted += 1;
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "reels.seed_presets",
      entity_type: "reels",
      after: { inserted, skipped, heading: manifest.sectionHeading },
    });

    return NextResponse.json(
      { ok: true, inserted, skipped, note: "Drafts only. Confirm rights and replace media before publish." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
