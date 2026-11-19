/**
 * Fail-closed: the Playwright base URL must serve public CMS from the SAME local Supabase
 * the suite writes to. A stale `.next-local` build (NEXT_PUBLIC_* baked against hosted or an
 * older local DB) returns 404 for published guides while service-role inserts succeed — that
 * was the 2026-11-19 blog E2E false failure.
 *
 * Usage: node scripts/test-fixtures/check-isolated-app.mjs
 * Or import { assertIsolatedAppAligned } from this file after assertLocalOnly.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "../lib/local-only.mjs";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function assertIsolatedAppAligned(label = "isolated app") {
  await assertLocalOnly(label);
  const slug = `iso-align-${Date.now()}`;
  const admin = createClient(SB, SR, { auth: { persistSession: false } });
  const { error: insErr } = await admin.from("articles").insert({
    slug,
    title: "Isolated app alignment probe",
    excerpt: "Probe",
    body_html: "<p>alignment-probe-body</p>",
    status: "published",
    published_at: new Date().toISOString(),
  });
  if (insErr) {
    console.error(`Refusing to run ${label}: could not insert probe article (${insErr.message}).`);
    process.exit(2);
  }
  try {
    const res = await fetch(`${BASE}/guides/${slug}`, { signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    if (res.status !== 200 || !html.includes("Isolated app alignment probe")) {
      console.error(`Refusing to run ${label}: ${BASE} did not serve the local published article.`);
      console.error(`  HTTP ${res.status}; rebuild with NEXT_DIST_DIR=.next-local and local NEXT_PUBLIC_SUPABASE_* (docs/ISOLATED_TESTS.md).`);
      console.error(`  Hint: anon can read local articles while next start still uses a stale baked URL.`);
      process.exit(2);
    }
  } finally {
    await admin.from("articles").delete().eq("slug", slug);
  }
}

const isCli = process.argv[1] && /check-isolated-app\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isCli) {
  assertIsolatedAppAligned("check-isolated-app").then(() => {
    console.log(`ok: ${BASE} serves local published guides`);
  });
}
