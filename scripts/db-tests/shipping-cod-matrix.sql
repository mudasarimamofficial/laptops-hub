-- Isolated LOCAL-ONLY test: nationwide zone quoting (PKR 360 + 50 and PKR 0 + 0), city/province normalisation,
-- unserviceable + zone-mismatch refusal, server-authoritative totals, tracked stock decrement, idempotent replay,
-- DB kill switch and anon privilege. Runs inside one transaction and ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/shipping-cod-matrix.sql
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

INSERT INTO store_settings(key, value) VALUES ('cod_checkout', '{"enabled": true}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Only this test's zone is active inside the transaction (fixture zones would otherwise also match; rolled back).
UPDATE shipping_zones SET is_active = false;
INSERT INTO shipping_zones (id, name, country, provinces, cities, flat_fee_paisa, cod_fee_paisa, is_active)
VALUES ('00000000-0000-4000-8000-000000000001', 'All Over PK', 'PK',
  ARRAY['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Islamabad Capital Territory','Gilgit-Baltistan','Azad Jammu and Kashmir'],
  '{}', 36000, 5000, true);

INSERT INTO products (id, handle, title, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'qa-laptop-a', 'QA Laptop A', 'active'),
  ('00000000-0000-4000-8000-0000000000a2', 'qa-laptop-b', 'QA Laptop B', 'active'),
  ('00000000-0000-4000-8000-0000000000a3', 'qa-draft', 'QA Draft', 'draft');
INSERT INTO product_variants (id, product_id, price_paisa, inventory_mode, quantity_on_hand) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 12345600, 'untracked', NULL),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 9999900, 'tracked', 1),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a3', 5000000, 'untracked', NULL);

CREATE TEMP TABLE pl (k text PRIMARY KEY, v jsonb) ON COMMIT DROP;
INSERT INTO pl VALUES ('base', jsonb_build_object(
  'customer_name', 'QA Buyer', 'customer_phone_e164', '+923001234567', 'customer_phone_normalized', '03001234567',
  'shipping_zone_id', '00000000-0000-4000-8000-000000000001'));

