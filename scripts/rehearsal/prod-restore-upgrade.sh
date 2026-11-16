#!/usr/bin/env bash
# Restore rehearsal of a REAL production backup, then the pending migrations on top — inside the LOCAL supabase
# container, in a scratch database (`prod_restore`). Production is never touched; the backup is only read.
#
# Usage: bash scripts/rehearsal/prod-restore-upgrade.sh <backup_dir> <first_pending_index (0-based, e.g. 14)> [outdir]
#   backup_dir holds schema.sql / data.sql from `supabase db dump --linked` (+ --data-only --use-copy).
# Output (no customer data): per-table row counts before/after, migration results, constraint validation.
set -u
C=supabase_db_Laptops_Hub_Vercel_Development
REPO="/d/Laptops Hub Vercel Development"
B="$1"; FIRST="${2:-14}"; OUT="${3:-docs/evidence/migrations}"; mkdir -p "$OUT"
DB=prod_restore
q(){ docker exec -i $C psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
mapfile -t M < <(ls "$REPO/supabase/migrations" | sort)

echo "== backup: $(sha256sum "$B/schema.sql" | cut -c1-16) schema, $(sha256sum "$B/data.sql" | cut -c1-16) data"
q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
# Platform schemas (auth/storage/extensions…) from the local stack, as on a Supabase project.
docker exec $C sh -c "pg_dump -U postgres -d postgres --schema-only -n auth -n storage -n extensions -n graphql_public -n realtime | psql -U postgres -q -d $DB" >/dev/null 2>&1
q -d $DB -c "create schema if not exists extensions; create schema if not exists vault; do \$\$ begin if not exists (select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if; end \$\$; create extension if not exists pgcrypto with schema extensions; create extension if not exists \"uuid-ossp\" with schema extensions;" >/dev/null 2>&1
docker cp "$B/schema.sql" $C:/tmp/pr_schema.sql >/dev/null
docker cp "$B/data.sql" $C:/tmp/pr_data.sql >/dev/null
if docker exec $C sh -c "psql -U postgres -v ON_ERROR_STOP=1 -q -d $DB -f /tmp/pr_schema.sql" > /tmp/pr.log 2>&1; then echo "restore schema: ok"; else echo "restore schema: FAIL $(grep -m3 ERROR /tmp/pr.log)"; exit 1; fi
# Data: platform-table column differences between the production Auth version and the local CLI are reported, not fatal;
# every public table must load.
docker exec $C sh -c "psql -U postgres -q -d $DB -c 'set session_replication_role = replica' -f /tmp/pr_data.sql" > /tmp/pr_data.log 2>&1
errs=$(grep -c ERROR /tmp/pr_data.log); pub_errs=$(grep ERROR -A2 /tmp/pr_data.log | grep -c 'public\.' )
echo "restore data: $errs error line(s) total, $pub_errs touching public tables"
grep ERROR /tmp/pr_data.log | sort | uniq -c | head -8

counts(){ docker exec -i $C psql -U postgres -d $DB -tA -F' ' <<'SQL'
select format('select %L, count(*) from public.%I', c.relname, c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname
\gexec
SQL
}
counts > "$OUT/prod_restore_counts_before.txt"
echo "public tables: $(wc -l < "$OUT/prod_restore_counts_before.txt"), rows: $(awk '{s+=$2} END{print s}' "$OUT/prod_restore_counts_before.txt"); auth.users=$(docker exec -i $C psql -U postgres -d $DB -tA -c 'select count(*) from auth.users')"
key(){ docker exec -i $C psql -U postgres -d $DB -tA -c "select (select count(*) from products)||' products / '||(select count(*) from product_variants)||' variants / stock '||coalesce((select sum(quantity_on_hand) from product_variants),0)||' / '||(select count(*) from orders)||' orders / total '||coalesce((select sum(total_due_paisa) from orders),0)||' paisa / '||(select count(*) from order_items)||' items'"; }
before=$(key); echo "key figures before: $before"

echo "== apply pending migrations ${M[$FIRST]} .. ${M[-1]}"
for f in "${M[@]:$FIRST}"; do
  if docker exec -i $C psql -U postgres -v ON_ERROR_STOP=1 -q -d $DB < "$REPO/supabase/migrations/$f" > /tmp/mig.log 2>&1; then echo "ok   $f"; else echo "FAIL $f: $(grep -m3 -E 'ERROR|DETAIL' /tmp/mig.log)"; exit 1; fi
done
after=$(key); echo "key figures after:  $after"
counts > "$OUT/prod_restore_counts_after.txt"
echo "== tables whose row count changed (new tables appear only in 'after'):"
join -a2 -e NEW -o 0,1.2,2.2 <(sort "$OUT/prod_restore_counts_before.txt") <(sort "$OUT/prod_restore_counts_after.txt") | awk '$2!=$3' || true
[ "$before" = "$after" ] && echo "key figures: UNCHANGED" || echo "key figures: CHANGED (review)"
echo "== all constraints valid on real data"
docker exec -i $C psql -U postgres -d $DB -tA -c "select count(*)||' not-validated constraints' from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname='public' and not k.convalidated"
echo "== schema after upgrade vs clean build of all migrations"
docker exec $C pg_dump -U postgres -d $DB --schema-only -n public --no-owner --no-privileges | grep -vE '^--|^$|^SET |^SELECT pg_catalog|^.(un)?restrict ' > "$OUT/schema_prod_upgrade.sql"
if [ -f "$OUT/schema_clean.sql" ]; then
  n=$(diff "$OUT/schema_clean.sql" "$OUT/schema_prod_upgrade.sql" | grep -c '^[<>]'); echo "differing lines vs schema_clean.sql: $n"
  diff "$OUT/schema_clean.sql" "$OUT/schema_prod_upgrade.sql" | head -30
fi
docker exec $C rm -f /tmp/pr_schema.sql /tmp/pr_data.sql
q -d postgres -c "drop database if exists $DB with (force)"
echo "scratch database dropped; copies of the backup removed from the container"
