-- Merchandising badges (editorial only) and reel creator/tag details.
--
-- Truthfulness rules enforced in the database, not only in the app:
--   * product_badges holds EDITORIAL labels chosen by staff ("Featured", "Popular pick", "Staff pick"). It cannot hold
--     a sales claim: "Top seller"/"Best seller"/"Trending" are never stored here. The data-backed "Top seller" badge is
--     computed at read time from real qualifying orders (see src/lib/content/social-proof.ts) and is never editable.
--   * A badge is public only inside its optional schedule window.
--   * A reel may show a creator name only when staff record that the creator consented (creator_consent = true).
-- Additive only: no existing column changes type or nullability; existing rows keep their values.

-- ── Editorial product badges ────────────────────────────────────────────────
create table if not exists public.product_badges (
  product_id uuid primary key references public.products (id) on delete cascade,
  kind text not null check (kind in ('featured', 'popular_pick', 'staff_pick')),
  starts_at timestamptz,
  ends_at timestamptz,
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_badges_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

drop trigger if exists product_badges_set_updated_at on public.product_badges;
create trigger product_badges_set_updated_at before update on public.product_badges
  for each row execute function public.set_updated_at();

alter table public.product_badges enable row level security;

drop policy if exists product_badges_public_select on public.product_badges;
create policy product_badges_public_select on public.product_badges
  for select to anon, authenticated
  using ((starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists product_badges_staff_all on public.product_badges;
create policy product_badges_staff_all on public.product_badges
  for all to authenticated
  using ((select public.has_staff_role(array['owner', 'admin', 'manager', 'editor']::public.staff_role[])))
  with check ((select public.has_staff_role(array['owner', 'admin', 'manager', 'editor']::public.staff_role[])));

-- Same pattern as reels/product_reviews: staff writes go through server routes that check the staff role first and
-- then use the service role (createAuthorizedStaffWriter). anon/authenticated get read access to public columns only.
revoke all on table public.product_badges from anon, authenticated;
grant select (product_id, kind, starts_at, ends_at) on table public.product_badges to anon, authenticated;
grant all on table public.product_badges to service_role;

-- ── Reel creator / tag (shown only with consent) ────────────────────────────
alter table public.reels add column if not exists creator_name text not null default '';
alter table public.reels add column if not exists creator_consent boolean not null default false;
alter table public.reels add column if not exists tag text not null default '';

do $$ begin
  alter table public.reels add constraint reels_creator_name_len check (char_length(creator_name) <= 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reels add constraint reels_tag_format check (tag = '' or tag ~ '^#?[A-Za-z0-9_]{1,39}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reels add constraint reels_creator_requires_consent check (creator_name = '' or creator_consent);
exception when duplicate_object then null; end $$;

grant select (creator_name, tag) on table public.reels to anon, authenticated;
