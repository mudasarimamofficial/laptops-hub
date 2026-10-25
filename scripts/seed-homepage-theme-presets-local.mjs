/**
 * Publish the approved seven CDN homepage presets via theme RPCs (local only).
 * Restores visitor presentation after other isolated tests that publish minimal sections.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("seed-homepage-theme-presets");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const email = `seed-theme-presets-${Date.now()}@lh-test.local`;
const password = "SeedThemePresets1!";
const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr || !created.user) throw createErr || new Error("create owner failed");
await sb.from("admin_memberships").upsert({
  user_id: created.user.id,
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
      productHandles: [
        "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
        "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
        "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
      ],
      mainImageUrl:
        "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-dell-lap.webp?v=1792934111",
      side1ImageUrl:
        "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-hp-lap.webp?v=1792934111",
      side2ImageUrl:
        "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/laptop-hub-hero-lenovo-lap.webp?v=1792934111",
    },
  },
  {
    id: "story",
    type: "v5_product_story",
    enabled: true,
    label: "Product story",
    settings: {
      productHandle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
      angleImages: {
        front:
          "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-front.webp?v=1792935242",
        left: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-left.webp?v=1792935243",
        right:
          "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-right.webp?v=1792935242",
        rear: "https://cdn.shopify.com/s/files/1/0981/4720/5393/files/dell-second_-home-sec-rear.webp?v=1792935243",
      },
    },
  },
];

const { data: draft, error: draftErr } = await sb.rpc("save_homepage_draft", {
  payload: { actor_user_id: created.user.id, sections },
});
if (draftErr) throw draftErr;
const { data: pub, error: pubErr } = await sb.rpc("publish_homepage_theme", {
  payload: { actor_user_id: created.user.id, source_version_id: draft.version_id },
});
if (pubErr) throw pubErr;

console.log("seed-homepage-theme-presets-local: ok", {
  published_version_id: pub.published_version_id,
});
process.exit(0);
