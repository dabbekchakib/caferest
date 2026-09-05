-- 041_recipes_v2
-- Phase 11: evolve the Phase-03 recipe tables into the full recipes module:
--   * recipes:  version, status (draft/active/inactive/archived), is_default,
--               notes, is_system, sort_order, created_by/updated_by
--   * recipe_items: nullable ingredient_id OR sub_recipe_id (XOR), notes,
--               sort_order, stricter quantity/waste checks
--   * recipe_translations: fr (master) / en / ar, unique (recipe_id, locale)
--   * replace the establishment-scoped RLS (023) with permission-gated policies
--     that forbid cross-establishment references and protect system recipes.
--   * recipe_yields stays untouched (Yield/Rendement is a LATER phase).
--   * A recipe NEVER creates stock movements (inventory is a later phase).

-- ============================================================
-- 1) recipes — additive column evolution (no data loss)
-- ============================================================
alter table public.recipes
  add column if not exists version integer not null default 1,
  add column if not exists status text not null default 'draft',
  add column if not exists is_default boolean not null default false,
  add column if not exists notes text,
  add column if not exists is_system boolean not null default false,
  add column if not exists sort_order integer not null default 10,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

-- Domain constraints for the new recipe fields.
alter table public.recipes
  add constraint recipes_version_check check (version >= 1)
  ;
alter table public.recipes
  add constraint recipes_status_check check (
    status in ('draft', 'active', 'inactive', 'archived')
  )
  ;

-- Version uniqueness within a product (v1, v2, v3...).
create unique index if not exists uq_recipes_establishment_product_version
  on public.recipes (establishment_id, product_id, version);

-- A single ACTIVE recipe can be the default per product.
create unique index if not exists uq_recipes_default_per_product
  on public.recipes (establishment_id, product_id)
  where is_default = true and status = 'active';

create index if not exists idx_recipes_status on public.recipes (status);
create index if not exists idx_recipes_default on public.recipes (is_default);
create index if not exists idx_recipes_product_version on public.recipes (product_id, version);

-- ============================================================
-- 2) recipe_items — sub-recipes, notes, ordering, XOR reference
-- ============================================================
-- Make ingredient_id nullable so an item can reference a sub-recipe instead.
alter table public.recipe_items
  alter column ingredient_id drop not null;

alter table public.recipe_items
  add column if not exists sub_recipe_id uuid
    references public.recipes (id) on delete set null,
  add column if not exists notes text,
  add column if not exists sort_order integer not null default 10;

-- Exactly one of ingredient_id / sub_recipe_id must be set (XOR).
alter table public.recipe_items
  add constraint recipe_items_reference_xor check (
    (ingredient_id is not null and sub_recipe_id is null)
    or (ingredient_id is null and sub_recipe_id is not null)
  );

-- Stricter checks: quantity > 0, waste 0-100.
alter table public.recipe_items
  drop constraint if exists recipe_items_quantity_check;
alter table public.recipe_items
  add constraint recipe_items_quantity_check check (quantity > 0);
alter table public.recipe_items
  drop constraint if exists recipe_items_waste_check;
alter table public.recipe_items
  add constraint recipe_items_waste_check check (waste_percentage >= 0 and waste_percentage <= 100);

create index if not exists idx_recipe_items_sub_recipe on public.recipe_items (sub_recipe_id);
create index if not exists idx_recipe_items_sort on public.recipe_items (recipe_id, sort_order);

-- ============================================================
-- 3) recipe_translations
-- ============================================================
create table if not exists public.recipe_translations (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  locale text not null check (locale in ('fr', 'en', 'ar')),
  name text not null check (name <> ''),
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_recipe_translations_recipe_locale
  on public.recipe_translations (recipe_id, locale);
create index if not exists idx_recipe_translations_locale
  on public.recipe_translations (locale);

create trigger trg_recipe_translations_updated_at
  before update on public.recipe_translations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4) RLS helper: forbid cross-establishment references
