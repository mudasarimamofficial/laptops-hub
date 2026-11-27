-- Isolated LOCAL-ONLY test for G19 (20261126160000_content_page_revisions.sql): baseline revisions, save/publish/
-- unpublish/restore/rename, optimistic concurrency, legal gate in the database, slug rules and redirects, append-only
-- history, grants. Runs inside one transaction and ROLLS BACK.
-- Run: docker exec -i supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -At < scripts/db-tests/content-revisions-matrix.sql
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
CREATE TEMP TABLE keep (k text PRIMARY KEY, v text) ON COMMIT DROP;
-- Calls are stored first and checked in a separate statement: an uncorrelated subquery in the same statement would
-- be evaluated before the call.

INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
SELECT ('00000000-0000-4000-8000-0000000019' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'qa-g19-' || r || '@lh-test.local', now(), now()
FROM (VALUES (1, 'owner'), (2, 'editor'), (3, 'fulfillment')) s(n, r);
INSERT INTO admin_memberships (user_id, role, is_active)
SELECT ('00000000-0000-4000-8000-0000000019' || lpad(n::text, 2, '0'))::uuid, r::staff_role, true
FROM (VALUES (1, 'owner'), (2, 'editor'), (3, 'fulfillment')) s(n, r);

CREATE OR REPLACE FUNCTION pg_temp.try(sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  EXECUTE sql INTO r;
  RETURN r::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLERRM;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.actor(n int) RETURNS text LANGUAGE sql AS $$ SELECT '00000000-0000-4000-8000-0000000019' || lpad(n::text, 2, '0') $$;
CREATE OR REPLACE FUNCTION pg_temp.save(p jsonb) RETURNS text LANGUAGE sql AS $$ SELECT pg_temp.try(format('select save_content_page(%L::jsonb)', p)) $$;
CREATE OR REPLACE FUNCTION pg_temp.ver(s text) RETURNS int LANGUAGE sql AS $$ SELECT version FROM content_pages WHERE slug = s $$;

-- 0. Every page starts with exactly one first revision ("baseline" at migration, or "create" for pages made later),
--    so no page is without history. Baseline = current state is checked by the production post-check right after the
--    migration (later edits change the current state); legal wording is checked for warranty in section 5.
INSERT INTO results SELECT 'every page has one first revision',
  (SELECT count(*) FROM content_pages p WHERE (SELECT count(*) FROM content_page_revisions r WHERE r.page_id = p.id AND r.action IN ('baseline', 'create')) <> 1) = 0
  AND (SELECT count(*) FROM content_pages p WHERE NOT EXISTS (SELECT 1 FROM content_page_revisions r WHERE r.page_id = p.id AND r.version = 1)) = 0, '';

-- 1. Create.
INSERT INTO keep SELECT 'res1', (SELECT x FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'title', 'Laptop care'))) x);
INSERT INTO results SELECT 'create page', (SELECT v FROM keep WHERE k = 'res1')::jsonb->>'slug' = 'qa-g19-care' AND (SELECT status FROM content_pages WHERE slug = 'qa-g19-care') = 'draft', (SELECT v FROM keep WHERE k = 'res1');
INSERT INTO results SELECT 'create: taken slug', r LIKE 'ERR:slug_taken%', r
FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'title', 'Again'))) r;
INSERT INTO results SELECT 'create: legal slug locked', r LIKE 'ERR:slug_locked%' OR r LIKE 'ERR:slug_taken%', r
FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'warranty', 'title', 'Fake'))) r;
INSERT INTO results SELECT 'create: bad slug', r LIKE 'ERR:slug_invalid%', r
FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'Bad Slug!', 'title', 'Bad'))) r;
INSERT INTO results SELECT 'create: fulfillment forbidden', r LIKE 'ERR:forbidden%', r
FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(3), 'slug', 'qa-g19-ful', 'title', 'Nope'))) r;

-- 2. Save with SEO, then publish; stale version refused.
INSERT INTO results SELECT 'save v2 with SEO', (r::jsonb->>'version')::int = 2 AND r::jsonb->>'action' = 'save', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'expected_version', 1, 'title', 'Laptop care',
  'body_html', '<p>Keep vents clear.</p>', 'status', 'draft', 'seo_title', 'Laptop care tips', 'seo_description', 'How to keep a laptop cool.')) r;
INSERT INTO results SELECT 'stale version refused', r LIKE 'ERR:stale_version%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'qa-g19-care', 'expected_version', 1, 'title', 'Overwrite',
  'body_html', '<p>Old tab</p>', 'status', 'draft')) r;
INSERT INTO keep SELECT 'res2', (SELECT x FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'expected_version', 2, 'title', 'Laptop care',
  'body_html', '<p>Keep vents clear. Use a hard surface.</p>', 'status', 'published', 'seo_title', 'Laptop care tips', 'seo_description', 'How to keep a laptop cool.')) x);
