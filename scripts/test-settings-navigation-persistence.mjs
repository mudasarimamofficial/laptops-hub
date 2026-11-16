/**
 * Verification test for Store Settings & Navigation persistence, validation,
 * role authorization, and fresh-read verification.
 *
 * Runs against local test server (http://127.0.0.1:3001) and isolated local Supabase.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log("Starting test-settings-navigation-persistence.mjs against", BASE_URL);

// 1. Create a test owner user and sign in to get auth cookies/token
const testEmail = `test-admin-settings-${Date.now()}@example.com`;
const testPassword = "SettingsTestPassword123!";

const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
});

if (authErr || !authUser?.user) {
  throw new Error(`Failed to create test admin user: ${authErr?.message}`);
}

const userId = authUser.user.id;

// Insert admin_memberships role = 'owner'
const { error: memErr } = await supabase.from("admin_memberships").insert({
  user_id: userId,
  role: "owner",
  is_active: true,
});

if (memErr) {
  throw new Error(`Failed to grant owner membership: ${memErr.message}`);
}

// Sign in with Supabase client to get session tokens
const { data: sessionData, error: signinErr } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword,
});

if (signinErr || !sessionData?.session) {
  throw new Error(`Sign in failed: ${signinErr?.message}`);
}

const token = sessionData.session.access_token;
const authHeaders = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

try {
  // ==========================================
  // SECTION 1: STORE SETTINGS PERSISTENCE
  // ==========================================
  console.log("Testing Store Settings API...");

  // 1.1 Initial write with businessName and supportEmail
  const res1 = await fetch(`${BASE_URL}/api/admin/store-settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      businessName: "Laptops HUB Bahawalpur Flagship",
      supportEmail: "support@laptopshub.pk",
      supportPhone: "0309 3372974",
      inventoryDefaultTracked: true,
      lowStockDefault: 3,
      seoTitleSuffix: " | Official Laptops HUB",
    }),
  });

  const json1 = await res1.json();
  console.log("res1 status:", res1.status, json1);
  assert.equal(res1.status, 200, `Settings initial write failed: ${res1.status}`);
  assert.equal(json1.ok, true);
  assert.equal(json1.persisted?.business_identity?.name, "Laptops HUB Bahawalpur Flagship");
  assert.equal(json1.persisted?.business_identity?.support_email, "support@laptopshub.pk");

  // 1.2 Partial update: update businessName only; ensure supportEmail and supportPhone are PRESERVED (not wiped)
  const res2 = await fetch(`${BASE_URL}/api/admin/store-settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      businessName: "Laptops HUB Main Showroom",
    }),
  });

  assert.equal(res2.status, 200);
  const json2 = await res2.json();
  assert.equal(json2.persisted?.business_identity?.name, "Laptops HUB Main Showroom");
  assert.equal(
    json2.persisted?.business_identity?.support_email,
    "support@laptopshub.pk",
    "Support email must be preserved on partial update",
  );
  assert.equal(
    json2.persisted?.business_identity?.support_phone,
    "0309 3372974",
    "Support phone must be preserved on partial update",
  );

  // 1.3 Verify via GET endpoint
  const resGet = await fetch(`${BASE_URL}/api/admin/store-settings`, {
    headers: authHeaders,
  });
  assert.equal(resGet.status, 200);
  const jsonGet = await resGet.json();
  assert.equal(jsonGet.ok, true);
  assert.equal(jsonGet.settings?.business_identity?.name, "Laptops HUB Main Showroom");

  // 1.4 Test Validation error: invalid email format
  const resBad = await fetch(`${BASE_URL}/api/admin/store-settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      supportEmail: "not-an-email",
    }),
  });
  assert.equal(resBad.status, 400, "Invalid email must return 400");
  const jsonBad = await resBad.json();
  assert.equal(jsonBad.error, "validation_failed");

  // 1.5 Test Anonymous access denial
  const resAnon = await fetch(`${BASE_URL}/api/admin/store-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName: "Hacked" }),
  });
  assert.equal(resAnon.status, 401, "Anonymous PUT must return 401");

  console.log("✓ Store Settings persistence & validation verified.");

  // ==========================================
  // SECTION 2: NAVIGATION PERSISTENCE & GATING
  // ==========================================
  console.log("Testing Navigation API...");

  // 2.1 Fetch current navigation
  const resNavGet = await fetch(`${BASE_URL}/api/admin/navigation`, {
    headers: authHeaders,
  });
  assert.equal(resNavGet.status, 200);
  const jsonNavGet = await resNavGet.json();
  assert.equal(jsonNavGet.ok, true);
  assert.ok(Array.isArray(jsonNavGet.navigation?.headerNav));

  // 2.2 Update navigation with custom links
  const customHeader = [
    { id: "h-dell", label: "Dell Laptops", href: "/collections/dell", type: "collection" },
    { id: "h-hp", label: "HP ProBooks", href: "/collections/hp", type: "collection" },
    { id: "h-custom", label: "Special Offers", href: "/collections/all", isNew: true, type: "custom" },
  ];

  const customFooter = [
    {
      id: "f-custom-col",
      title: "Quick Links",
      links: [
        { id: "l1", label: "All Models", href: "/collections/all", type: "collection" },
        { id: "l2", label: "Compare Laptops", href: "/compare", type: "custom" },
      ],
    },
  ];

  const resNavPut = await fetch(`${BASE_URL}/api/admin/navigation`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      headerNav: customHeader,
      footerColumns: customFooter,
    }),
  });

  assert.equal(resNavPut.status, 200, "Navigation PUT must return 200");
  const jsonNavPut = await resNavPut.json();
  assert.equal(jsonNavPut.ok, true);
  assert.equal(jsonNavPut.navigation?.headerNav?.length, 3);
  assert.equal(jsonNavPut.navigation?.headerNav[2]?.label, "Special Offers");

  // 2.3 Verify direct database read from store_settings
  const { data: dbNav } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "navigation")
    .single();

  assert.equal(dbNav?.value?.headerNav?.length, 3);
  assert.equal(dbNav?.value?.headerNav[2]?.label, "Special Offers");

  // 2.4 Test unsafe URL rejection (Admin path / javascript:)
  const resUnsafe = await fetch(`${BASE_URL}/api/admin/navigation`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      headerNav: [{ id: "bad", label: "Admin Secret", href: "/admin/secret" }],
      footerColumns: [],
    }),
  });
  assert.equal(resUnsafe.status, 400, "Unsafe admin URL must be rejected with 400");

  // 2.5 Test Restore Defaults
  const resRestore = await fetch(`${BASE_URL}/api/admin/navigation`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "restore_defaults" }),
  });
  assert.equal(resRestore.status, 200, "Restore defaults must return 200");
  const jsonRestore = await resRestore.json();
  assert.equal(jsonRestore.ok, true);
  assert.equal(jsonRestore.navigation?.headerNav[0]?.label, "Dell");

  console.log("✓ Navigation persistence, safety, and restore verified.");

  // ==========================================
  // SECTION 3: STOREFRONT PUBLIC VERIFICATION
  // ==========================================
  console.log("Verifying public storefront renders navigation cleanly...");
  const resStorefront = await fetch(`${BASE_URL}/`);
  assert.equal(resStorefront.status, 200);
  const html = await resStorefront.text();
  assert.ok(html.includes("Dell"), "Storefront must contain Dell link");
  assert.ok(html.includes("Laptops"), "Storefront must contain brand");
  console.log("✓ Storefront renders navigation successfully.");

  console.log("ALL TESTS IN test-settings-navigation-persistence.mjs PASSED!");
} finally {
  // Cleanup test user
  await supabase.from("admin_memberships").delete().eq("user_id", userId);
  await supabase.auth.admin.deleteUser(userId);
}
