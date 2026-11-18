-- Google public reviews: publishing may rely on a Maps URL without flipping consent_confirmed.
-- Matching an HTML snapshot is provenance of text, not customer display consent.
-- website/merchant published rows still require consent_confirmed.
-- Rollback: restore check (status <> 'published' or consent_confirmed) and re-set consent if needed.

alter table public.store_testimonials
  drop constraint if exists store_testimonials_publish_needs_consent;

alter table public.store_testimonials
  add constraint store_testimonials_publish_needs_consent check (
    status <> 'published'
    or consent_confirmed
    or (
      source = 'google'
      and source_url is not null
      and length(trim(source_url)) > 0
    )
  );

comment on constraint store_testimonials_publish_needs_consent on public.store_testimonials is
  'Published website/merchant rows need consent_confirmed. Published google rows need a Maps URL; consent_confirmed is optional for public Google reviews.';
