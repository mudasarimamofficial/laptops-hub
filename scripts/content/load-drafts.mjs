/**
 * Load prepared CMS copy from content/drafts/<slug>.html into content_pages as DRAFTS (status "draft", never
 * published, legal approval untouched). Staff review and publish in Admin → Content.
 *
 *   Local:      NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… node scripts/content/load-drafts.mjs
 *   Production: … node scripts/content/load-drafts.mjs --confirm-production=<project ref>   (owner approval only)
 *   Options:    --only=about,faq   --publish-local (local stack only: publish non-legal pages, for QA)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "xvmmjkrkgznnakcobmww";
const LEGAL = new Set(["shipping", "returns", "warranty", "privacy", "terms"]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(url) && !key.includes(PRODUCTION_REF);
if (!local && !(arg("confirm-production") === PRODUCTION_REF && url.includes(PRODUCTION_REF))) {
  console.error(`Refusing: not a local Supabase. For production pass --confirm-production=${PRODUCTION_REF} (owner approval only).`);
  process.exit(2);
}
const publishLocal = process.argv.includes("--publish-local");
if (publishLocal && !local) {
  console.error("--publish-local is for the local stack only.");
  process.exit(2);
}

const dir = path.join(root, "content", "drafts");
const only = arg("only")?.split(",");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html") && (!only || only.includes(f.replace(/\.html$/, ""))));
const sb = createClient(url, key, { auth: { persistSession: false } });
for (const f of files) {
  const slug = f.replace(/\.html$/, "");
  const body = fs.readFileSync(path.join(dir, f), "utf8").trim();
  const status = publishLocal && !LEGAL.has(slug) ? "published" : "draft";
  const { data, error } = await sb.from("content_pages").update({ body_html: body, status }).eq("slug", slug).select("slug");
  if (error || !data?.length) {
    console.error(`${slug}: ${error?.message || "no such content page"}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${slug}: ${status} (${body.length} chars)`);
}
