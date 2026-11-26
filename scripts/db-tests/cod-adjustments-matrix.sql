-- Isolated LOCAL-ONLY test for G22 (20261126140000_cod_collection_adjustments.sql): closed orders refuse collection,
-- reversals/corrections with roles, reasons, idempotency, bounds, payment status, append-only history, grants and
-- order totals left untouched. Runs inside one transaction and ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/cod-adjustments-matrix.sql
-- Never run against production (the guard below refuses non-private server addresses).
\set ON_ERROR_STOP 1
BEGIN;
DO $$
BEGIN
  IF inet_server_addr() IS NOT NULL
     AND host(inet_server_addr()) NOT IN ('127.0.0.1', '::1')
     AND host(inet_server_addr()) !~ '^(172\.|10\.|192\.168\.)' THEN
    RAISE EXCEPTION 'refusing: not a local database';
  END IF;
END $$;

CREATE TEMP TABLE results (name text, ok boolean, detail text) ON COMMIT DROP;
CREATE TEMP TABLE ids (k text PRIMARY KEY, v text) ON COMMIT DROP;

-- Staff: one auth user per role, created inside the transaction.
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
SELECT ('00000000-0000-4000-8000-0000000022' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'qa-g22-' || r || '@lh-test.local', now(), now()
FROM (VALUES (1, 'owner'), (2, 'manager'), (3, 'fulfillment'), (4, 'editor')) s(n, r);
INSERT INTO admin_memberships (user_id, role, is_active)
SELECT ('00000000-0000-4000-8000-0000000022' || lpad(n::text, 2, '0'))::uuid, r::staff_role, true
FROM (VALUES (1, 'owner'), (2, 'manager'), (3, 'fulfillment'), (4, 'editor')) s(n, r);

INSERT INTO orders (id, order_number, status, customer_name, customer_phone_e164, customer_phone_normalized,
                    subtotal_paisa, shipping_paisa, cod_fee_paisa, discount_paisa, total_due_paisa, idempotency_key)
VALUES
  ('00000000-0000-4000-8000-0000000022a1', 'LH-QA-G22-OPEN', 'delivered', 'QA', '+923000000000', '03000000000', 95000, 3600, 500, 0, 99100, 'qa-g22-o1'),
  ('00000000-0000-4000-8000-0000000022a2', 'LH-QA-G22-CANC', 'cancelled', 'QA', '+923000000000', '03000000000', 10000, 0, 0, 0, 10000, 'qa-g22-o2'),
  ('00000000-0000-4000-8000-0000000022a3', 'LH-QA-G22-RETN', 'returned', 'QA', '+923000000000', '03000000000', 10000, 0, 0, 0, 10000, 'qa-g22-o3'),
  -- 5% discount order: totals must stay exactly as checkout wrote them.
  ('00000000-0000-4000-8000-0000000022a4', 'LH-QA-G22-DISC', 'out_for_delivery', 'QA', '+923000000000', '03000000000', 200000, 3600, 500, 10000, 194100, 'qa-g22-o4');

CREATE OR REPLACE FUNCTION pg_temp.try(sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  EXECUTE sql INTO r;
  RETURN r::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.collect(actor int, ord text, amt bigint, k text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(format('select record_cod_collection(%L::jsonb)', jsonb_build_object(
    'actor_user_id', '00000000-0000-4000-8000-0000000022' || lpad(actor::text, 2, '0'),
    'order_number', ord, 'amount_paisa', amt, 'idempotency_key', k)));
$$;

CREATE OR REPLACE FUNCTION pg_temp.adjust(actor int, ord text, kind text, k text, reason text, col uuid, delta bigint) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(format('select adjust_cod_collection(%L::jsonb)', jsonb_strip_nulls(jsonb_build_object(
    'actor_user_id', '00000000-0000-4000-8000-0000000022' || lpad(actor::text, 2, '0'),
    'order_number', ord, 'kind', kind, 'idempotency_key', k, 'reason', reason,
    'collection_id', col, 'delta_paisa', delta))));
$$;

CREATE OR REPLACE FUNCTION pg_temp.ord(n text) RETURNS orders LANGUAGE sql AS $$ SELECT * FROM orders WHERE order_number = n $$;

-- 1. Closed orders refuse new collections.
INSERT INTO results SELECT 'collect on cancelled refused', r LIKE 'ERR:order_closed%', r FROM pg_temp.collect(3, 'LH-QA-G22-CANC', 10000, 'qa-g22-c-canc') r;
INSERT INTO results SELECT 'collect on returned refused', r LIKE 'ERR:order_closed%', r FROM pg_temp.collect(3, 'LH-QA-G22-RETN', 10000, 'qa-g22-c-retn') r;
INSERT INTO results SELECT 'closed orders unchanged', (SELECT count(*) FROM cod_collections c JOIN orders o ON o.id = c.order_id WHERE o.order_number IN ('LH-QA-G22-CANC','LH-QA-G22-RETN')) = 0, '';

-- 2. Collections (fulfillment may record them).
INSERT INTO results SELECT 'collect 60000 partial', r::jsonb->>'payment_status' = 'partially_collected', r FROM pg_temp.collect(3, 'LH-QA-G22-OPEN', 60000, 'qa-g22-c1') r;
INSERT INTO results SELECT 'collect 39100 collected', r::jsonb->>'payment_status' = 'collected', r FROM pg_temp.collect(3, 'LH-QA-G22-OPEN', 39100, 'qa-g22-c2') r;
INSERT INTO ids SELECT 'c1', id::text FROM cod_collections WHERE idempotency_key = 'qa-g22-c1';
INSERT INTO ids SELECT 'c2', id::text FROM cod_collections WHERE idempotency_key = 'qa-g22-c2';
INSERT INTO results SELECT 'editor cannot collect', r LIKE 'ERR:forbidden%', r FROM pg_temp.collect(4, 'LH-QA-G22-DISC', 100, 'qa-g22-c-ed') r;

-- 3. Roles for adjustments.
INSERT INTO results SELECT 'fulfillment cannot adjust', r LIKE 'ERR:forbidden%', r
FROM pg_temp.adjust(3, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a-ful', 'Courier kept the cash', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;
INSERT INTO results SELECT 'editor cannot adjust', r LIKE 'ERR:forbidden%', r
FROM pg_temp.adjust(4, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a-ed', 'Courier kept the cash', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;

-- 4. Validation.
INSERT INTO results SELECT 'reason required', r LIKE 'ERR:reason_required%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a-short', 'no', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;
INSERT INTO results SELECT 'idempotency key required', r LIKE 'ERR:idempotency_required%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'correction', '', 'Counted twice', NULL, -100) r;
INSERT INTO results SELECT 'reversal needs a collection', r LIKE 'ERR:validation_failed%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a-nocol', 'Courier kept the cash', NULL, NULL) r;
INSERT INTO results SELECT 'correction of zero refused', r LIKE 'ERR:validation_failed%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'correction', 'qa-g22-a-zero', 'Counted twice', NULL, 0) r;
INSERT INTO results SELECT 'reversal of another order''s collection refused', r LIKE 'ERR:not_found%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-DISC', 'reversal', 'qa-g22-a-other', 'Courier kept the cash', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;

-- 5. Reversal by a manager, then replay and conflict.
INSERT INTO results SELECT 'manager reverses 39100', (r::jsonb->>'delta_paisa')::bigint = -39100 AND r::jsonb->>'payment_status' = 'partially_collected'
  AND (r::jsonb->>'amount_collected_paisa')::bigint = 60000, r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a1', 'Courier returned the cash to the customer', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;
INSERT INTO results SELECT 'replay same key', (r::jsonb->>'idempotent_replay')::boolean AND (SELECT count(*) FROM cod_collection_adjustments WHERE idempotency_key = 'qa-g22-a1') = 1, r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a1', 'Courier returned the cash to the customer', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;
INSERT INTO results SELECT 'same key other collection conflicts', r LIKE 'ERR:idempotency_conflict%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a1', 'Courier returned the cash to the customer', (SELECT v::uuid FROM ids WHERE k = 'c1'), NULL) r;
INSERT INTO results SELECT 'same key other order conflicts', r LIKE 'ERR:idempotency_conflict%', r
FROM pg_temp.adjust(2, 'LH-QA-G22-DISC', 'correction', 'qa-g22-a1', 'Courier returned the cash', NULL, 100) r;
INSERT INTO results SELECT 'double reversal refused', r LIKE 'ERR:already_reversed%', r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a2', 'Reversing again by mistake', (SELECT v::uuid FROM ids WHERE k = 'c2'), NULL) r;

-- 6. Corrections within bounds.
INSERT INTO results SELECT 'correction over total refused', r LIKE 'ERR:over_collection%', r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'correction', 'qa-g22-a3', 'Cash counted short', NULL, 50000) r;
INSERT INTO results SELECT 'correction below zero refused', r LIKE 'ERR:below_zero%', r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'correction', 'qa-g22-a4', 'Recorded on the wrong order', NULL, -70000) r;
INSERT INTO results SELECT 'owner corrects -10000', (r::jsonb->>'amount_collected_paisa')::bigint = 50000, r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'correction', 'qa-g22-a5', 'Rider kept PKR 100 as change', NULL, -10000) r;
INSERT INTO results SELECT 'reversal that would go below zero refused', r LIKE 'ERR:below_zero%', r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'reversal', 'qa-g22-a6', 'Whole first payment returned', (SELECT v::uuid FROM ids WHERE k = 'c1'), NULL) r;
INSERT INTO results SELECT 'back to zero = refunded_or_adjusted', r::jsonb->>'payment_status' = 'refunded_or_adjusted' AND (r::jsonb->>'amount_collected_paisa')::bigint = 0, r
FROM pg_temp.adjust(1, 'LH-QA-G22-OPEN', 'correction', 'qa-g22-a7', 'Customer refunded after return', NULL, -50000) r;

