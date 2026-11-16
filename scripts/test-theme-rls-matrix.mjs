/**
 * Direct Supabase permission matrix for theme tables/RPCs (not via Next.js).
 * LOCAL ONLY.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("theme-rls-matrix");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const password = "ThemeRls1!pass";
const users = {};

async function makeUser(role, active = true) {
  const email = `theme-rls-${role}-${active ? "on" : "off"}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role) {
    await admin.from("admin_memberships").upsert({
      user_id: data.user.id,
      role,
      is_active: active,
    });
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { id: data.user.id, email, client, role, active };
}

const failures = [];
const ok = (label) => console.log("  ok:", label);
const fail = (label, detail) => {
  console.error("  FAIL:", label, detail || "");
  failures.push(label);
};

console.log("Seeding role users…");
users.owner = await makeUser("owner");
users.admin = await makeUser("admin");
users.manager = await makeUser("manager");
users.editor = await makeUser("editor");
users.fulfillment = await makeUser("fulfillment");
users.revoked = await makeUser("editor", false);
users.plain = await makeUser(null); // no membership
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const sampleSections = [
  {
    id: "hero",
    type: "v5_cinematic_hero",
    enabled: true,
    label: "Cinematic hero",
    settings: {
      mainImageUrl: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111",
      side1ImageUrl: "https://example.com/rls-test-hp.webp",
      side2ImageUrl: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111",
    },
  },
];

console.log("1) Anon cannot SELECT theme tables");
{
  const { data, error } = await anon.from("theme_versions").select("id").limit(1);
  if (!error && data?.length) fail("anon_select_versions");
  else ok("anon blocked from theme_versions");
}

console.log("2) Authenticated staff can SELECT, cannot INSERT into publications");
for (const role of ["owner", "admin", "editor", "manager", "fulfillment"]) {
  const { data: sel, error: selErr } = await users[role].client.from("theme_templates").select("key").limit(1);
  if (selErr) fail(`${role}_select`, selErr.message);
  else ok(`${role} SELECT templates`);

  const { error: insErr } = await users[role].client.from("theme_publications").upsert({
    template_key: "homepage",
    published_version_id: "00000000-0000-0000-0000-000000000001",
  });
  if (!insErr) fail(`${role}_direct_publication_write`);
  else ok(`${role} cannot write theme_publications`);
}

console.log("3) Editor can save draft RPC; cannot publish");
{
  const { data: draft, error } = await users.editor.client.rpc("save_homepage_draft", {
    payload: { actor_user_id: users.editor.id, sections: sampleSections },
  });
  if (error || !draft?.ok) fail("editor_draft_save", error?.message);
  else ok("editor draft save");

  const { error: pubErr } = await users.editor.client.rpc("publish_homepage_theme", {
    payload: { actor_user_id: users.editor.id, source_version_id: draft?.version_id },
  });
  if (!pubErr) fail("editor_publish_allowed");
  else ok("editor publish forbidden");
}

console.log("4) Manager/fulfillment cannot draft-save or publish");
for (const role of ["manager", "fulfillment"]) {
  const { error: dErr } = await users[role].client.rpc("save_homepage_draft", {
    payload: { actor_user_id: users[role].id, sections: sampleSections },
  });
  if (!dErr) fail(`${role}_draft_allowed`);
  else ok(`${role} draft forbidden`);
}

console.log("5) Owner publish + immutable published row");
{
  const { data: draft } = await users.owner.client.rpc("save_homepage_draft", {
    payload: { actor_user_id: users.owner.id, sections: sampleSections },
  });
  const { data: pub, error: pubErr } = await users.owner.client.rpc("publish_homepage_theme", {
    payload: { actor_user_id: users.owner.id, source_version_id: draft.version_id },
  });
  if (pubErr || !pub?.published_version_id) fail("owner_publish", pubErr?.message);
  else ok("owner publish");

  const { error: mutErr } = await users.owner.client
    .from("theme_versions")
    .update({ sections: [] })
    .eq("id", pub.published_version_id);
  if (!mutErr) fail("owner_direct_mutate_published");
  else ok("published row not directly mutable by authenticated");

  const { error: svcMutErr } = await admin
    .from("theme_versions")
    .update({ label: "tamper-service-role" })
    .eq("id", pub.published_version_id);
  if (!svcMutErr) fail("service_role_direct_mutate_published");
  else ok("published row not directly mutable by service_role without RPC flag");

  const { error: pubWriteErr } = await admin.from("theme_publications").upsert({
    template_key: "homepage",
    published_version_id: pub.published_version_id,
  });
  if (!pubWriteErr) fail("service_role_direct_publication_write");
  else ok("theme_publications blocked without publish/rollback flag");

  const { data: pubRead, error: readErr } = await anon.rpc("get_published_homepage_sections");
  if (readErr || !Array.isArray(pubRead)) fail("anon_public_rpc", readErr?.message);
  else if (!JSON.stringify(pubRead).includes("rls-test-hp")) fail("anon_public_payload");
  else ok("anon public RPC returns published sections only");

  // rollback by admin
  const { error: rbErr } = await users.admin.client.rpc("rollback_homepage_theme", {
    payload: { actor_user_id: users.admin.id, target_version_id: pub.published_version_id },
  });
  if (rbErr) fail("admin_rollback", rbErr.message);
  else ok("admin rollback");
}

console.log("6) Revoked staff and plain user blocked");
for (const key of ["revoked", "plain"]) {
  const { error } = await users[key].client.rpc("save_homepage_draft", {
    payload: { actor_user_id: users[key].id, sections: sampleSections },
  });
  if (!error) fail(`${key}_draft_allowed`);
  else ok(`${key} draft forbidden`);
}

console.log("7) Actor spoofing rejected (editor cannot act as owner)");
{
  const { error } = await users.editor.client.rpc("publish_homepage_theme", {
    payload: { actor_user_id: users.owner.id },
  });
  if (!error) fail("actor_spoof_publish");
  else ok("actor spoof blocked");
}

// cleanup best-effort
for (const u of Object.values(users)) {
  try {
    await admin.from("admin_memberships").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  } catch {
    /* ignore */
  }
}

if (failures.length) {
  console.error("theme-rls-matrix FAILED:", failures);
  process.exit(1);
}
console.log("theme-rls-matrix: ok");
process.exit(0);
