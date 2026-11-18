-- Isolated LOCAL-ONLY test for migrations 20261115100000 + 20261118190000 (reels + product_reviews):
-- publish-requires-rights, URL scheme rules (external hosts allowed), anon visibility, private review columns,
-- and no anon/authenticated write path. Runs in one transaction and ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/reels-reviews-matrix.sql
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

INSERT INTO products (id, handle, title, status) VALUES ('00000000-0000-4000-8000-0000000000c1', 'qa-review-laptop', 'QA Review Laptop', 'active');

-- Helper: expect a check violation.
CREATE TEMP TABLE cases (name text, sql text);
INSERT INTO cases VALUES
  ('publish without rights is refused', $q$INSERT INTO reels (title, video_url, status) VALUES ('x', 'https://cdn.example.com/a.mp4', 'published')$q$),
  ('plain http (non-local) video is refused', $q$INSERT INTO reels (title, video_url) VALUES ('x', 'http://cdn.example.com/a.mp4')$q$),
  ('javascript: video is refused', $q$INSERT INTO reels (title, video_url) VALUES ('x', 'javascript:alert(1)')$q$),
  ('rating 6 is refused', $q$INSERT INTO product_reviews (product_id, author_name, rating, body) VALUES ('00000000-0000-4000-8000-0000000000c1', 'Ali', 6, 'Long enough body')$q$),
  ('too-short review body is refused', $q$INSERT INTO product_reviews (product_id, author_name, rating, body) VALUES ('00000000-0000-4000-8000-0000000000c1', 'Ali', 5, 'short')$q$);

-- External hosts (including ronin.pk) must be accepted after 20261118190000.
DO $$
BEGIN
  BEGIN
    INSERT INTO reels (title, video_url, poster_url) VALUES
      ('ronin ok', 'https://ronin.pk/cdn/x.mp4', 'https://www.ronin.pk/p.jpg');
    INSERT INTO results VALUES ('external ronin.pk media is accepted', true, 'ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('external ronin.pk media is accepted', false, SQLERRM);
  END;
END $$;
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

-- Valid rows.
INSERT INTO reels (id, title, video_url, rights_status, status) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'Published owned', 'https://cdn.example.com/a.mp4', 'owned', 'published'),
  ('00000000-0000-4000-8000-0000000000d2', 'Draft', 'https://cdn.example.com/b.mp4', 'owned', 'draft'),
  ('00000000-0000-4000-8000-0000000000d3', 'Local', 'http://127.0.0.1:54321/storage/v1/object/public/reels/c.mp4', 'licensed', 'published');
INSERT INTO product_reviews (id, product_id, author_name, rating, body, status, reviewer_email, ip_hash) VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c1', 'Approved A', 5, 'Approved review body text', 'approved', 'a@example.test', 'hash'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c1', 'Pending B', 2, 'Pending review body text', 'pending', NULL, NULL),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000c1', 'Rejected C', 1, 'Rejected review body text', 'rejected', NULL, NULL);

DO $$ BEGIN
  UPDATE reels SET rights_status = 'pending' WHERE id = '00000000-0000-4000-8000-0000000000d1';
  INSERT INTO results VALUES ('revoking rights on a published reel is refused', false, 'accepted');
EXCEPTION WHEN check_violation THEN
  INSERT INTO results VALUES ('revoking rights on a published reel is refused', true, SQLERRM);
END $$;

SET LOCAL ROLE anon;
INSERT INTO results SELECT 'anon sees only published+cleared reels', count(*) = 2, count(*)::text
  FROM reels WHERE id IN ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d3');
INSERT INTO results SELECT 'anon sees only approved reviews', count(*) = 1 AND min(author_name) = 'Approved A', count(*)::text
  FROM product_reviews WHERE product_id = '00000000-0000-4000-8000-0000000000c1';
DO $$ BEGIN
  PERFORM reviewer_email FROM product_reviews LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read reviewer_email', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read reviewer_email', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM ip_hash FROM product_reviews LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read ip_hash', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read ip_hash', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO product_reviews (product_id, author_name, rating, body, status)
    VALUES ('00000000-0000-4000-8000-0000000000c1', 'Fake', 5, 'Self-approved fake review', 'approved');
  INSERT INTO results VALUES ('anon cannot insert reviews directly', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot insert reviews directly', true, SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE product_reviews SET status = 'approved' WHERE id = '00000000-0000-4000-8000-0000000000e2';
  INSERT INTO results VALUES ('anon cannot approve reviews', false, 'updated');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot approve reviews', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO reels (title, video_url) VALUES ('x', 'https://cdn.example.com/x.mp4');
  INSERT INTO results VALUES ('anon cannot insert reels', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot insert reels', true, SQLERRM);
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE reels SET status = 'published' WHERE id = '00000000-0000-4000-8000-0000000000d2';
  INSERT INTO results VALUES ('authenticated (non-staff) cannot publish reels', false, 'updated');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('authenticated (non-staff) cannot publish reels', true, SQLERRM);
END $$;
RESET ROLE;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 110) FROM results ORDER BY ok, name;
SELECT 'TOTAL', count(*) FILTER (WHERE ok) || ' passed', count(*) FILTER (WHERE ok IS NOT TRUE) || ' failed' FROM results;
ROLLBACK;
