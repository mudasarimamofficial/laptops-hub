-- Public articles must not appear before scheduled_for.
-- Additive policy replace. Rollback: restore USING (status = 'published') only.

DROP POLICY IF EXISTS articles_public_select ON public.articles;

CREATE POLICY articles_public_select ON public.articles
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND (scheduled_for IS NULL OR scheduled_for <= now())
  );

COMMENT ON POLICY articles_public_select ON public.articles IS
  'Anon/authenticated may read published articles only after scheduled_for (if set).';
