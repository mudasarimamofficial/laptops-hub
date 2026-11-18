-- Many-to-many products featured in a reel (ordered). Keeps legacy reels.product_id for compatibility.

create table if not exists public.reel_products (
  reel_id uuid not null references public.reels (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (reel_id, product_id),
  constraint reel_products_sort_order_check check (sort_order between -1000 and 1000)
);

create index if not exists reel_products_product_id_idx on public.reel_products (product_id);
create index if not exists reel_products_reel_order_idx on public.reel_products (reel_id, sort_order);

-- Backfill from the legacy single product_id column.
insert into public.reel_products (reel_id, product_id, sort_order)
select r.id, r.product_id, 0
from public.reels r
where r.product_id is not null
on conflict (reel_id, product_id) do nothing;

alter table public.reel_products enable row level security;

drop policy if exists reel_products_public_select on public.reel_products;
create policy reel_products_public_select on public.reel_products
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.reels r
      where r.id = reel_id
        and r.status = 'published'
        and r.rights_status in ('owned', 'licensed')
    )
  );

drop policy if exists reel_products_staff_all on public.reel_products;
create policy reel_products_staff_all on public.reel_products
  for all to authenticated
  using ((select public.has_staff_role(array['owner', 'admin', 'editor']::public.staff_role[])))
  with check ((select public.has_staff_role(array['owner', 'admin', 'editor']::public.staff_role[])));

revoke all on table public.reel_products from anon, authenticated;
grant select (reel_id, product_id, sort_order, created_at) on table public.reel_products to anon, authenticated;
grant all on table public.reel_products to service_role;