--    (same-establishment product, ingredient, sub-recipe; same/system unit)
-- ============================================================
create or replace function public.recipe_references_valid(
  p_establishment_id uuid,
  p_product_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_product_id is null or exists (
      select 1 from public.products p
      where p.id = p_product_id and p.establishment_id = p_establishment_id))
    and (p_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_unit_id
        and (u.establishment_id = p_establishment_id or u.establishment_id is null)));
$$;

-- ============================================================
-- 5) System-recipe protection trigger
-- ============================================================
create or replace function public.protect_system_recipes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_recipe_protected';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_recipe_protected';
    end if;
    return old;
  end if;

  if old.is_system
     and (
       new.status is distinct from old.status
       or new.version is distinct from old.version
       or new.establishment_id is distinct from old.establishment_id
       or new.product_id is distinct from old.product_id
     )
     and auth.uid() is not null
     and not is_super_admin() then
    raise exception 'system_recipe_protected';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recipes_protect_system on public.recipes;
create trigger trg_recipes_protect_system
  before insert or update or delete on public.recipes
  for each row
  execute function public.protect_system_recipes();

-- ============================================================
-- 6) RLS — recipes
-- ============================================================
drop policy if exists recipes_read on public.recipes;
drop policy if exists recipes_write on public.recipes;

create policy "recipes_read" on public.recipes
  for select using (
    is_super_admin()
    or belongs_to_establishment(establishment_id)
  );

create policy "recipes_member_insert" on public.recipes
  for insert with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'recipes.create')
      and recipe_references_valid(establishment_id, product_id, yield_unit_id)
    )
  );

create policy "recipes_member_update" on public.recipes
  for update using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'recipes.update')
    )
  ) with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'recipes.update')
      and recipe_references_valid(establishment_id, product_id, yield_unit_id)
    )
  );

create policy "recipes_member_delete" on public.recipes
  for delete using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'recipes.delete')
    )
  );

-- ============================================================
-- 7) RLS — recipe_items (access inherited from the owning recipe)
--    AND item-level cross-establishment guard on referenced rows.
-- ============================================================
create or replace function public.recipe_item_references_valid(
  p_recipe_establishment_id uuid,
  p_ingredient_id uuid,
  p_sub_recipe_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_ingredient_id is null or exists (
      select 1 from public.ingredients i
      where i.id = p_ingredient_id
        and i.establishment_id = p_recipe_establishment_id))
    and (p_sub_recipe_id is null or exists (
      select 1 from public.recipes r
      where r.id = p_sub_recipe_id
        and r.establishment_id = p_recipe_establishment_id))
    and (p_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_unit_id
        and (u.establishment_id = p_recipe_establishment_id or u.establishment_id is null)));
$$;

drop policy if exists recipe_items_read on public.recipe_items;
drop policy if exists recipe_items_write on public.recipe_items;

create policy "recipe_items_read" on public.recipe_items
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and (is_super_admin() or belongs_to_establishment(r.establishment_id))
    )
  );

create policy "recipe_items_member_insert" on public.recipe_items
  for insert with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
        and recipe_item_references_valid(
              r.establishment_id, ingredient_id, sub_recipe_id, unit_id)
    )
  );

create policy "recipe_items_member_update" on public.recipe_items
  for update using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
    )
  ) with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
        and recipe_item_references_valid(
              r.establishment_id, ingredient_id, sub_recipe_id, unit_id)
    )
  );

create policy "recipe_items_member_delete" on public.recipe_items
  for delete using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
    )
  );

-- ============================================================
-- 8) RLS — recipe_translations (inherited from the recipe)
-- ============================================================
alter table public.recipe_translations enable row level security;

create policy "recipe_translations_read" on public.recipe_translations
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and (is_super_admin() or belongs_to_establishment(r.establishment_id))
    )
  );

create policy "recipe_translations_member_insert" on public.recipe_translations
  for insert with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.create')
    )
  );

create policy "recipe_translations_member_update" on public.recipe_translations
  for update using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
    )
  ) with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
    )
  );

create policy "recipe_translations_member_delete" on public.recipe_translations
  for delete using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipes.update')
    )
  );
