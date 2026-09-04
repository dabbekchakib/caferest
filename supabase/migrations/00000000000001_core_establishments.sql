-- 001_core_establishments
-- Core utilities + establishments table.

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Generic trigger: keep updated_at in sync
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- establishments
-- ============================================================
create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  description text,
  address text,
  city text,
  postal_code text,
  country text default 'TN',
  phone text,
  email text,
  website text,
  tax_identifier text,
  registration_number text,
  logo_url text,
  favicon_url text,
  receipt_header text,
  receipt_footer text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_establishments_name on public.establishments (name);
create index if not exists idx_establishments_is_active on public.establishments (is_active);

create trigger trg_establishments_updated_at
  before update on public.establishments
  for each row
  execute function public.set_updated_at();

-- Memberships helper table (establishment access for auth users).
-- The personal establishment/active context is resolved via profiles + user_roles (see 012).
create table if not exists public.establishment_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

create index if not exists idx_establishment_members_establishment
  on public.establishment_members (establishment_id);