-- 7. Ledger consistency, events, audit and untouched totals.
INSERT INTO results SELECT 'ledger sums to amount collected',
  (SELECT coalesce(sum(amount_paisa), 0) FROM cod_collections WHERE order_id = '00000000-0000-4000-8000-0000000022a1')
  + (SELECT coalesce(sum(delta_paisa), 0) FROM cod_collection_adjustments WHERE order_id = '00000000-0000-4000-8000-0000000022a1')
  = (pg_temp.ord('LH-QA-G22-OPEN')).amount_collected_paisa, '';
INSERT INTO results SELECT 'each adjustment has staff, time, reason',
  (SELECT bool_and(recorded_by IS NOT NULL AND created_at IS NOT NULL AND char_length(reason) >= 5) FROM cod_collection_adjustments
   WHERE order_id = '00000000-0000-4000-8000-0000000022a1')
  AND (SELECT count(*) FROM cod_collection_adjustments WHERE order_id = '00000000-0000-4000-8000-0000000022a1') = 3, '';
INSERT INTO results SELECT 'order events written', (SELECT count(*) FROM order_events WHERE order_id = '00000000-0000-4000-8000-0000000022a1' AND event_type = 'cod_adjusted') = 3, '';
INSERT INTO results SELECT 'audit written with before/after', (SELECT count(*) FROM audit_logs WHERE entity_id = '00000000-0000-4000-8000-0000000022a1' AND action = 'cod.adjust' AND before ? 'amount_collected_paisa' AND after ? 'reason') = 3, '';
INSERT INTO results SELECT 'order totals untouched',
  (o).subtotal_paisa = 95000 AND (o).shipping_paisa = 3600 AND (o).cod_fee_paisa = 500 AND (o).discount_paisa = 0 AND (o).total_due_paisa = 99100, ''
