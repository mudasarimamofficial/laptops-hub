-- Allow externally hosted HTTPS reel media (drop hostname blacklist).
-- Additive columns for HLS, avatar, media source, stable preset keys, and destination paths.
-- Does not weaken RLS or publish-requires-rights. Does not rewrite existing rows.

-- 1) Remove host-specific ban (ronin.pk). Technical URL safety remains in app + scheme checks.
alter table public.reels drop constraint if exists reels_no_reference_assets;

-- 2) Additive media / attribution columns
alter table public.reels add column if not exists hls_url text;
alter table public.reels add column if not exists avatar_url text;
alter table public.reels add column if not exists media_source text not null default 'external_file';
alter table public.reels add column if not exists preset_key text;
alter table public.reels add column if not exists link_path text;
alter table public.reels add column if not exists source_attribution text not null default '';

do $$ begin
  alter table public.reels add constraint reels_hls_scheme check (
    hls_url is null or hls_url = '' or hls_url ~* '^https://' or hls_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_avatar_scheme check (
    avatar_url is null or avatar_url = '' or avatar_url ~* '^https://' or avatar_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_media_source_check check (
    media_source in ('uploaded', 'external_file', 'external_stream')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_hls_len check (hls_url is null or char_length(hls_url) <= 2048);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_avatar_len check (avatar_url is null or char_length(avatar_url) <= 2048);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_link_path_format check (
    link_path is null or link_path = '' or link_path ~ '^/[a-z0-9][a-z0-9/_-]{0,199}$'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reels add constraint reels_source_attribution_len check (char_length(source_attribution) <= 500);
exception when duplicate_object then null; end $$;

create unique index if not exists reels_preset_key_uidx on public.reels (preset_key) where preset_key is not null and preset_key <> '';

-- Public can read new display fields on published rows (RLS still gates status/rights).
grant select (hls_url, avatar_url, media_source, link_path, source_attribution) on table public.reels to anon, authenticated;
