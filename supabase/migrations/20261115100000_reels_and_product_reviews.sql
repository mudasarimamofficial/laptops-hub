-- Reels ("Generation Laptops HUB") and moderated product reviews.
--
-- Truthfulness rules enforced in the database, not only in the app:
--   * A reel can be published only with cleared rights (owned or licensed) and an https video (http only on
--     localhost for isolated tests). Reference material from other shops (ronin.pk) can never be stored.
--   * A review is public only after staff approve it. Reviews are submitted through the rate-limited API with the
--     service role; anon/authenticated have no INSERT path, so the API's validation cannot be bypassed.
--   * Reviewer email and IP hash are never readable by anon/authenticated (column grants), even for approved rows.
-- Additive only: no existing table is changed.

-- ── Reels ───────────────────────────────────────────────────────────────────
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  caption text not null default '' check (char_length(caption) <= 300),
  video_url text not null check (char_length(video_url) <= 2048),
  poster_url text check (poster_url is null or char_length(poster_url) <= 2048),
  product_id uuid references public.products (id) on delete set null,
  rights_status text not null default 'pending' check (rights_status in ('pending', 'owned', 'licensed')),
  rights_note text not null default '' check (char_length(rights_note) <= 500),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reels_publish_requires_rights check (status <> 'published' or rights_status in ('owned', 'licensed')),
  constraint reels_video_scheme check (
    video_url ~* '^https://' or video_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
  ),
  constraint reels_poster_scheme check (
    poster_url is null or poster_url ~* '^https://' or poster_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
  ),
  constraint reels_no_reference_assets check (
    video_url !~* '^https?://([a-z0-9-]+\.)*ronin\.pk(/|:|$)'
    and (poster_url is null or poster_url !~* '^https?://([a-z0-9-]+\.)*ronin\.pk(/|:|$)')
  )
);

create index if not exists reels_public_order_idx on public.reels (sort_order, created_at desc) where status = 'published';
create index if not exists reels_product_id_idx on public.reels (product_id);

drop trigger if exists reels_set_updated_at on public.reels;
create trigger reels_set_updated_at before update on public.reels
  for each row execute function public.set_updated_at();

alter table public.reels enable row level security;

drop policy if exists reels_public_select on public.reels;
create policy reels_public_select on public.reels
  for select to anon, authenticated
  using (status = 'published' and rights_status in ('owned', 'licensed'));

drop policy if exists reels_staff_all on public.reels;
create policy reels_staff_all on public.reels
  for all to authenticated
  using ((select public.has_staff_role(array['owner', 'admin', 'editor']::public.staff_role[])))
  with check ((select public.has_staff_role(array['owner', 'admin', 'editor']::public.staff_role[])));

revoke all on table public.reels from anon, authenticated;
grant select (id, title, caption, video_url, poster_url, product_id, sort_order, status, rights_status, created_at)
  on table public.reels to anon, authenticated;
grant all on table public.reels to service_role;

-- ── Product reviews ─────────────────────────────────────────────────────────
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  title text not null default '' check (char_length(title) <= 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_email text check (reviewer_email is null or char_length(reviewer_email) <= 254),
  ip_hash text,
  moderated_by uuid,
  moderated_at timestamptz,
  moderation_note text not null default '' check (char_length(moderation_note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_public_idx on public.product_reviews (product_id, created_at desc) where status = 'approved';
create index if not exists product_reviews_queue_idx on public.product_reviews (status, created_at desc);

alter table public.product_reviews enable row level security;

drop policy if exists product_reviews_public_select on public.product_reviews;
create policy product_reviews_public_select on public.product_reviews
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists product_reviews_staff_all on public.product_reviews;
create policy product_reviews_staff_all on public.product_reviews
  for all to authenticated
  using ((select public.has_staff_role(array['owner', 'admin', 'manager', 'editor']::public.staff_role[])))
  with check ((select public.has_staff_role(array['owner', 'admin', 'manager', 'editor']::public.staff_role[])));

revoke all on table public.product_reviews from anon, authenticated;
-- Public columns only: no reviewer_email, ip_hash, moderated_by or moderation_note.
grant select (id, product_id, author_name, rating, title, body, status, created_at)
  on table public.product_reviews to anon, authenticated;
grant all on table public.product_reviews to service_role;
