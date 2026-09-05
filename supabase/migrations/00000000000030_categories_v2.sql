-- 030_categories_v2
-- Multilingual hierarchical categories.
--
-- Extends the phase-03 `categories` table (name/slug/description stay as the
-- master/fallback columns) and adds:
--   * icon, color, is_system
--   * category_translations (fr/en/ar) with UNIQUE(category_id, locale)
--   * DB-level cycle prevention for parent_id moves
--   * protection of system categories (identity fields + deletion)
--   * RLS / storage-friendly indexes

-- ============================================================
-- categories: new columns
-- ============================================================
alter table public.categories
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists is_system boolean not null default false;

-- ============================================================
-- category_translations
-- ============================================================
create table if not exists public.category_translations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_translations_locale_check check (locale in ('fr', 'en', 'ar')),
  constraint category_translations_name_check check (name <> ''),
  constraint uq_category_translations_category_locale unique (category_id, locale)
);

create index if not exists idx_category_translations_locale
  on public.category_translations (locale);

create trigger trg_category_translations_updated_at
  before update on public.category_translations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Extra indexes (perf spec: parent_id, slug, is_active, sort_order)
-- ============================================================
create index if not exists idx_categories_is_active on public.categories (is_active);
create index if not exists idx_categories_parent_sort on public.categories (parent_id, sort_order);

-- ============================================================
-- Cycle prevention (server-side hard guarantee)
-- ============================================================
create or replace function public.validate_category_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if exists (
      with recursive ancestors as (
        select id, parent_id
        from public.categories
        where id = new.parent_id
        union all
        select c.id, c.parent_id
        from public.categories c
        join ancestors a on c.id = a.parent_id
      )
      select 1
      from ancestors
      where id = new.id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'category_cycle';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_categories_validate_cycle on public.categories;
create trigger trg_categories_validate_cycle
  before insert or update on public.categories
  for each row execute function public.validate_category_cycle();

-- ============================================================
-- System category protection (identity fields + deletion).
-- Guards apply only to logged-in non-super-admin actors, so migrations
-- and service-role writes (auth.uid() = null) always pass.
-- ============================================================
create or replace function public.protect_system_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_category_protected';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.is_system
       and (new.is_system is distinct from old.is_system
            or new.slug is distinct from old.slug
            or new.parent_id is distinct from old.parent_id
            or new.establishment_id is distinct from old.establishment_id)
       and auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_category_protected';
    end if;
  elsif tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_category_protected';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_categories_protect_system on public.categories;
create trigger trg_categories_protect_system
  before insert or update or delete on public.categories
  for each row execute function public.protect_system_categories();

-- ============================================================
-- RLS
--   categories          -> establishment-scoped, permission-gated writes
--   category_translations -> inherits access from its parent category
-- ============================================================
alter table public.categories enable row level security;
alter table public.category_translations enable row level security;

drop policy if exists categories_read on public.categories;
create policy "categories_read" on public.categories
  for select using (
    is_super_admin()
    or belongs_to_establishment(establishment_id)
  );

drop policy if exists categories_member_insert on public.categories;
create policy "categories_member_insert" on public.categories
  for insert with check (
    is_super_admin()
    or (not is_system
        and has_permission(establishment_id, 'categories.create'))
  );

drop policy if exists categories_member_update on public.categories;
create policy "categories_member_update" on public.categories
  for update using (
    is_super_admin()
    or (not is_system
        and has_permission(establishment_id, 'categories.update'))
  ) with check (
    is_super_admin()
    or (not is_system
        and has_permission(establishment_id, 'categories.update'))
  );

drop policy if exists categories_member_delete on public.categories;
create policy "categories_member_delete" on public.categories
  for delete using (
    is_super_admin()
    or (not is_system
        and has_permission(establishment_id, 'categories.delete'))
  );

drop policy if exists category_translations_read on public.category_translations;
create policy "category_translations_read" on public.category_translations
  for select using (
    is_super_admin()
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and belongs_to_establishment(c.establishment_id)
    )
  );

drop policy if exists category_translations_member_insert on public.category_translations;
create policy "category_translations_member_insert" on public.category_translations
  for insert with check (
    is_super_admin()
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and has_permission(c.establishment_id, 'categories.create')
    )
  );

drop policy if exists category_translations_member_update on public.category_translations;
create policy "category_translations_member_update" on public.category_translations
  for update using (
    is_super_admin()
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and has_permission(c.establishment_id, 'categories.update')
    )
  ) with check (
    is_super_admin()
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and has_permission(c.establishment_id, 'categories.update')
    )
  );

drop policy if exists category_translations_member_delete on public.category_translations;
create policy "category_translations_member_delete" on public.category_translations
  for delete using (
    is_super_admin()
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and has_permission(c.establishment_id, 'categories.update')
    )
  );