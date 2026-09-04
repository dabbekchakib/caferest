-- 002_settings
-- Centralized dynamic configuration key-value store.

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  key text not null,
  value text,
  type text not null default 'string',
  group_name text not null default 'general',
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_type_check check (
    type in ('string', 'integer', 'decimal', 'boolean', 'json', 'color', 'url', 'text')
  ),
  constraint settings_group_check check (
    group_name in (
      'general', 'branding', 'localization', 'currency', 'tax', 'pos',
      'inventory', 'purchasing', 'recipes', 'printing', 'notifications',
      'security', 'customers', 'kitchen', 'system'
    )
  ),
  constraint settings_key_check check (key <> '')
);

-- a (establishment_id, key) combination is unique per establishment
create unique index if not exists uq_settings_establishment_key
  on public.settings (establishment_id, key);

create index if not exists idx_settings_establishment_group
  on public.settings (establishment_id, group_name);

create index if not exists idx_settings_is_public on public.settings (is_public);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row
  execute function public.set_updated_at();

-- Permit same key names across different establishments naturally (handled by unique index).
