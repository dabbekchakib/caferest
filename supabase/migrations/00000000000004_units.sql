-- 004_units
-- Measurement units + conversions.

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  symbol text not null,
  category text not null default 'quantity',
  precision integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_category_check check (
    category in ('weight', 'volume', 'quantity', 'length', 'packaging', 'portion')
  ),
  constraint units_precision_check check (precision >= 0)
);

create unique index if not exists uq_units_establishment_symbol
  on public.units (establishment_id, symbol);

create index if not exists idx_units_establishment on public.units (establishment_id);
create index if not exists idx_units_category on public.units (category);

create trigger trg_units_updated_at
  before update on public.units
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- unit_conversions
-- ============================================================
-- factor semantics: 1 * from_unit = factor * to_unit
--   e.g. kg -> g, factor = 1000  (1 kg = 1000 g)
create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  from_unit_id uuid not null references public.units (id) on delete cascade,
  to_unit_id uuid not null references public.units (id) on delete cascade,
  factor numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_conversions_factor_check check (factor > 0),
  constraint unit_conversions_no_self_check check (from_unit_id <> to_unit_id)
);

create unique index if not exists uq_unit_conversions_pair
  on public.unit_conversions (from_unit_id, to_unit_id);

create index if not exists idx_unit_conversions_from on public.unit_conversions (from_unit_id);
create index if not exists idx_unit_conversions_to on public.unit_conversions (to_unit_id);

create trigger trg_unit_conversions_updated_at
  before update on public.unit_conversions
  for each row
  execute function public.set_updated_at();
