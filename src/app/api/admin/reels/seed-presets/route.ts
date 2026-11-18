import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { presetToDraftReel, type ReelPreset } from "@/lib/content/reels-presets";
import { reelUrlProblem } from "@/lib/content/reels";

function loadManifest() {
  const raw = readFileSync(join(process.cwd(), "data", "reels-presets-manifest.json"), "utf8");
  return JSON.parse(raw) as { sectionHeading?: string; presets?: ReelPreset[] };
}

export const dynamic = "force-dynamic";

type ItemResult = {
  key: string;
  title: string;
  action: "inserted" | "skipped_existing" | "skipped_invalid";
  problems?: string[];
};

/**
 * Idempotent seed of the six Generation Laptops HUB preset drafts by stable preset_key.
 * Never overwrites merchant-edited rows. Never publishes. Never uses fake cdn.example.com URLs.
 */
export async function POST() {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REEL_STAFF_ROLES);
    const manifest = loadManifest();
    const presets = manifest.presets || [];
    const results: ItemResult[] = [];
    let inserted = 0;
    let skipped = 0;

    for (const p of presets) {
      if (!p.key) {
        results.push({ key: "", title: p.title, action: "skipped_invalid", problems: ["missing preset key"] });
        skipped += 1;
        continue;
      }

      const { data: byKey } = await supabase.from("reels").select("id").eq("preset_key", p.key).limit(1).maybeSingle();
      if (byKey) {
        results.push({ key: p.key, title: p.title, action: "skipped_existing" });
        skipped += 1;
        continue;
      }

      const problems: string[] = [];
      if (!p.videoUrl) problems.push("missing video URL");
      else {
        const vp = reelUrlProblem(p.videoUrl, "video");
        if (vp) problems.push(`video: ${vp}`);
      }
      if (p.hlsUrl) {
        const hp = reelUrlProblem(p.hlsUrl, "hls");
        if (hp) problems.push(`hls: ${hp}`);
      }
      if (p.posterUrl) {
        const pp = reelUrlProblem(p.posterUrl, "poster");
        if (pp) problems.push(`poster: ${pp}`);
      }
      if (p.avatarUrl) {
        const ap = reelUrlProblem(p.avatarUrl, "avatar");
        if (ap) problems.push(`avatar: ${ap}`);
      }
      if (problems.length) {
        results.push({ key: p.key, title: p.title, action: "skipped_invalid", problems });
        skipped += 1;
        continue;
      }

      const row = presetToDraftReel(p);
      if (!row.video_url) {
        results.push({ key: p.key, title: p.title, action: "skipped_invalid", problems: ["empty video after parse"] });
        skipped += 1;
        continue;
      }

      const { error } = await supabase.from("reels").insert(row);
      if (error) {
        return NextResponse.json(
          { error: "seed_failed", message: error.message, title: p.title, key: p.key },
          { status: 500 },
        );
      }
      inserted += 1;
      results.push({ key: p.key, title: p.title, action: "inserted" });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "reels.seed_presets",
      entity_type: "reels",
      after: { inserted, skipped, heading: manifest.sectionHeading, results },
    });

    return NextResponse.json(
      {
        ok: true,
        inserted,
        skipped,
        results,
        note: "Drafts only. External media is previewable; confirm rights and attribution before publish.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