INSERT INTO results SELECT 'publish v3', (SELECT v FROM keep WHERE k = 'res2')::jsonb->>'action' = 'publish' AND (SELECT published_at IS NOT NULL FROM content_pages WHERE slug = 'qa-g19-care'), (SELECT v FROM keep WHERE k = 'res2');
INSERT INTO results SELECT 'seo too long refused', r LIKE 'ERR:seo_too_long%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'expected_version', 3, 'title', 'Laptop care',
  'body_html', '<p>x</p>', 'status', 'published', 'seo_title', repeat('x', 121))) r;

-- 3. Rename → redirect; chained rename keeps redirects pointing at the current slug.
INSERT INTO keep SELECT 'res3', (SELECT x FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care', 'expected_version', 3, 'title', 'Laptop care',
  'body_html', '<p>Keep vents clear. Use a hard surface.</p>', 'status', 'published', 'new_slug', 'qa-g19-laptop-care')) x);
INSERT INTO results SELECT 'rename v4 + redirect', (SELECT v FROM keep WHERE k = 'res3')::jsonb->>'action' = 'rename'
  AND (SELECT to_slug FROM content_slug_redirects WHERE from_slug = 'qa-g19-care') = 'qa-g19-laptop-care', (SELECT v FROM keep WHERE k = 'res3');
INSERT INTO keep SELECT 'res4', (SELECT x FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-laptop-care', 'expected_version', 4, 'title', 'Laptop care',
  'body_html', '<p>Keep vents clear. Use a hard surface.</p>', 'status', 'published', 'new_slug', 'qa-g19-care-guide')) x);
INSERT INTO results SELECT 'second rename updates old redirect', (SELECT v FROM keep WHERE k = 'res4')::jsonb->>'slug' = 'qa-g19-care-guide'
  AND (SELECT to_slug FROM content_slug_redirects WHERE from_slug = 'qa-g19-care') = 'qa-g19-care-guide'
  AND (SELECT to_slug FROM content_slug_redirects WHERE from_slug = 'qa-g19-laptop-care') = 'qa-g19-care-guide', (SELECT v FROM keep WHERE k = 'res4');
INSERT INTO results SELECT 'rename to taken slug refused', r LIKE 'ERR:slug_taken%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'qa-g19-care-guide', 'expected_version', 5, 'title', 'Laptop care',
  'body_html', '<p>x</p>', 'status', 'published', 'new_slug', 'about')) r;
INSERT INTO results SELECT 'rename to legal slug refused', r LIKE 'ERR:slug_locked%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'qa-g19-care-guide', 'expected_version', 5, 'title', 'Laptop care',
  'body_html', '<p>x</p>', 'status', 'published', 'new_slug', 'privacy')) r;

-- 4. Unpublish then restore version 3 (content comes back; restore is a new version, history kept).
INSERT INTO results SELECT 'unpublish v6', r::jsonb->>'action' = 'unpublish', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'qa-g19-care-guide', 'expected_version', 5, 'title', 'Laptop care (rewrite)',
  'body_html', '<p>Draft rewrite</p>', 'status', 'draft')) r;
INSERT INTO keep SELECT 'v3body', r.body_html FROM content_page_revisions r JOIN content_pages p ON p.id = r.page_id WHERE p.slug = 'qa-g19-care-guide' AND r.version = 3;
INSERT INTO keep SELECT 'res5', (SELECT x FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'qa-g19-care-guide', 'expected_version', 6, 'title', 'Laptop care',
  'body_html', (SELECT v FROM keep WHERE k = 'v3body'), 'status', 'draft', 'action', 'restore', 'restored_from', 3, 'note', 'Restored version 3')) x);
INSERT INTO results SELECT 'restore v3 as v7', (SELECT v FROM keep WHERE k = 'res5')::jsonb->>'action' = 'restore' AND ((SELECT v FROM keep WHERE k = 'res5')::jsonb->>'version')::int = 7
  AND (SELECT body_html FROM content_pages WHERE slug = 'qa-g19-care-guide') = (SELECT v FROM keep WHERE k = 'v3body')
  AND (SELECT restored_from FROM content_page_revisions r2 JOIN content_pages p ON p.id = r2.page_id WHERE p.slug = 'qa-g19-care-guide' AND r2.version = 7) = 3, (SELECT v FROM keep WHERE k = 'res5');
INSERT INTO results SELECT 'history has 7 versions, all with staff', (SELECT count(*) FROM content_page_revisions r JOIN content_pages p ON p.id = r.page_id WHERE p.slug = 'qa-g19-care-guide') = 7
  AND (SELECT bool_and(saved_by IS NOT NULL) FROM content_page_revisions r JOIN content_pages p ON p.id = r.page_id WHERE p.slug = 'qa-g19-care-guide'), '';

-- 5. Legal gate in the database (warranty is a published, approved policy in the local seed or not: set up explicitly).
INSERT INTO keep SELECT 'wv', version::text FROM content_pages WHERE slug = 'warranty';
INSERT INTO keep SELECT 'wbody', body_html FROM content_pages WHERE slug = 'warranty';
INSERT INTO results SELECT 'editor cannot publish legal', r LIKE 'ERR:legal_forbidden%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'warranty', 'expected_version', (SELECT v::int FROM keep WHERE k = 'wv'),
  'title', 'Warranty', 'body_html', '<p>Edited by editor</p>', 'status', 'published', 'legal_approved', true)) r;
