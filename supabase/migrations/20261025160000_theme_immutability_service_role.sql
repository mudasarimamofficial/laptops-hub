-- Published theme snapshots must be immutable even when the API uses service_role.
-- Mutations are allowed only when RPCs set app.theme_mutation (publish | draft_save | rollback).

CREATE OR REPLACE FUNCTION public.theme_versions_immutability_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag text := coalesce(current_setting('app.theme_mutation', true), '');
BEGIN
  IF v_flag IN ('publish', 'draft_save', 'rollback') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'immutable_published_theme' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'immutable_published_theme' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'published' AND v_flag <> 'publish' THEN
    RAISE EXCEPTION 'publish_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' AND v_flag <> 'publish' THEN
    RAISE EXCEPTION 'publish_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.theme_publications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag text := coalesce(current_setting('app.theme_mutation', true), '');
BEGIN
  IF v_flag IN ('publish', 'rollback') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'theme_publication_via_rpc_only' USING ERRCODE = 'P0001';
END;
$$;