FROM (SELECT pg_temp.ord('LH-QA-G22-OPEN') o) x;

-- 8. Discounted order: collect the exact discounted total, correct, totals unchanged.
INSERT INTO results SELECT 'discounted order collects its total', r::jsonb->>'payment_status' = 'collected', r FROM pg_temp.collect(3, 'LH-QA-G22-DISC', 194100, 'qa-g22-c3') r;
INSERT INTO results SELECT 'discounted order correction', (r::jsonb->>'amount_collected_paisa')::bigint = 193100, r
FROM pg_temp.adjust(2, 'LH-QA-G22-DISC', 'correction', 'qa-g22-a8', 'PKR 10 short in the cash count', NULL, -1000) r;
INSERT INTO results SELECT 'discount and total unchanged', (o).discount_paisa = 10000 AND (o).total_due_paisa = 194100 AND (o).subtotal_paisa = 200000, ''
FROM (SELECT pg_temp.ord('LH-QA-G22-DISC') o) x;

-- 9. Append-only history.
INSERT INTO results SELECT 'collection cannot be edited', pg_temp.try($q$update cod_collections set amount_paisa = 1 where idempotency_key = 'qa-g22-c1' returning '{}'::jsonb$q$) LIKE 'ERR:ledger_append_only%', '';
INSERT INTO results SELECT 'collection cannot be deleted', pg_temp.try($q$delete from cod_collections where idempotency_key = 'qa-g22-c1' returning '{}'::jsonb$q$) LIKE 'ERR:ledger_append_only%', '';
INSERT INTO results SELECT 'adjustment cannot be edited', pg_temp.try($q$update cod_collection_adjustments set reason = 'changed later' where idempotency_key = 'qa-g22-a1' returning '{}'::jsonb$q$) LIKE 'ERR:ledger_append_only%', '';
INSERT INTO results SELECT 'adjustment cannot be deleted', pg_temp.try($q$delete from cod_collection_adjustments where idempotency_key = 'qa-g22-a1' returning '{}'::jsonb$q$) LIKE 'ERR:ledger_append_only%', '';

