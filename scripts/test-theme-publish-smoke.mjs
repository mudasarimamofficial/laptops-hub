/**
 * Local-only theme publish/rollback + public RPC smoke.
 * Requires supabase start + migration 20261025140000.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("theme-publish-smoke");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

// Ensure staff actor exists
const email = `theme-smoke-${Date.now()}@example.com`;
const password = "ThemeSmoke1!pass";
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) throw createErr;
const userId = created.user.id;
await admin.from("admin_memberships").upsert({
  user_id: userId,
  role: "owner",
  is_active: true,
});

const sections = [
  {
    id: "hero",
    type: "v5_cinematic_hero",
    enabled: true,
    label: "Cinematic hero",
    settings: {
      mainImageUrl:
        "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111",
      side1ImageUrl: "https://example.com/draft-only-hp.webp",
      side2ImageUrl:
        "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111",
      productHandles: [
        "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
        "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
        "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
      ],
    },
  },
];
const { data: saved, error: saveErr } = await admin.rpc("save_homepage_draft", {
  payload: { actor_user_id: userId, sections },
});
if (saveErr || !saved?.version_id) {
  console.error("draft save failed", saveErr || saved);
  process.exit(1);
}
const sourceId = saved.version_id;

// Public must NOT see drafts via tables
const { data: leaked, error: leakErr } = await publicClient.from("theme_versions").select("id").limit(1);
if (!leakErr && leaked?.length) {
  console.error("FAIL: anon can SELECT theme_versions");
  process.exit(1);
}

const { data: beforePub } = await publicClient.rpc("get_published_homepage_sections");
if (beforePub != null) {
  console.log("note: publication already existed before smoke");
}

const { data: pubResult, error: pubErr } = await admin.rpc("publish_homepage_theme", {
  payload: { actor_user_id: userId, source_version_id: sourceId },
});
if (pubErr) {
  console.error("publish failed", pubErr);
  process.exit(1);
}
if (!pubResult?.published_version_id) {
  console.error("publish missing id", pubResult);
  process.exit(1);
}

const { data: ver } = await admin
  .from("theme_versions")
  .select("id, status")
  .eq("id", pubResult.published_version_id)
  .single();
if (ver.status !== "published") {
  console.error("FAIL: snapshot status is not published", ver);
  process.exit(1);
}

const { data: srcAfter } = await admin.from("theme_versions").select("status").eq("id", sourceId).single();
if (srcAfter.status === "published" && sourceId === pubResult.published_version_id) {
  console.error("FAIL: draft id used as publication pointer");
  process.exit(1);
}
if (sourceId === pubResult.published_version_id) {
  console.error("FAIL: published pointer equals source draft id");
  process.exit(1);
}

const { data: publicSections, error: pubReadErr } = await publicClient.rpc("get_published_homepage_sections");
if (pubReadErr) {
  console.error("public RPC failed", pubReadErr);
  process.exit(1);
}
const hero = (publicSections || []).find((s) => s.type === "v5_cinematic_hero");
if (!hero?.settings?.side1ImageUrl?.includes("draft-only-hp")) {
  console.error("FAIL: published sections missing draft override", hero?.settings);
  process.exit(1);
}

// Second publish then rollback to first
const firstId = pubResult.published_version_id;
const { data: pub2, error: pub2Err } = await admin.rpc("publish_homepage_theme", {
  payload: { actor_user_id: userId, source_version_id: sourceId },
});
if (pub2Err) throw pub2Err;

const { data: rb, error: rbErr } = await admin.rpc("rollback_homepage_theme", {
  payload: { actor_user_id: userId, target_version_id: firstId },
});
if (rbErr) throw rbErr;
if (rb.published_version_id !== firstId) {
  console.error("FAIL: rollback pointer mismatch", rb);
  process.exit(1);
}

const { data: pointer } = await admin
  .from("theme_publications")
  .select("published_version_id")
  .eq("template_key", "homepage")
  .single();
if (pointer.published_version_id !== firstId) {
  console.error("FAIL: publication pointer not rolled back");
  process.exit(1);
}

console.log("theme-publish-smoke: ok", {
  published: firstId,
  second: pub2.published_version_id,
  rolledBackTo: pointer.published_version_id,
});
process.exit(0);
