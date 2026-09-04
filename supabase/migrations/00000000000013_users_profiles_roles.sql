-- 013_users_profiles_roles
-- Profiles (mirror auth.users), roles, user_roles + establishment access helpers.

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  preferred_locale text default 'fr',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_locale_check check (preferred_locale in ('fr', 'en', 'ar'))
);

create index if not exists idx_profiles_full_name on public.profiles (full_name);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Auto-create a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- roles
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_roles_code on public.roles (code);

create trigger trg_roles_updated_at
  before update on public.roles
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- user_roles
-- ============================================================
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id, establishment_id)
);

create index if not exists idx_user_roles_user on public.user_roles (user_id);
create index if not exists idx_user_roles_establishment on public.user_roles (establishment_id);
create index if not exists idx_user_roles_role on public.user_roles (role_id);
