/**
 * Publish the five mandatory policy pages from content/drafts/*.html to production CMS.
 * Sets body_html, status=published, legal_approved=true.
 *
 *   # pull prod env to a throwaway file first
 *   vercel env pull .env.production.local --environment=production --yes
 *   node --env-file=.env.production.local scripts/content/publish-policies-production.mjs --confirm-production=xvmmjkrkgznnakcobmww
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "xvmmjkrkgznnakcobmww";
const LEGAL = ["shipping", "returns", "warranty", "privacy", "terms"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!(arg("confirm-production") === PRODUCTION_REF && url.includes(PRODUCTION_REF))) {
  console.error(`Refusing: pass --confirm-production=${PRODUCTION_REF} and use the production Supabase URL.`);
  process.exit(2);
}
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const now = new Date().toISOString();

for (const slug of LEGAL) {
  const file = path.join(root, "content", "drafts", `${slug}.html`);
  const body = fs.readFileSync(file, "utf8").trim();
  if (body.length < 200) {
    console.error(`${slug}: body too short`);
    process.exitCode = 1;
    continue;
  }
  const { data, error } = await sb
    .from("content_pages")
    .update({
      body_html: body,
      status: "published",
      legal_approved: true,
      legal_approved_at: now,
      updated_at: now,
    })
    .eq("slug", slug)
    .select("slug, status, legal_approved");
  if (error || !data?.length) {
    console.error(`${slug}: ${error?.message || "no row"}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${slug}: published + legal_approved (${body.length} chars)`);
}

console.log("Done. Revalidate content via next deploy or admin save if CDN caches linger.");