-- 10. Grants and the server-only guard.
INSERT INTO results SELECT 'anon cannot execute adjust', NOT has_function_privilege('anon', 'public.adjust_cod_collection(jsonb)', 'EXECUTE'), '';
INSERT INTO results SELECT 'authenticated cannot execute adjust', NOT has_function_privilege('authenticated', 'public.adjust_cod_collection(jsonb)', 'EXECUTE'), '';
INSERT INTO results SELECT 'anon/authenticated cannot read ledger',
  NOT has_table_privilege('anon', 'public.cod_collection_adjustments', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.cod_collection_adjustments', 'SELECT'), '';
INSERT INTO results SELECT 'service_role cannot update/delete/truncate ledger',
  NOT has_table_privilege('service_role', 'public.cod_collection_adjustments', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.cod_collection_adjustments', 'DELETE')
  AND NOT has_table_privilege('service_role', 'public.cod_collection_adjustments', 'TRUNCATE')
  AND NOT has_table_privilege('service_role', 'public.cod_collections', 'TRUNCATE'), '';
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
INSERT INTO results SELECT 'Data API caller refused', r LIKE 'ERR:forbidden%', r
FROM pg_temp.adjust(1, 'LH-QA-G22-DISC', 'correction', 'qa-g22-a9', 'Should never be written', NULL, -100) r;
SELECT set_config('request.jwt.claims', '', true);

-- 11. Deleting a whole order still cascades (test clean-up path).
-- (two statements: an uncorrelated count in the same SELECT would be evaluated before the delete)
INSERT INTO ids SELECT 'del', pg_temp.try($q$delete from orders where order_number = 'LH-QA-G22-OPEN' returning '{}'::jsonb$q$);
INSERT INTO results SELECT 'order delete cascades ledger', (SELECT v FROM ids WHERE k = 'del') = '{}'
  AND (SELECT count(*) FROM cod_collection_adjustments WHERE order_id = '00000000-0000-4000-8000-0000000022a1') = 0
  AND (SELECT count(*) FROM cod_collections WHERE order_id = '00000000-0000-4000-8000-0000000022a1') = 0, (SELECT v FROM ids WHERE k = 'del');

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END || ' | ' || name || CASE WHEN ok THEN '' ELSE ' | ' || left(detail, 300) END FROM results;
SELECT 'TOTAL ' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM results;
ROLLBACK;
