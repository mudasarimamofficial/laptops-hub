-- Isolated LOCAL-ONLY test for migration 20261116100000 (editorial product badges + reel creator consent):
-- editorial kinds only (no stored "top seller"), schedule window visibility for anon, no anon/authenticated write
-- path, private note column, creator name requires consent, tag format. One transaction, ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/merchandising-matrix.sql
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

CREATE TEMP TABLE results (name text, ok boolean, detail text);
GRANT ALL ON results TO anon, authenticated;

INSERT INTO products (id, handle, title, status) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'qa-badge-a', 'QA Badge A', 'active'),
  ('00000000-0000-4000-8000-0000000000f2', 'qa-badge-b', 'QA Badge B', 'active'),
  ('00000000-0000-4000-8000-0000000000f3', 'qa-badge-c', 'QA Badge C', 'active'),
  ('00000000-0000-4000-8000-0000000000f4', 'qa-badge-d', 'QA Badge D', 'active');

CREATE TEMP TABLE cases (name text, sql text);
INSERT INTO cases VALUES
  ('a stored "top_seller" badge is refused', $q$INSERT INTO product_badges (product_id, kind) VALUES ('00000000-0000-4000-8000-0000000000f4', 'top_seller')$q$),
  ('a "best_seller" badge is refused', $q$INSERT INTO product_badges (product_id, kind) VALUES ('00000000-0000-4000-8000-0000000000f4', 'best_seller')$q$),
  ('end before start is refused', $q$INSERT INTO product_badges (product_id, kind, starts_at, ends_at) VALUES ('00000000-0000-4000-8000-0000000000f4', 'featured', now(), now() - interval '1 day')$q$),
  ('creator name without consent is refused', $q$INSERT INTO reels (title, video_url, creator_name) VALUES ('x', 'https://cdn.example.com/a.mp4', 'Some Creator')$q$),
  ('script-like tag is refused', $q$INSERT INTO reels (title, video_url, tag) VALUES ('x', 'https://cdn.example.com/a.mp4', '<script>')$q$);
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM cases LOOP
    BEGIN
      EXECUTE c.sql;
      INSERT INTO results VALUES (c.name, false, 'accepted');
    EXCEPTION WHEN check_violation THEN
      INSERT INTO results VALUES (c.name, true, SQLERRM);
    END;
  END LOOP;
END $$;

INSERT INTO product_badges (product_id, kind, starts_at, ends_at, note) VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'featured', NULL, NULL, 'private note'),
  ('00000000-0000-4000-8000-0000000000f2', 'popular_pick', now() + interval '2 days', NULL, ''),
  ('00000000-0000-4000-8000-0000000000f3', 'staff_pick', NULL, now() - interval '1 hour', '');
INSERT INTO reels (id, title, video_url, rights_status, status, creator_name, creator_consent, tag) VALUES
  ('00000000-0000-4000-8000-0000000000f9', 'Consented', 'https://cdn.example.com/c.mp4', 'owned', 'published', 'Named Person', true, 'Productivity');
INSERT INTO results SELECT 'consented creator name is stored', count(*) = 1, count(*)::text FROM reels WHERE id = '00000000-0000-4000-8000-0000000000f9';

DO $$ BEGIN
  UPDATE reels SET creator_consent = false WHERE id = '00000000-0000-4000-8000-0000000000f9';
  INSERT INTO results VALUES ('withdrawing consent while named is refused', false, 'accepted');
EXCEPTION WHEN check_violation THEN
  INSERT INTO results VALUES ('withdrawing consent while named is refused', true, SQLERRM);
END $$;

SET LOCAL ROLE anon;
INSERT INTO results SELECT 'anon sees only badges inside their schedule', count(*) = 1 AND min(kind) = 'featured', count(*)::text
  FROM product_badges WHERE product_id::text LIKE '00000000-0000-4000-8000-0000000000f%';
DO $$ BEGIN
  PERFORM note FROM product_badges LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read the badge note', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read the badge note', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO product_badges (product_id, kind) VALUES ('00000000-0000-4000-8000-0000000000f4', 'featured');
  INSERT INTO results VALUES ('anon cannot add badges', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot add badges', true, SQLERRM);
END $$;
DO $$ BEGIN
  DELETE FROM product_badges WHERE product_id = '00000000-0000-4000-8000-0000000000f1';
  INSERT INTO results VALUES ('anon cannot delete badges', false, 'deleted');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot delete badges', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'anon can read reel creator + tag', count(*) = 1, count(*)::text
  FROM (SELECT creator_name, tag FROM reels WHERE id = '00000000-0000-4000-8000-0000000000f9') s;
DO $$ BEGIN
  PERFORM creator_consent FROM reels LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read creator_consent column', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read creator_consent column', true, SQLERRM);
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE product_badges SET kind = 'staff_pick' WHERE product_id = '00000000-0000-4000-8000-0000000000f1';
  INSERT INTO results VALUES ('authenticated (non-staff) cannot change badges', false, 'updated');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('authenticated (non-staff) cannot change badges', true, SQLERRM);
END $$;
RESET ROLE;

-- A deleted product takes its badge with it.
DELETE FROM products WHERE id = '00000000-0000-4000-8000-0000000000f1';
INSERT INTO results SELECT 'badge removed with its product', count(*) = 0, count(*)::text FROM product_badges WHERE product_id = '00000000-0000-4000-8000-0000000000f1';

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 110) FROM results ORDER BY ok, name;
SELECT 'TOTAL', count(*) FILTER (WHERE ok) || ' passed', count(*) FILTER (WHERE NOT ok) || ' failed' FROM results;
ROLLBACK;
