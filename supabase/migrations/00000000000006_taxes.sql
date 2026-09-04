-- 006_taxes
-- Configurable tax rates (e.g. TVA 0%, 7%, 13%, 19% -- never hardcoded in frontend).

create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  code text not null,
  rate numeric not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxes_rate_check check (rate >= 0)
);

create unique index if not exists uq_taxes_establishment_code
  on public.taxes (establishment_id, code);

create index if not exists idx_taxes_establishment on public.taxes (establishment_id);
create index if not exists idx_taxes_is_active on public.taxes (is_active);

-- Only one default tax per establishment.
create unique index if not exists uq_taxes_one_default_per_establishment
  on public.taxes (establishment_id)
  where is_default;

create trigger trg_taxes_updated_at
  before update on public.taxes
  for each row
  execute function public.set_updated_at();
