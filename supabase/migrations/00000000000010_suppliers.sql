-- 010_suppliers
-- Vendors for purchasing.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  code text,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_identifier text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_suppliers_establishment_code
  on public.suppliers (establishment_id, code)
  where code is not null;

create index if not exists idx_suppliers_establishment on public.suppliers (establishment_id);
create index if not exists idx_suppliers_name on public.suppliers (name);
create index if not exists idx_suppliers_is_active on public.suppliers (is_active);

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.set_updated_at();
