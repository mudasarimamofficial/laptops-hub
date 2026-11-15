#!/usr/bin/env bash
# Backup/restore rehearsal: dump the LOCAL stack's public schema (schema+data), restore it into a scratch database,
# compare per-table row counts and content checksums. Dump stays inside the container's /tmp (never in the repo).
set -u
C=supabase_db_Laptops_Hub_Vercel_Development
sums(){ docker exec -i $C psql -U postgres -d $1 -tA -F' ' <<'SQL'
select format('select %L, count(*), coalesce(md5(string_agg(t::text, ''|'' order by t::text)), ''-'') from public.%I t', c.relname, c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname
\gexec
SQL
}
docker exec $C sh -c "pg_dump -U supabase_admin -d postgres -n public -n auth -Fc -f /tmp/lh_backup.dump" || exit 1
echo "dump: $(docker exec $C sh -c 'ls -l /tmp/lh_backup.dump | awk "{print \$5}"') bytes, sha256 $(docker exec $C sh -c "sha256sum /tmp/lh_backup.dump" | cut -c1-16)"
docker exec -i $C psql -U postgres -q -d postgres -c "drop database if exists lh_restore with (force)" -c "create database lh_restore"
docker exec $C sh -c "pg_dump -U postgres -d postgres --schema-only -n storage -n extensions | psql -U postgres -q -d lh_restore" >/dev/null 2>&1
docker exec -i $C psql -U postgres -q -d lh_restore -c "drop schema if exists public cascade" -c "drop schema if exists auth cascade" >/dev/null
docker exec $C sh -c "pg_restore -U supabase_admin -d lh_restore --exit-on-error /tmp/lh_backup.dump" && echo "restore: ok"
sums postgres > /tmp/src.txt; sums lh_restore > /tmp/dst.txt
obj(){ docker exec -i $C psql -U postgres -d $1 -tA -c "select (select count(*) from pg_policies where schemaname='public')||' policies, '||(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)||' triggers, '||(select count(*) from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname='public')||' constraints, '||(select count(*) from pg_indexes where schemaname='public')||' indexes, auth.users='||(select count(*) from auth.users)"; }
echo "objects source:   $(obj postgres)"; echo "objects restored: $(obj lh_restore)"
echo "tables: $(wc -l < /tmp/src.txt), rows: $(awk '{s+=$2} END{print s}' /tmp/src.txt) source / $(awk '{s+=$2} END{print s}' /tmp/dst.txt) restored"
if diff /tmp/src.txt /tmp/dst.txt >/dev/null; then echo "per-table counts + md5: IDENTICAL"; else diff /tmp/src.txt /tmp/dst.txt; fi
mkdir -p "${1:-docs/evidence/migrations}"; cp /tmp/src.txt "${1:-docs/evidence/migrations}/restore_table_checksums.txt"
docker exec $C rm -f /tmp/lh_backup.dump
for d in lh_restore mig_clean mig_upgrade; do docker exec -i $C psql -U postgres -q -d postgres -c "drop database if exists $d with (force)"; done
echo "scratch databases dropped; dump removed"
