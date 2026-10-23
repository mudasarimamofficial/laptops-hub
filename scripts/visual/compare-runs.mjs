/**
 * Regression check between parity runs: for every scene@viewport in the new run, compare diffPct with the latest
 * earlier measurement under the same conditions and flag increases.
 *
 *   node scripts/visual/compare-runs.mjs <newResults.json> <priorDir>[,<priorDir>…] [--files=a,b] [--tol=0.05]
 */
import fs from "fs";
import path from "path";

const [newFile, priorDirs] = process.argv.slice(2);
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const tol = Number(arg("tol", "0.05"));
const only = arg("files", "");

const prior = {};
for (const dir of priorDirs.split(",")) {
  for (const f of fs.readdirSync(dir).filter((f) => /^results-.+\.json$/.test(f))) {
    if (only && !only.split(",").includes(f.replace(/^results-|\.json$/g, ""))) continue;
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [k, v] of Object.entries(r)) {
      if (v.diffPct == null) continue;
      if (!prior[k] || (v.at || "") > (prior[k].at || "")) prior[k] = { ...v, file: f };
    }
  }
}

const cur = JSON.parse(fs.readFileSync(newFile, "utf8"));
const rows = [];
let worse = 0, better = 0, same = 0, unmatched = 0, errors = 0, overflow = 0;
for (const [k, v] of Object.entries(cur)) {
  if (v.error) { errors++; rows.push(`ERROR  ${k}  ${v.error}`); continue; }
  if (v.next?.overflowX) overflow++;
  const p = prior[k];
  if (!p) { unmatched++; continue; }
  const d = +(v.diffPct - p.diffPct).toFixed(2);
  if (d > tol) { worse++; rows.push(`WORSE  ${k.padEnd(44)} ${p.diffPct}% -> ${v.diffPct}%  (prior ${p.file})`); }
  else if (d < -tol) better++;
  else same++;
}
const vals = Object.values(cur).filter((v) => v.diffPct != null).map((v) => v.diffPct);
console.log(rows.join("\n"));
console.log(`captures=${Object.keys(cur).length} compared=${same + worse + better} same=${same} worse=${worse} better=${better} unmatched=${unmatched} errors=${errors} overflowX=${overflow} max=${Math.max(...vals)}% median=${vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)]}%`);
process.exit(worse || errors ? 1 : 0);
