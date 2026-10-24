/**
 * CMS publish/withdraw consistency stress test — LOCAL Supabase + local app only (docs/ISOLATED_TESTS.md).
 *
 * For N cycles (default 100) on a policy page (`shipping`): publish + legally approve with a unique marker through the
 * real admin route, then withdraw approval. After every change, P parallel public requests must agree with the
 * database: published → 200 with this cycle's marker, metadata indexable, footer links it, sitemap lists it;
 * withdrawn → 404, marker never served, no footer link, not in the sitemap. Restores the original row.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/test-cms-publish-stress.mjs http://127.0.0.1:3001 [cycles=100] [parallel=6]
 */
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL must be a local Supabase (this test publishes and withdraws content).");
  process.exit(2);
}
const base = (process.argv[2] || "http://127.0.0.1:3001").replace(/\/$/, "");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  console.error("Refusing to run: the app URL must be local.");
  process.exit(2);
}
await assertLocalOnly("cms-publish-stress");
const CYCLES = Number(process.argv[3] || 100);
const PARALLEL = Number(process.argv[4] || 6);
const SLUG = "shipping";

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
function sessionCookie(session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (value.length <= 3180) return `${cookieName}=${value}`;
  const parts = [];
  for (let i = 0, n = 0; i < value.length; i += 3180, n++) parts.push(`${cookieName}.${n}=${value.slice(i, i + 3180)}`);
  return parts.join("; ");
}

const email = `lh-cms-stress-${Date.now()}@lh-test.local`;
const password = `T3st-${randomUUID()}`;
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce) throw ce;
await admin.from("admin_memberships").upsert({ user_id: created.user.id, role: "owner", is_active: true });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password });
if (se) throw se;
const cookie = sessionCookie(s.session);
const saved = (await admin.from("content_pages").select("title, status, body_html, legal_approved, legal_approved_by").eq("slug", SLUG).single()).data;

const patch = (body) =>
  fetch(`${base}/api/admin/content/${SLUG}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json", origin: base },
    body: JSON.stringify({ title: "Shipping & delivery", ...body }),
  });
const view = async () => {
  const [page, footer, sitemap] = await Promise.all([
    fetch(`${base}/pages/${SLUG}`).then(async (r) => ({ status: r.status, html: await r.text() })),
    fetch(`${base}/compare`).then((r) => r.text()),
    fetch(`${base}/sitemap.xml`).then((r) => r.text()),
  ]);
  return { ...page, footerLinks: footer.includes(`href="/pages/${SLUG}"`), inSitemap: sitemap.includes(`/pages/${SLUG}<`) };
};

const failures = [];
let checks = 0;
const t0 = Date.now();
try {
  for (let i = 1; i <= CYCLES; i++) {
    const marker = `stress-${i}-${randomUUID().slice(0, 8)}`;
    let r = await patch({ status: "published", bodyHtml: `<p>${marker}</p>`, legalApproved: true });
    if (r.status !== 200) failures.push(`cycle ${i}: publish → ${r.status}`);
    for (const v of await Promise.all(Array.from({ length: PARALLEL }, view))) {
      checks++;
      const ok = v.status === 200 && v.html.includes(marker) && !/noindex/.test(v.html) && v.footerLinks && v.inSitemap;
      if (!ok) failures.push(`cycle ${i} published: status=${v.status} marker=${v.html.includes(marker)} footer=${v.footerLinks} sitemap=${v.inSitemap}`);
    }
    r = await patch({ status: "pending", bodyHtml: `<p>${marker}</p>`, legalApproved: false });
    if (r.status !== 200) failures.push(`cycle ${i}: withdraw → ${r.status}`);
    for (const v of await Promise.all(Array.from({ length: PARALLEL }, view))) {
      checks++;
      // Security invariant: withdrawn text is never served, and nothing links to the page.
      const ok = v.status === 404 && !v.html.includes(marker) && !v.footerLinks && !v.inSitemap;
      if (!ok) failures.push(`cycle ${i} withdrawn: status=${v.status} LEAK=${v.html.includes(marker)} footer=${v.footerLinks} sitemap=${v.inSitemap}`);
    }
    if (failures.length > 20) break;
  }
} finally {
  if (saved) await admin.from("content_pages").update(saved).eq("slug", SLUG);
  await admin.auth.admin.deleteUser(created.user.id);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
for (const f of failures.slice(0, 20)) console.log("FAIL ", f);
console.log(`${checks - failures.length}/${checks} consistent views over ${CYCLES} publish/withdraw cycles × ${PARALLEL} parallel requests (${secs}s)`);
process.exit(failures.length ? 1 : 0);
