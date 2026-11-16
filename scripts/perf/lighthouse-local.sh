#!/usr/bin/env bash
# Lab Lighthouse run against the LOCAL isolated app (127.0.0.1:3001) — home, collection, PDP × mobile/desktop.
# Usage: LIGHTHOUSE=<path to lighthouse bin> bash scripts/perf/lighthouse-local.sh <outdir>
# Not field data: simulated throttling on a developer machine. Run with the machine otherwise idle.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:-docs/evidence/lighthouse}"; mkdir -p "$OUT"
APP=http://127.0.0.1:3001
LH="${LIGHTHOUSE:-npx lighthouse}"
export CHROME_PATH="${CHROME_PATH:-$HOME/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe}"
PDP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.isolated/fixture.json')).products[0].handle)")
for page in "home /" "collection /collections/all" "pdp /products/$PDP"; do
  set -- $page
  for form in mobile desktop; do
    preset=""; [ "$form" = desktop ] && preset="--preset=desktop"
    $LH "$APP$2" $preset --quiet --output=json --output-path="$OUT/$1-$form.json" \
      --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new --no-sandbox" >/dev/null 2>&1
    echo "$1-$form rc=$?"
  done
done
node -e '
const fs=require("fs"),out=process.argv[1];const runs=[];
for(const f of fs.readdirSync(out).filter(f=>f.endsWith(".json")&&f!=="summary.json")){const r=JSON.parse(fs.readFileSync(out+"/"+f));const a=r.audits;
runs.push({page:f.replace(".json",""),lighthouse:r.lighthouseVersion,scores:Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)])),LCP_ms:Math.round(a["largest-contentful-paint"].numericValue),FCP_ms:Math.round(a["first-contentful-paint"].numericValue),TBT_ms:Math.round(a["total-blocking-time"].numericValue),CLS:+a["cumulative-layout-shift"].numericValue.toFixed(3)});}
fs.writeFileSync(out+"/summary.json",JSON.stringify({at:new Date().toISOString(),target:"local next start on 127.0.0.1:3001, local Supabase",note:"Lab metrics, simulated throttling, developer machine; not field data.",runs},null,2));
for(const r of runs)console.log(r.page,JSON.stringify(r.scores),"LCP",r.LCP_ms,"TBT",r.TBT_ms,"CLS",r.CLS);' "$OUT"
