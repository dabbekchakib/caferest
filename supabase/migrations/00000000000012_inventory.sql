-- 012_inventory
-- Stock locations, stock items, traceable stock movements.

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  code text not null,
  type text not null default 'storage',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_locations_type_check check (
    type in ('storage', 'bar', 'kitchen', 'reserve')
  )
);

create unique index if not exists uq_inventory_locations_establishment_code
  on public.inventory_locations (establishment_id, code);

create index if not exists idx_inventory_locations_establishment
  on public.inventory_locations (establishment_id);

create trigger trg_inventory_locations_updated_at
  before update on public.inventory_locations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- stock_items
-- ============================================================
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  location_id uuid not null references public.inventory_locations (id) on delete cascade,
  quantity numeric not null default 0,
  reserved_quantity numeric not null default 0,
  average_cost numeric not null default 0,
  last_cost numeric,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint stock_items_quantity_check check (quantity >= 0),
  constraint stock_items_reserved_check check (reserved_quantity >= 0),
  constraint stock_items_avg_cost_check check (average_cost >= 0)
);

create unique index if not exists uq_stock_items_ingredient_location
  on public.stock_items (establishment_id, ingredient_id, location_id);

create index if not exists idx_stock_items_establishment on public.stock_items (establishment_id);
create index if not exists idx_stock_items_ingredient on public.stock_items (ingredient_id);
create index if not exists idx_stock_items_location on public.stock_items (location_id);

create trigger trg_stock_items_updated_at
  before update on public.stock_items
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- stock_movements
-- ============================================================
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  location_id uuid references public.inventory_locations (id) on delete set null,
  movement_type text not null,
  quantity numeric not null default 0,
  unit_id uuid references public.units (id) on delete set null,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_type_check check (
    movement_type in (
      'purchase', 'sale_consumption', 'transfer_in', 'transfer_out',
      'adjustment_in', 'adjustment_out', 'waste', 'return', 'opening'
    )
  ),
  constraint stock_movements_quantity_check check (quantity >= 0)
);

create index if not exists idx_stock_movements_establishment on public.stock_movements (establishment_id);
create index if not exists idx_stock_movements_ingredient on public.stock_movements (ingredient_id);
create index if not exists idx_stock_movements_location on public.stock_movements (location_id);
create index if not exists idx_stock_movements_type on public.stock_movements (movement_type);
create index if not exists idx_stock_movements_created_at on public.stock_movements (created_at);
create index if not exists idx_stock_movements_reference on public.stock_movements (reference_type, reference_id);
