#!/usr/bin/env bash
# Full release-candidate test run against the ISOLATED stack only (local Supabase on 127.0.0.1:54321, the app built
# with THEME_PUBLISHED_ENABLED=1 and started on 127.0.0.1:3001, the stand-in email provider on 127.0.0.1:4599).
# Every script it calls refuses a non-local Supabase (scripts/lib/local-only.mjs).
#
# Usage:  bash scripts/release/run-final-suite.sh [label]
# Output: docs/evidence/final-run/<suite>.log and docs/evidence/final-run/summary.json (+ HEAD, timestamps).
set -u
cd "$(dirname "$0")/../.."
set -a; . ./.env.local; set +a
case "${NEXT_PUBLIC_SUPABASE_URL:-}" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: Supabase is not local"; exit 2 ;; esac
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 TEST_BASE_URL=http://127.0.0.1:3001 FAKE_RESEND_URL=http://127.0.0.1:4599 CATALOG_MIN_COUNT=1
APP=http://127.0.0.1:3001
OUT=docs/evidence/final-run
mkdir -p "$OUT"
DB=supabase_db_Laptops_Hub_Vercel_Development
RESULTS=()

# The exit code is the verdict: a suite passes only with rc=0. A non-zero rc is never reinterpreted from the log text
# (an earlier Windows libuv exit crash — rc=127 after a printed "5/5 passed" — was fixed at its source by closing
# fetch's keep-alive sockets before exit, not by ignoring the code).
FAILED=0
run() {
  local name="$1"; shift
  local start=$(date +%s)
  "$@" > "$OUT/$name.log" 2>&1
  local rc=$?
  local secs=$(( $(date +%s) - start ))
  local last
  last=$(grep -E "passed|failed|PASS|FAIL|ok:|[0-9]+/[0-9]+|error|Error" "$OUT/$name.log" | tail -2 | tr '\n\\' ' /' | tr -d '\000-\037' | sed 's/"/'"'"'/g' | cut -c1-300)
  [ "$rc" -eq 0 ] || FAILED=$((FAILED + 1))
  echo "[$name] rc=$rc ${secs}s :: $last"
  RESULTS+=("{\"suite\":\"$name\",\"rc\":$rc,\"seconds\":$secs,\"summary\":\"$last\"}")
}

sql() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -At < "$1"; }

run static-lint        ./node_modules/.bin/eslint
run static-tsc         ./node_modules/.bin/tsc --noEmit
run static-audit       npm audit --omit=dev
run unit               npm run test:unit
run sql-shipping-cod   sql scripts/db-tests/shipping-cod-matrix.sql
run sql-merchandising  sql scripts/db-tests/merchandising-matrix.sql
run sql-reels-reviews  sql scripts/db-tests/reels-reviews-matrix.sql
run sql-testimonials  sql scripts/db-tests/testimonials-matrix.sql
run sec-p0-probe       node scripts/security-p0-probe.mjs
run sec-auth-matrix    node scripts/security-auth-matrix.mjs "$APP"
run sec-role-matrix    node scripts/security-role-matrix.mjs "$APP"
run sec-role-http      node scripts/security-role-http-isolated.mjs "$APP"
run sec-direct-access  node scripts/security-direct-staff-access.mjs
run theme-rls          node scripts/test-theme-rls-matrix.mjs
run theme-publish      node scripts/test-theme-publish-smoke.mjs
run cod-concurrency    node scripts/test-cod-concurrency.mjs
run cod-checkout       node scripts/test-cod-checkout-isolated.mjs "$APP"
run inventory-orders   node scripts/test-inventory-orders.mjs
run inventory-ledger   node scripts/test-inventory-ledger-sync.mjs
run settings-nav       node scripts/test-settings-navigation-persistence.mjs
run merchant-smoke     node scripts/test-merchant-catalog-smoke.mjs
run csv-commit         ./node_modules/.bin/tsx scripts/test-shopify-csv-commit-smoke.mjs
run catalog-pages      node scripts/test-catalog-pagination.mjs "$APP"
run e2e-isolated       ./node_modules/.bin/playwright test -c playwright.isolated.config.ts --grep-invert "layout:"
# The next Playwright run empties test-results/; keep any failure traces from the isolated run (git-ignored, local only).
[ -d test-results ] && { rm -rf "${TMPDIR:-/tmp}/final-run-isolated-failures"; cp -r test-results "${TMPDIR:-/tmp}/final-run-isolated-failures"; }
run e2e-legacy         ./node_modules/.bin/playwright test -c playwright.config.ts tests/e2e/theme-publish-workflow.spec.ts tests/e2e/merchant-admin-workflows.spec.ts tests/e2e/homepage-presets.spec.ts tests/e2e/v5-correctness.spec.ts
run e2e-crossbrowser   ./node_modules/.bin/playwright test -c playwright.crossbrowser.config.ts

{
  echo "{"
  echo "  \"label\": \"${1:-final}\","
  echo "  \"head\": \"$(git rev-parse HEAD)\","
  echo "  \"dirty\": $( [ -z "$(git status --porcelain)" ] && echo false || echo true ),"
  echo "  \"finished\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"supabase\": \"$NEXT_PUBLIC_SUPABASE_URL\", \"app\": \"$APP\","
  echo "  \"verdict\": \"$( [ "$FAILED" -eq 0 ] && echo PASS || echo FAIL )\", \"failedSuites\": $FAILED,"
  echo "  \"suites\": ["
  local_sep=""
  for r in "${RESULTS[@]}"; do echo "    $local_sep$r"; local_sep=","; done
  echo "  ]"
  echo "}"
} > "$OUT/summary.json"
echo "summary: $OUT/summary.json — failed suites: $FAILED"
[ "$FAILED" -eq 0 ]