INSERT INTO results SELECT 'editor cannot approve legal', r LIKE 'ERR:legal_forbidden%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'warranty', 'expected_version', (SELECT v::int FROM keep WHERE k = 'wv'),
  'title', 'Warranty', 'body_html', '<p>x</p>', 'status', 'draft', 'legal_approved', NOT (SELECT legal_approved FROM content_pages WHERE slug = 'warranty'))) r;
INSERT INTO results SELECT 'owner: publish legal without approval refused', r LIKE 'ERR:legal_approval_required%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'warranty', 'expected_version', (SELECT v::int FROM keep WHERE k = 'wv'),
  'title', 'Warranty', 'body_html', '<p>x</p>', 'status', 'published', 'legal_approved', false)) r;
INSERT INTO results SELECT 'editor may save legal as draft', (r::jsonb->>'status') = 'draft', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(2), 'slug', 'warranty', 'expected_version', (SELECT v::int FROM keep WHERE k = 'wv'),
  'title', 'Warranty', 'body_html', '<p>Editor draft</p>', 'status', 'draft')) r;
INSERT INTO results SELECT 'legal page cannot be renamed', r LIKE 'ERR:slug_locked%', r
FROM pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'warranty', 'expected_version', (SELECT v::int FROM keep WHERE k = 'wv') + 1,
  'title', 'Warranty', 'body_html', '<p>x</p>', 'status', 'draft', 'new_slug', 'guarantee')) r;
-- Owner re-approves and publishes: the approval is stamped with the owner (who approved the wording now live).
INSERT INTO keep SELECT 'reapprove', pg_temp.save(jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'warranty',
  'expected_version', (SELECT v::int FROM keep WHERE k = 'wv') + 1, 'title', 'Warranty', 'body_html', '<p>Owner-approved wording</p>',
  'status', 'published', 'legal_approved', true));
INSERT INTO results SELECT 'owner approval stamped with owner and time',
  (SELECT legal_approved AND legal_approved_by::text = pg_temp.actor(1) AND legal_approved_at > now() - interval '1 minute' FROM content_pages WHERE slug = 'warranty'),
  (SELECT v FROM keep WHERE k = 'reapprove');
-- The policy wording from before this test's edit is still in history (baseline, or the last saved version).
INSERT INTO results SELECT 'legal wording before the edit still in history',
  EXISTS (SELECT 1 FROM content_page_revisions r JOIN content_pages p ON p.id = r.page_id WHERE p.slug = 'warranty' AND r.version < (SELECT v::int FROM keep WHERE k = 'wv') + 1 AND r.body_html = (SELECT v FROM keep WHERE k = 'wbody')), '';

-- 6. Append-only history, grants, server-only guard.
INSERT INTO results SELECT 'revision cannot be edited', pg_temp.try($q$update content_page_revisions set title = 'x' where action = 'baseline' returning '{}'::jsonb$q$) LIKE 'ERR:revisions_append_only%', '';
INSERT INTO results SELECT 'revision cannot be deleted', pg_temp.try($q$delete from content_page_revisions where action = 'create' returning '{}'::jsonb$q$) LIKE 'ERR:revisions_append_only%', '';
INSERT INTO results SELECT 'page with history cannot be deleted', pg_temp.try($q$delete from content_pages where slug = 'qa-g19-care-guide' returning '{}'::jsonb$q$) LIKE 'ERR:%', '';
INSERT INTO results SELECT 'anon cannot read revisions', NOT has_table_privilege('anon', 'public.content_page_revisions', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.content_page_revisions', 'SELECT'), '';
INSERT INTO results SELECT 'service_role cannot update/truncate revisions', NOT has_table_privilege('service_role', 'public.content_page_revisions', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.content_page_revisions', 'TRUNCATE'), '';
INSERT INTO results SELECT 'anon can read redirects, not write', has_table_privilege('anon', 'public.content_slug_redirects', 'SELECT') AND NOT has_table_privilege('anon', 'public.content_slug_redirects', 'INSERT'), '';
INSERT INTO results SELECT 'anon cannot execute save/create', NOT has_function_privilege('anon', 'public.save_content_page(jsonb)', 'EXECUTE') AND NOT has_function_privilege('authenticated', 'public.create_content_page(jsonb)', 'EXECUTE'), '';
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
INSERT INTO results SELECT 'Data API caller refused', r LIKE 'ERR:forbidden%', r
FROM pg_temp.try(format('select create_content_page(%L::jsonb)', jsonb_build_object('actor_user_id', pg_temp.actor(1), 'slug', 'qa-g19-api', 'title', 'Nope'))) r;
SELECT set_config('request.jwt.claims', '', true);

-- 7. Public visibility of legal pages still follows the original RLS policy (published AND legally approved).
INSERT INTO results SELECT 'public policy unchanged', (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polname = 'pages_public_select') LIKE '%legal_approved = true%', '';

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END || ' | ' || name || CASE WHEN ok THEN '' ELSE ' | ' || left(detail, 300) END FROM results;
SELECT 'TOTAL ' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM results;
ROLLBACK;
