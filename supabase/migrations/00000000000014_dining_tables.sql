-- 014_dining_tables
-- Dining areas + tables (floor plan support). Full logic later.

create table if not exists public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dining_areas_establishment on public.dining_areas (establishment_id);
create index if not exists idx_dining_areas_sort on public.dining_areas (sort_order);

create trigger trg_dining_areas_updated_at
  before update on public.dining_areas
  for each row
  execute function public.set_updated_at();

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  area_id uuid references public.dining_areas (id) on delete set null,
  name text not null,
  code text,
  capacity integer not null default 1,
  position_x numeric,
  position_y numeric,
  status text not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tables_capacity_check check (capacity > 0),
  constraint tables_status_check check (
    status in ('available', 'occupied', 'reserved', 'cleaning', 'blocked')
  )
);

create unique index if not exists uq_tables_establishment_code
  on public.tables (establishment_id, code)
  where code is not null;

create index if not exists idx_tables_establishment on public.tables (establishment_id);
create index if not exists idx_tables_area on public.tables (area_id);
create index if not exists idx_tables_status on public.tables (status);

create trigger trg_tables_updated_at
  before update on public.tables
  for each row
  execute function public.set_updated_at();
