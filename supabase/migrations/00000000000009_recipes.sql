-- 009_recipes
-- Recipe structure: product -> recipe -> recipe_items -> ingredients.
-- Supports yield (exact consumption / batch yield / range yield).

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  description text,
  yield_type text not null default 'exact_consumption',
  default_yield numeric not null default 1,
  yield_unit_id uuid references public.units (id) on delete set null,
  preparation_time integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_yield_type_check check (
    yield_type in ('exact_consumption', 'batch_yield', 'range_yield')
  ),
  constraint recipes_default_yield_check check (default_yield > 0),
  constraint recipes_prep_check check (preparation_time is null or preparation_time >= 0)
);

create index if not exists idx_recipes_establishment on public.recipes (establishment_id);
create index if not exists idx_recipes_product on public.recipes (product_id);
create index if not exists idx_recipes_is_active on public.recipes (is_active);

create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- recipe_items
-- ============================================================
create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  quantity numeric not null default 0,
  unit_id uuid references public.units (id) on delete set null,
  waste_percentage numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_items_quantity_check check (quantity >= 0),
  constraint recipe_items_waste_check check (waste_percentage >= 0)
);

create index if not exists idx_recipe_items_recipe on public.recipe_items (recipe_id);
create index if not exists idx_recipe_items_ingredient on public.recipe_items (ingredient_id);

create trigger trg_recipe_items_updated_at
  before update on public.recipe_items
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- recipe_yields
-- ============================================================
-- Batch / range yield: e.g. 1 kg coffee -> 70-100 cups (standard 85).
create table if not exists public.recipe_yields (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  minimum_yield numeric,
  standard_yield numeric,
  maximum_yield numeric,
  unit_id uuid references public.units (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_yields_min_check check (standard_yield is null or standard_yield > 0),
  constraint recipe_yields_order_check check (
    (minimum_yield is null or maximum_yield is null) or minimum_yield <= maximum_yield
  )
);

create index if not exists idx_recipe_yields_recipe on public.recipe_yields (recipe_id);

create trigger trg_recipe_yields_updated_at
  before update on public.recipe_yields
  for each row
  execute function public.set_updated_at();
