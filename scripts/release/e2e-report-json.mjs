// Builds docs/LAPTOPS_HUB_E2E_TEST_REPORT.json from Playwright's JSON reporter output (no hand-written numbers).
// Usage: node scripts/release/e2e-report-json.mjs <isolated-journeys.json> <label> [out]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [src, label, out = "docs/LAPTOPS_HUB_E2E_TEST_REPORT.json"] = process.argv.slice(2);
if (!src || !label) {
  console.error("usage: e2e-report-json.mjs <playwright-json> <label> [out]");
  process.exit(2);
}
const pw = JSON.parse(fs.readFileSync(src, "utf8"));
const tests = [];
const walk = (suite, file) => {
  const f = suite.file || file;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const last = t.results?.[t.results.length - 1];
      tests.push({
        file: f,
        title: spec.title,
        project: t.projectName || "",
        status: last?.status ?? "skipped",
        durationMs: last?.duration ?? 0,
        retries: Math.max(0, (t.results?.length ?? 1) - 1),
      });
    }
  }
  for (const s of suite.suites || []) walk(s, f);
};
for (const s of pw.suites || []) walk(s, s.file);

const byFile = {};
for (const t of tests) {
  byFile[t.file] ??= { passed: 0, failed: 0, skipped: 0, total: 0 };
  byFile[t.file].total++;
  if (t.status === "passed") byFile[t.file].passed++;
  else if (t.status === "skipped") byFile[t.file].skipped++;
  else byFile[t.file].failed++;
}
const count = (s) => tests.filter((t) => t.status === s).length;
const report = {
  date: new Date().toISOString().slice(0, 10),
  label,
  head: execSync("git rev-parse --short HEAD").toString().trim(),
  stack: "isolated (local Supabase from all 28 migrations, next start :3001 built with THEME_PUBLISHED_ENABLED=1, fake-resend :4599); clean db reset + seed + build before the run",
  source: src.replace(/\\/g, "/").replace(/^.*\/(final-run-isolated-failures)\//, "$TMPDIR/$1/"),
  summary: { total: tests.length, passed: count("passed"), failed: tests.length - count("passed") - count("skipped"), skipped: count("skipped") },
  otherSuites: "see docs/evidence/final-run/summary.json (exit code per suite)",
  byFile,
  tests,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`${out}: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`);
