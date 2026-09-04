-- 005_categories
-- Hierarchical product/ingredient categories.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_check check (slug <> ''),
  constraint categories_no_self_parent_check check (parent_id is null or parent_id <> id)
);

create unique index if not exists uq_categories_establishment_slug
  on public.categories (establishment_id, slug);

create index if not exists idx_categories_establishment on public.categories (establishment_id);
create index if not exists idx_categories_parent on public.categories (parent_id);
create index if not exists idx_categories_sort on public.categories (sort_order);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();