-- 1. Nationwide coverage with normalised casing/whitespace.
INSERT INTO results
SELECT 'quote ' || c.city || ' / ' || c.prov,
       (q->>'ok')::boolean AND (q#>>'{options,0,flat_fee_paisa}')::bigint = 36000 AND (q#>>'{options,0,cod_fee_paisa}')::bigint = 5000,
       q::text
FROM (VALUES ('Lahore','Punjab'),('Karachi','Sindh'),('Islamabad','Islamabad Capital Territory'),('Peshawar','Khyber Pakhtunkhwa'),
             ('Quetta','Balochistan'),('Faisalabad','punjab'),('  Multan ','PUNJAB '),('Gilgit','Gilgit-Baltistan'),
             ('Muzaffarabad','Azad Jammu and Kashmir'),('Hyderabad','Sindh'),('Abbottabad','khyber pakhtunkhwa')) c(city, prov),
LATERAL (SELECT quote_cod_shipping(jsonb_build_object('address', jsonb_build_object('city', c.city, 'province', c.prov)))) x(q);

-- 2. Unknown province is unserviceable (never a free order).
INSERT INTO results SELECT 'unserviceable province refused', (q->>'ok')::boolean = false AND q->>'error' = 'unserviceable', q::text
FROM (SELECT quote_cod_shipping('{"address":{"city":"Kabul","province":"Kabul"}}')) x(q);

-- 3. Order with 360 + 50: server-authoritative total, unpaid COD.
INSERT INTO results SELECT 'order 360+50 total = subtotal+360+50', (r->>'total_due_paisa')::bigint = 12345600 + 36000 + 5000, r::text
FROM pl, LATERAL (SELECT create_cod_order(pl.v || jsonb_build_object('idempotency_key', 'qa-key-0001',
  'address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Lahore', 'province', 'Punjab'),
  'lines', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b1', 'quantity', 1))))) x(r)
WHERE pl.k = 'base';
INSERT INTO results SELECT 'order is unpaid COD (not collected)', o.payment_status::text = 'unpaid_cod' AND o.payment_method::text = 'cod',
  o.payment_status::text || '/' || o.payment_method::text
FROM orders o WHERE o.idempotency_key = 'qa-key-0001';
INSERT INTO results SELECT 'order has item+address+event+outbox',
  (SELECT count(*) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.idempotency_key = 'qa-key-0001') = 1
  AND (SELECT count(*) FROM order_addresses a JOIN orders o ON o.id = a.order_id WHERE o.idempotency_key = 'qa-key-0001') = 1
  AND (SELECT count(*) FROM order_events e JOIN orders o ON o.id = e.order_id WHERE o.idempotency_key = 'qa-key-0001') >= 1
  AND (SELECT count(*) FROM notification_outbox n JOIN orders o ON o.id = n.order_id WHERE o.idempotency_key = 'qa-key-0001') >= 1, '';

-- 4. Idempotent replay returns the same order, creates nothing new.
INSERT INTO results SELECT 'idempotent replay (no duplicate order)',
  (r->>'duplicate')::boolean AND (SELECT count(*) FROM orders WHERE idempotency_key = 'qa-key-0001') = 1, r::text
FROM pl, LATERAL (SELECT create_cod_order(pl.v || jsonb_build_object('idempotency_key', 'qa-key-0001',
  'address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Lahore', 'province', 'Punjab'),
  'lines', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b1', 'quantity', 1))))) x(r)
WHERE pl.k = 'base';

-- 5. Merchant deliberately sets a free-shipping offer: PKR 0 + 0 honoured exactly (no stale/default substitution).
UPDATE shipping_zones SET flat_fee_paisa = 0, cod_fee_paisa = 0 WHERE id = '00000000-0000-4000-8000-000000000001';
INSERT INTO results SELECT 'quote 0+0', (q#>>'{options,0,flat_fee_paisa}')::bigint = 0 AND (q#>>'{options,0,cod_fee_paisa}')::bigint = 0, q::text
FROM (SELECT quote_cod_shipping('{"address":{"city":"Karachi","province":"Sindh"}}')) x(q);
INSERT INTO results SELECT 'order 0+0 total = subtotal', (r->>'total_due_paisa')::bigint = 9999900, r::text
FROM pl, LATERAL (SELECT create_cod_order(pl.v || jsonb_build_object('idempotency_key', 'qa-key-0002',
  'address', jsonb_build_object('line1', '2 Test Rd', 'city', 'Karachi', 'province', 'Sindh'),
  'lines', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b2', 'quantity', 1))))) x(r)
WHERE pl.k = 'base';

-- 6. Tracked one-off laptop: decremented exactly once, second order refused.
INSERT INTO results SELECT 'tracked stock decremented 1 -> 0', quantity_on_hand = 0, quantity_on_hand::text
FROM product_variants WHERE id = '00000000-0000-4000-8000-0000000000b2';

CREATE TEMP TABLE expect_fail (name text, key text, variant uuid, city text, province text, with_zone boolean, expected text) ON COMMIT DROP;
INSERT INTO expect_fail VALUES
  ('sold-out tracked variant refused', 'qa-key-0003', '00000000-0000-4000-8000-0000000000b2', 'Karachi', 'Sindh', true, 'insufficient_stock'),
  ('draft product refused', 'qa-key-0004', '00000000-0000-4000-8000-0000000000b3', 'Lahore', 'Punjab', true, 'product_not_purchasable'),
  ('zone mismatch refused', 'qa-key-0005', '00000000-0000-4000-8000-0000000000b1', 'Kabul', 'Kabul', true, 'zone_mismatch'),
  ('missing zone refused (never free by default)', 'qa-key-0006', '00000000-0000-4000-8000-0000000000b1', 'Lahore', 'Punjab', false, 'shipping_required');

DO $$
DECLARE f record; base jsonb;
BEGIN
  SELECT v INTO base FROM pl WHERE k = 'base';
  FOR f IN SELECT * FROM expect_fail LOOP
    BEGIN
      PERFORM create_cod_order(
        (CASE WHEN f.with_zone THEN base ELSE base - 'shipping_zone_id' END) || jsonb_build_object('idempotency_key', f.key,
        'address', jsonb_build_object('line1', 'x', 'city', f.city, 'province', f.province),
        'lines', jsonb_build_array(jsonb_build_object('variant_id', f.variant, 'quantity', 1))));
      INSERT INTO results VALUES (f.name, false, 'order was created');
    EXCEPTION WHEN others THEN
      INSERT INTO results VALUES (f.name, SQLERRM = f.expected, SQLERRM);
    END;
  END LOOP;
END $$;

-- 7. DB switch off blocks orders even if the API layer were bypassed.
UPDATE store_settings SET value = '{"enabled": false}' WHERE key = 'cod_checkout';
DO $$
DECLARE base jsonb;
BEGIN
  SELECT v INTO base FROM pl WHERE k = 'base';
  PERFORM create_cod_order(base || jsonb_build_object('idempotency_key', 'qa-key-0007',
    'address', jsonb_build_object('line1', 'x', 'city', 'Lahore', 'province', 'Punjab'),
    'lines', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b1', 'quantity', 1))));
  INSERT INTO results VALUES ('db switch off refuses', false, 'order was created');
EXCEPTION WHEN others THEN
  INSERT INTO results VALUES ('db switch off refuses', SQLERRM = 'checkout_disabled', SQLERRM);
END $$;

-- 8. Anonymous and authenticated roles cannot call create_cod_order directly (only the server API can).
GRANT INSERT ON results TO anon, authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM public.create_cod_order('{}'::jsonb);
  INSERT INTO results VALUES ('anon cannot execute create_cod_order', false, 'executed');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot execute create_cod_order', true, SQLERRM);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.create_cod_order('{}'::jsonb);
  INSERT INTO results VALUES ('authenticated cannot execute create_cod_order', false, 'executed');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('authenticated cannot execute create_cod_order', true, SQLERRM);
END $$;
RESET ROLE;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 120) FROM results ORDER BY ok, name;
SELECT 'TOTAL', count(*) FILTER (WHERE ok) || ' passed', count(*) FILTER (WHERE NOT ok) || ' failed' FROM results;
ROLLBACK;
