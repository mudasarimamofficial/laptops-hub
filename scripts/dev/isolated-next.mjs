#!/usr/bin/env node
/**
 * Run `next build` or `next start` against the LOCAL isolated Supabase only.
 *
 * Why: Next.js loads `.env.production.local` with HIGHER priority than `.env.local` for `next build` / `next start`.
 * A workstation that keeps production keys in `.env.production.local` therefore silently points a "local" production
 * build at the PRODUCTION database. Process environment variables beat every env file, so this wrapper loads
 * `.env.local` into the process environment (overriding anything inherited), refuses to continue unless the Supabase
 * URL is 127.0.0.1/localhost, and only then runs Next.
 *
 * Usage: node scripts/dev/isolated-next.mjs build|start [-- extra next args]
 *   NEXT_DIST_DIR defaults to .next-local so the normal .next build is untouched.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2];
if (mode !== "build" && mode !== "start") {
  console.error("usage: node scripts/dev/isolated-next.mjs build|start [-- next args]");
  process.exit(2);
}
const extra = process.argv.slice(3).filter((a) => a !== "--");

const envFile = path.resolve(".env.local");
if (!fs.existsSync(envFile)) {
  console.error("isolated-next: .env.local not found (it must point at the local Supabase stack).");
  process.exit(2);
}
const env = { ...process.env };
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v; // override inherited values on purpose
}
// Never let a production-only switch or the Vercel OIDC token leak into an isolated run.
delete env.VERCEL_OIDC_TOKEN;
env.NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || ".next-local";

const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;
if (!local.test(env.NEXT_PUBLIC_SUPABASE_URL || "")) {
  console.error(`isolated-next: refusing — NEXT_PUBLIC_SUPABASE_URL is not local (${env.NEXT_PUBLIC_SUPABASE_URL || "unset"}).`);
  process.exit(3);
}
for (const k of ["RESEND_API_URL"]) {
  if (env.RESEND_API_KEY && env[k] && !local.test(env[k])) {
    console.error(`isolated-next: refusing — ${k} is not local; isolated runs must not send real email.`);
    process.exit(3);
  }
}

const args = ["next", mode, ...(mode === "start" && !extra.some((a) => a === "-p") ? ["-p", "3001", "-H", "127.0.0.1"] : []), ...extra];
console.log(`isolated-next: ${args.join(" ")} (Supabase ${env.NEXT_PUBLIC_SUPABASE_URL}, dist ${env.NEXT_DIST_DIR})`);
const child = spawn("npx", args, { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
