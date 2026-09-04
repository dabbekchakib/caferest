-- 003_localization
-- Locales / languages reference data.

create table if not exists public.locales (
  code text primary key,
  name text not null,
  native_name text not null,
  rtl boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locales_code_check check (code in ('fr', 'en', 'ar'))
);

create index if not exists idx_locales_is_active on public.locales (is_active);

create trigger trg_locales_updated_at
  before update on public.locales
  for each row
  execute function public.set_updated_at();
