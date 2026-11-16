-- Isolated LOCAL-ONLY test for migration 20261118100000 (store testimonials + new homepage section types):
-- provenance rules (publish needs consent, avatar needs permission, Google needs a Google link, https-only URLs),
-- anon sees published rows and public columns only, no anon/authenticated write path, draft accepts the new section
-- types and still refuses unknown ones. One transaction, ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/testimonials-matrix.sql
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

CREATE TEMP TABLE cases (name text, sql text);
INSERT INTO cases VALUES
  ('publishing without consent is refused', $q$INSERT INTO store_testimonials (author_name, body, source, status) VALUES ('QA Person', 'A genuine sentence of feedback.', 'merchant', 'published')$q$),
  ('avatar without permission is refused', $q$INSERT INTO store_testimonials (author_name, body, source, avatar_url) VALUES ('QA Person', 'A genuine sentence of feedback.', 'merchant', 'https://cdn.example.com/a.jpg')$q$),
  ('Google source without a link is refused', $q$INSERT INTO store_testimonials (author_name, body, source) VALUES ('QA Person', 'A genuine sentence of feedback.', 'google')$q$),
  ('Google source with a non-Google link is refused', $q$INSERT INTO store_testimonials (author_name, body, source, source_url) VALUES ('QA Person', 'A genuine sentence of feedback.', 'google', 'https://example.com/maps/review')$q$),
  ('Google source with a look-alike host is refused', $q$INSERT INTO store_testimonials (author_name, body, source, source_url) VALUES ('QA Person', 'A genuine sentence of feedback.', 'google', 'https://google.com.evil.example/maps/x')$q$),
  ('javascript: source URL is refused', $q$INSERT INTO store_testimonials (author_name, body, source, source_url) VALUES ('QA Person', 'A genuine sentence of feedback.', 'merchant', 'javascript:alert(1)')$q$),
  ('http (not https) avatar is refused', $q$INSERT INTO store_testimonials (author_name, body, source, avatar_url, avatar_permission) VALUES ('QA Person', 'A genuine sentence of feedback.', 'merchant', 'http://cdn.example.com/a.jpg', true)$q$),
  ('rating 6 is refused', $q$INSERT INTO store_testimonials (author_name, body, source, rating) VALUES ('QA Person', 'A genuine sentence of feedback.', 'merchant', 6)$q$),
  ('too-short text is refused', $q$INSERT INTO store_testimonials (author_name, body, source) VALUES ('QA Person', 'short', 'merchant')$q$),
  ('unknown source is refused', $q$INSERT INTO store_testimonials (author_name, body, source) VALUES ('QA Person', 'A genuine sentence of feedback.', 'facebook')$q$);
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

INSERT INTO store_testimonials (id, author_name, rating, body, source, source_url, consent_confirmed, status, verification_note, published_at)
VALUES
  ('00000000-0000-4000-8000-0000000001a1', 'QA Published', 5, 'Helpful staff and a fair price.', 'google',
   'https://www.google.com/maps/reviews/qa', true, 'published', 'checked against the profile', now()),
  ('00000000-0000-4000-8000-0000000001a2', 'QA Draft', null, 'Not yet approved by the owner.', 'merchant', null, true, 'draft', 'internal', null),
  ('00000000-0000-4000-8000-0000000001a3', 'QA Hidden', 4, 'Outdated testimonial that was hidden.', 'website', null, true, 'hidden', '', null);
INSERT INTO results SELECT 'a valid Google testimonial with a maps link is accepted', count(*) = 1, count(*)::text
  FROM store_testimonials WHERE id = '00000000-0000-4000-8000-0000000001a1';
INSERT INTO results SELECT 'a merchant testimonial may have no rating', rating IS NULL, coalesce(rating::text, 'null')
  FROM store_testimonials WHERE id = '00000000-0000-4000-8000-0000000001a2';

SET LOCAL ROLE anon;
INSERT INTO results SELECT 'anon sees published only', count(*) = 1 AND bool_and(author_name = 'QA Published'), string_agg(author_name, ',')
  FROM store_testimonials WHERE author_name LIKE 'QA %';
DO $$ BEGIN
  PERFORM verification_note FROM store_testimonials LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read verification notes', false, 'read');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read verification notes', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM consent_confirmed, created_by FROM store_testimonials LIMIT 1;
  INSERT INTO results VALUES ('anon cannot read consent or staff ids', false, 'read');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read consent or staff ids', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO store_testimonials (author_name, body, source) VALUES ('Anon Writer', 'Trying to add a review directly.', 'website');
  INSERT INTO results VALUES ('anon cannot insert', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot insert', true, SQLERRM);
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE store_testimonials SET status = 'published' WHERE id = '00000000-0000-4000-8000-0000000001a2';
  INSERT INTO results VALUES ('authenticated (incl. staff tokens) cannot publish directly', false, 'updated');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('authenticated (incl. staff tokens) cannot publish directly', true, SQLERRM);
END $$;
RESET ROLE;

-- Homepage draft: the two new section types are accepted, unknown types still refused.
DO $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM admin_memberships WHERE role = 'owner' AND is_active LIMIT 1;
  IF v_owner IS NULL THEN
    INSERT INTO results VALUES ('draft accepts store reviews + map sections', false, 'no active owner in the local seed');
    RETURN;
  END IF;
  PERFORM public.save_homepage_draft(jsonb_build_object('actor_user_id', v_owner, 'sections', jsonb_build_array(
    jsonb_build_object('id', 'reviews', 'type', 'v5_store_reviews', 'enabled', true, 'label', 'Customer reviews', 'settings', '{}'::jsonb),
    jsonb_build_object('id', 'map', 'type', 'v5_store_map', 'enabled', true, 'label', 'Visit our store', 'settings', '{}'::jsonb))));
  INSERT INTO results VALUES ('draft accepts store reviews + map sections', true, 'saved');
  BEGIN
    PERFORM public.save_homepage_draft(jsonb_build_object('actor_user_id', v_owner, 'sections', jsonb_build_array(
      jsonb_build_object('id', 'x', 'type', 'v5_unknown', 'enabled', true, 'label', 'x', 'settings', '{}'::jsonb))));
    INSERT INTO results VALUES ('draft still refuses unknown section types', false, 'saved');
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO results VALUES ('draft still refuses unknown section types', true, SQLERRM);
  END;
END $$;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 110) FROM results ORDER BY ok, name;
SELECT 'TOTAL', count(*) FILTER (WHERE ok) || ' passed', count(*) FILTER (WHERE ok IS NOT TRUE) || ' failed' FROM results;
ROLLBACK;
