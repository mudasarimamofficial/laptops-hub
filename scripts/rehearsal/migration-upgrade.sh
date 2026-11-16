#!/usr/bin/env bash
# Migration compatibility rehearsal inside the LOCAL supabase container only (scratch databases, never `postgres`).
# Usage: bash scripts/rehearsal/migration-upgrade.sh [outdir]   (needs the local `supabase start` stack; touches scratch DBs only)
set -u
C=supabase_db_Laptops_Hub_Vercel_Development
REPO="/d/Laptops Hub Vercel Development"
OUT="${1:-docs/evidence/migrations}"; mkdir -p "$OUT"
q(){ docker exec -i $C psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
mapfile -t M < <(ls "$REPO/supabase/migrations" | sort)
base(){ # fresh scratch db with the Supabase platform schemas (auth/storage/extensions) copied from the local stack
  local db=$1
  q -d postgres -c "drop database if exists $db with (force)" -c "create database $db"
  docker exec $C sh -c "pg_dump -U postgres -d postgres --schema-only -n auth -n storage -n extensions -n graphql_public -n realtime | psql -U postgres -q -d $db" >/dev/null 2>&1
  q -d $db -c "create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists \"uuid-ossp\" with schema extensions;" >/dev/null 2>&1
}
apply(){ local db=$1; shift; for f in "$@"; do
  if ! docker exec -i $C psql -U postgres -v ON_ERROR_STOP=1 -q -d $db < "$REPO/supabase/migrations/$f" > /tmp/mig.log 2>&1; then echo "FAIL $db $f: $(grep -m2 ERROR /tmp/mig.log)"; return 1; fi
  echo "ok   $db $f"; done; }
schema(){ docker exec $C pg_dump -U postgres -d $1 --schema-only -n public --no-owner --no-privileges | grep -vE '^--|^$|^SET |^SELECT pg_catalog|^.(un)?restrict ' ; }  # \restrict tokens are random per dump
grants(){ docker exec -i $C psql -U postgres -d $1 -tA -c "select grantee||' '||table_name||' '||privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by 1" ; docker exec -i $C psql -U postgres -d $1 -tA -c "select p.proname||' '||coalesce(array_to_string(p.proacl,','),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1"; }

echo "== clean: all ${#M[@]} on an empty database"
base mig_clean; apply mig_clean "${M[@]}" || exit 1
echo "== upgrade: first 14 (production state), then the remaining $(( ${#M[@]} - 14 ))"
base mig_upgrade; apply mig_upgrade "${M[@]:0:14}" || exit 1
# production-like data at the 14-migration state
q -d mig_upgrade -c "insert into products(handle,title,status,category) values ('up-a','Upgrade A','active','Laptop'),('up-b','Upgrade B','draft','Laptop');
 insert into product_variants(product_id,title,sku,price_paisa,inventory_mode,quantity_on_hand) select id,'Default','UP-'||handle,5000000,'tracked',3 from products where handle like 'up-%';"
pre=$(docker exec -i $C psql -U postgres -d mig_upgrade -tA -c "select count(*)||'/'||(select count(*) from product_variants)||'/'||(select sum(quantity_on_hand) from product_variants) from products")
apply mig_upgrade "${M[@]:14}" || exit 1
post=$(docker exec -i $C psql -U postgres -d mig_upgrade -tA -c "select count(*)||'/'||(select count(*) from product_variants)||'/'||(select sum(quantity_on_hand) from product_variants) from products")
echo "data products/variants/stock before=$pre after=$post"
echo "== re-apply the new migration (idempotence)"
apply mig_upgrade "${M[-1]}"
schema mig_clean > "$OUT/schema_clean.sql"; schema mig_upgrade > "$OUT/schema_upgrade.sql"
grants mig_clean > "$OUT/grants_clean.txt"; grants mig_upgrade > "$OUT/grants_upgrade.txt"
if diff -q "$OUT/schema_clean.sql" "$OUT/schema_upgrade.sql" >/dev/null; then echo "schema clean == upgrade: IDENTICAL"; else echo "schema DIFF:"; diff "$OUT/schema_clean.sql" "$OUT/schema_upgrade.sql" | head -20; fi
if diff -q "$OUT/grants_clean.txt" "$OUT/grants_upgrade.txt" >/dev/null; then echo "grants clean == upgrade: IDENTICAL"; else echo "grants DIFF:"; diff "$OUT/grants_clean.txt" "$OUT/grants_upgrade.txt" | head -20; fi
schema postgres > "$OUT/schema_local.sql"
if diff -q "$OUT/schema_clean.sql" "$OUT/schema_local.sql" >/dev/null; then echo "schema clean == local stack: IDENTICAL"; else echo "schema clean vs local stack: $(diff "$OUT/schema_clean.sql" "$OUT/schema_local.sql" | grep -c '^[<>]') differing lines"; fi
sha256sum "$OUT"/schema_*.sql | sed 's#  .*/#  #'
