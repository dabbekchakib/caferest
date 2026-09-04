-- 015_customers
-- Customers / contacts.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  address text,
  notes text,
  loyalty_points integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_loyalty_check check (loyalty_points >= 0)
);

create index if not exists idx_customers_establishment on public.customers (establishment_id);
create index if not exists idx_customers_phone on public.customers (phone);
create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_is_active on public.customers (is_active);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();
