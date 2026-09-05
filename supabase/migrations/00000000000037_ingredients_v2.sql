-- 037_ingredients_v2
-- Phase 10: evolve `ingredients` into the raw-materials model.
--   * rename is_stockable -> is_stock_tracked
--   * add slug, ingredient_type, purchase_quantity, purchase_cost,
--     waste_percentage, image_url, is_system, sort_order
--   * add ingredient_translations (fr master / en / ar) unique (ingredient_id, locale)
--   * replace the establishment-scoped RLS (023) with permission-gated policies
--     that also protect system ingredients and forbid cross-establishment refs.
--   * stock itself is NEVER stored on `ingredients` (only is_stock_tracked).

-- ============================================================
-- 1) Column evolution (additive + rename, no data loss)
-- ============================================================
alter table public.ingredients rename column is_stockable to is_stock_tracked;

alter table public.ingredients
  add column if not exists slug text,
  add column if not exists ingredient_type text not null default 'raw_material',
  add column if not exists purchase_quantity numeric not null default 1,
  add column if not exists purchase_cost numeric not null default 0,
  add column if not exists waste_percentage numeric not null default 0,
  add column if not exists image_url text,
  add column if not exists is_system boolean not null default false,
  add column if not exists sort_order integer not null default 10;

-- Backfill slugs for any pre-existing rows before the NOT NULL constraint.
do $$
declare
  v_row record;
  v_base text;
  v_slug text;
  v_taken integer;
begin
  for v_row in
    select id, name from public.ingredients where slug is null
  loop
    v_base := left(
      lower(regexp_replace(regexp_replace(v_row.name, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '')),
      80
    );
    if v_base = '' then
      v_base := 'ingredient';
    end if;
    v_slug := v_base;
    v_taken := 1;
    while v_taken > 0 loop
      select count(*) into v_taken
        from public.ingredients
       where establishment_id in (
         select establishment_id from public.ingredients where id = v_row.id
       )
         and slug = v_slug
         and id <> v_row.id;
      if v_taken > 0 then
        v_slug := v_base || '-' || (v_taken + 1);
      end if;
    end loop;
    update public.ingredients set slug = v_slug where id = v_row.id;
  end loop;
end $$;

alter table public.ingredients alter column slug set not null;

-- Domain constraints for the new purchasing fields.
alter table public.ingredients
  add constraint ingredients_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );
alter table public.ingredients
  add constraint ingredients_type_check check (
    ingredient_type in ('raw_material', 'semi_finished', 'packaged', 'consumable', 'other')
  );
alter table public.ingredients
  add constraint ingredients_purchase_quantity_check check (purchase_quantity > 0);
alter table public.ingredients
  add constraint ingredients_purchase_cost_check check (purchase_cost >= 0);
alter table public.ingredients
  add constraint ingredients_waste_check check (waste_percentage >= 0 and waste_percentage <= 100);

-- ============================================================
-- 2) Indexes for selectors and availability
-- ============================================================
create unique index if not exists uq_ingredients_establishment_slug
  on public.ingredients (establishment_id, slug);
create index if not exists idx_ingredients_name_lower
  on public.ingredients (lower(name));
create index if not exists idx_ingredients_category_sort
  on public.ingredients (category_id, sort_order);
create index if not exists idx_ingredients_type
  on public.ingredients (ingredient_type);
create index if not exists idx_ingredients_stock_tracked
  on public.ingredients (is_stock_tracked);
create index if not exists idx_ingredients_is_active
  on public.ingredients (is_active);

-- ============================================================
-- 3) ingredient_translations
-- ============================================================
create table if not exists public.ingredient_translations (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  locale text not null check (locale in ('fr', 'en', 'ar')),
  name text not null check (name <> ''),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_ingredient_translations_ingredient_locale
  on public.ingredient_translations (ingredient_id, locale);
create index if not exists idx_ingredient_translations_locale
  on public.ingredient_translations (locale);

create trigger trg_ingredient_translations_updated_at
  before update on public.ingredient_translations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4) RLS helper: forbid cross-establishment references
--    (a category of the same establishment; units of the same
--     establishment or system units)
-- ============================================================
create or replace function public.ingredient_references_valid(
  p_establishment_id uuid,
  p_category_id uuid,
  p_base_unit_id uuid,
  p_purchase_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_category_id is null or exists (
      select 1 from public.categories c
      where c.id = p_category_id
        and c.establishment_id = p_establishment_id))
    and (p_base_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_base_unit_id
        and (u.establishment_id = p_establishment_id
             or u.establishment_id is null)))
    and (p_purchase_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_purchase_unit_id
        and (u.establishment_id = p_establishment_id
             or u.establishment_id is null)));
$$;

-- ============================================================
-- 5) System-ingredient protection trigger
-- ============================================================
create or replace function public.protect_system_ingredients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_ingredient_protected';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_ingredient_protected';
    end if;
    return old;
  end if;

  if old.is_system
     and (
       new.is_system is distinct from old.is_system
       or new.slug is distinct from old.slug
       or new.establishment_id is distinct from old.establishment_id
     )
     and auth.uid() is not null
     and not is_super_admin() then
    raise exception 'system_ingredient_protected';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ingredients_protect_system on public.ingredients;
create trigger trg_ingredients_protect_system
  before insert or update or delete on public.ingredients
  for each row
  execute function public.protect_system_ingredients();

-- ============================================================
-- 6) RLS — ingredients
-- ============================================================
drop policy if exists ingredients_read on public.ingredients;
drop policy if exists ingredients_write on public.ingredients;

create policy "ingredients_read" on public.ingredients
  for select using (
    is_super_admin()
    or belongs_to_establishment(establishment_id)
  );

create policy "ingredients_member_insert" on public.ingredients
  for insert with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'ingredients.create')
      and ingredient_references_valid(
            establishment_id, category_id, base_unit_id, purchase_unit_id)
    )
  );

create policy "ingredients_member_update" on public.ingredients
  for update using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'ingredients.update')
    )
  ) with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'ingredients.update')
      and ingredient_references_valid(
            establishment_id, category_id, base_unit_id, purchase_unit_id)
    )
  );

create policy "ingredients_member_delete" on public.ingredients
  for delete using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'ingredients.delete')
    )
  );

-- ============================================================
-- 7) RLS — ingredient_translations (access inherited from the ingredient)
-- ============================================================
alter table public.ingredient_translations enable row level security;

create policy "ingredient_translations_read" on public.ingredient_translations
  for select using (
    is_super_admin()
    or exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and belongs_to_establishment(i.establishment_id)
    )
  );

create policy "ingredient_translations_member_insert" on public.ingredient_translations
  for insert with check (
    is_super_admin()
    or exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and not i.is_system
        and has_permission(i.establishment_id, 'ingredients.create')
    )
  );

create policy "ingredient_translations_member_update" on public.ingredient_translations
  for update using (
    is_super_admin()
    or exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and not i.is_system
        and has_permission(i.establishment_id, 'ingredients.update')
    )
  ) with check (
    is_super_admin()
    or exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and not i.is_system
        and has_permission(i.establishment_id, 'ingredients.update')
    )
  );

create policy "ingredient_translations_member_delete" on public.ingredient_translations
  for delete using (
    is_super_admin()
    or exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and not i.is_system
        and has_permission(i.establishment_id, 'ingredients.update')
    )
  );