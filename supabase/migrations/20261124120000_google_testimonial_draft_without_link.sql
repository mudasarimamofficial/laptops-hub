-- LH-019: Google testimonials may be saved as drafts / pending without a Maps link; the link is required to PUBLISH.
--
-- Why: 20261118100000 made `store_testimonials_google_needs_link` apply to every Google row, but the admin UI, the
-- API (`publishBlockers`) and the Google snapshot import (inserts link-less drafts for verification) all treat the
-- link as a publish requirement. The strict constraint made every link-less Google draft fail with a generic
-- "Could not save", and made the snapshot import insert nothing.
--
-- Safety: only RELAXES a check (no data change). Published Google rows still need a valid Maps link (this constraint)
-- and `store_testimonials_publish_needs_consent` is unchanged. Additive and idempotent.
-- Rollback: re-add the strict form below; it fails while link-less Google drafts exist (delete or fix them first).
--   check (source <> 'google' or (source_url is not null and source_url ~* '<same regex>'))

alter table public.store_testimonials
  drop constraint if exists store_testimonials_google_needs_link;

alter table public.store_testimonials
  add constraint store_testimonials_google_needs_link check (
    source <> 'google'
    or status <> 'published'
    or (source_url is not null
        and source_url ~* '^https://((www\.)?google\.(com|[a-z]{2})(\.[a-z]{2})?/maps|maps\.google\.(com|[a-z]{2})(\.[a-z]{2})?/|maps\.app\.goo\.gl/|g\.page/)')
  );

comment on constraint store_testimonials_google_needs_link on public.store_testimonials is
  'Published Google testimonials must link to the review on Google Maps; drafts/pending may omit it while being verified.';
