-- 008_ingredients
-- Raw materials used in recipes (tracked in inventory).

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  description text,
  base_unit_id uuid references public.units (id) on delete set null,
  purchase_unit_id uuid references public.units (id) on delete set null,
  minimum_stock numeric not null default 0,
  maximum_stock numeric,
  reorder_point numeric not null default 0,
  is_stockable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_min_stock_check check (minimum_stock >= 0),
  constraint ingredients_reorder_check check (reorder_point >= 0)
);

create unique index if not exists uq_ingredients_establishment_sku
  on public.ingredients (establishment_id, sku)
  where sku is not null;
create unique index if not exists uq_ingredients_establishment_barcode
  on public.ingredients (establishment_id, barcode)
  where barcode is not null;

create index if not exists idx_ingredients_establishment on public.ingredients (establishment_id);
create index if not exists idx_ingredients_category on public.ingredients (category_id);
create index if not exists idx_ingredients_name on public.ingredients (name);

create trigger trg_ingredients_updated_at
  before update on public.ingredients
  for each row
  execute function public.set_updated_at();
