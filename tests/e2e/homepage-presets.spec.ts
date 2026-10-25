import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const HERO = [
  "laptop-hub-hero-hp-lap.webp",
  "laptop-hub-hero-dell-lap.webp",
  "laptop-hub-hero-lenovo-lap.webp",
];
const STORY = [
  "dell-second_-home-sec-front.webp",
  "dell-second_-home-sec-left.webp",
  "dell-second_-home-sec-right.webp",
  "dell-second_-home-sec-rear.webp",
];

async function restoreApprovedPresetsIfLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!service || !/127\.0\.0\.1|localhost/.test(url)) return;
  const sb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `preset-restore-${Date.now()}@lh-test.local`;
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password: "PresetRestore1!",
    email_confirm: true,
  });
  if (error || !created.user) return;
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
  const { data: draft } = await sb.rpc("save_homepage_draft", {
    payload: { actor_user_id: created.user.id, sections },
  });
  if (draft?.version_id) {
    await sb.rpc("publish_homepage_theme", {
      payload: { actor_user_id: created.user.id, source_version_id: draft.version_id },
    });
  }
}

test.describe("Homepage approved image presets", () => {
  test.beforeAll(async () => {
    await restoreApprovedPresetsIfLocal();
  });

  test("hero and product story use the seven CDN defaults", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const srcs = await page.locator("img").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
    for (const part of [...HERO, ...STORY]) {
      expect(srcs.some((s) => s.includes(part)), `missing ${part}`).toBeTruthy();
    }
    // Old cutout / replaced JPG heroes must not win for default products
    expect(srcs.some((s) => s.includes("dell7420-0.png"))).toBeFalsy();
    expect(srcs.some((s) => s.includes("hp640g2-0.png"))).toBeFalsy();
    expect(srcs.some((s) => s.includes("t580-0.png"))).toBeFalsy();
  });
});
