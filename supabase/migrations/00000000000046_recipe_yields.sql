-- 046_recipe_yields
-- Phase 12: evolve the Phase-03 `recipe_yields` table (009) into the Yield /
-- Rendement engine (NEVER recreated — additive schema evolution + RLS + RBAC):
--
--   * one yield definition per recipe version (unique recipe_id),
--   * 5 models: exact_consumption / batch_yield / range_yield /
--     portion_yield / percentage_yield,
--   * input batch (quantity + unit) → output (quantity + unit), optional range
--     (min/standard/max) and yield_percentage for losses/processing,
--   * is_active toggle, notes, created_by/updated_by audit columns,
--   * permission-gated RLS (replaces the legacy 023 policies that used a
--     blanket `with check (true)`),
--   * new permission module `recipe_yields` (view/create/update/delete),
--   * demo yields for the Phase-11 espresso recipes.
--
-- NO stock movements, NO purchases, NO inventory writes: yield is pure
-- production math (input/standard) — consumption and production figures are
-- computed and displayed, never persisted.

-- ============================================================
-- 1) Schema evolution (column names preserved or added; unit_id → output_unit_id)
-- ============================================================
alter table public.recipe_yields
  add column if not exists yield_type text not null default 'exact_consumption',
  add column if not exists input_quantity numeric,
  add column if not exists input_unit_id uuid references public.units (id) on delete set null,
  add column if not exists output_quantity numeric,
  add column if not exists yield_percentage numeric,
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

-- The legacy `unit_id` was the yield output unit (cups/glasses/portions...).
-- Renaming keeps the table identity while making the columns self-describing.
alter table public.recipe_yields
  rename column unit_id to output_unit_id;

-- One yield definition per recipe VERSION (a recipe row IS a version).
alter table public.recipe_yields
  add constraint recipe_yields_unique_recipe unique (recipe_id);

create index if not exists idx_recipe_yields_active
  on public.recipe_yields (recipe_id, is_active);

-- ============================================================
-- 2) Constraints — per-model positivity + range ordering
-- ============================================================
alter table public.recipe_yields
  drop constraint if exists recipe_yields_min_check;

alter table public.recipe_yields
  add constraint recipe_yields_type_check check (
    yield_type in ('exact_consumption', 'batch_yield', 'range_yield',
                   'portion_yield', 'percentage_yield')
  );

alter table public.recipe_yields
  add constraint recipe_yields_input_check check (
    input_quantity is null or input_quantity > 0
  );

alter table public.recipe_yields
  add constraint recipe_yields_output_check check (
    output_quantity is null or output_quantity > 0
  );

alter table public.recipe_yields
  add constraint recipe_yields_standard_check check (
    standard_yield is null or standard_yield > 0
  );

alter table public.recipe_yields
  add constraint recipe_yields_percentage_check check (
    yield_percentage is null or (yield_percentage > 0 and yield_percentage <= 100)
  );

-- Legacy min ≤ max; the standard must sit inside [min, max] when both edges set.
alter table public.recipe_yields
  drop constraint if exists recipe_yields_order_check;

alter table public.recipe_yields
  add constraint recipe_yields_order_check check (
    (minimum_yield is null or maximum_yield is null) or minimum_yield <= maximum_yield
  );

alter table public.recipe_yields
  add constraint recipe_yields_standard_range_check check (
    not (
      (minimum_yield is not null and standard_yield is not null and standard_yield < minimum_yield)
      or (maximum_yield is not null and standard_yield is not null and standard_yield > maximum_yield)
    )
  );

-- The legacy non-unique index is superseded by the unique-constraint index.
drop index if exists idx_recipe_yields_recipe;

-- ============================================================
-- 3) RLS helper — forbid cross-establishment references
-- ============================================================
create or replace function public.recipe_yield_references_valid(
  p_establishment_id uuid,
  p_recipe_id uuid,
  p_input_unit_id uuid,
  p_output_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_recipe_id is null or exists (
      select 1 from public.recipes r
      where r.id = p_recipe_id
        and r.establishment_id = p_establishment_id))
    and (p_input_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_input_unit_id
        and (u.establishment_id = p_establishment_id or u.establishment_id is null)))
    and (p_output_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_output_unit_id
        and (u.establishment_id = p_establishment_id or u.establishment_id is null)));
$$;

-- ============================================================
-- 4) RLS — permission-gated (access inherited from the owning recipe)
-- ============================================================
drop policy if exists recipe_yields_read on public.recipe_yields;
drop policy if exists recipe_yields_write on public.recipe_yields;

create policy "recipe_yields_read" on public.recipe_yields
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and (is_super_admin() or belongs_to_establishment(r.establishment_id))
    )
  );

create policy "recipe_yields_member_insert" on public.recipe_yields
  for insert with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipe_yields.create')
        and recipe_yield_references_valid(
              r.establishment_id, recipe_id, input_unit_id, output_unit_id)
    )
  );

create policy "recipe_yields_member_update" on public.recipe_yields
  for update using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipe_yields.update')
    )
  ) with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipe_yields.update')
        and recipe_yield_references_valid(
              r.establishment_id, recipe_id, input_unit_id, output_unit_id)
    )
  );

create policy "recipe_yields_member_delete" on public.recipe_yields
  for delete using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and not r.is_system
        and has_permission(r.establishment_id, 'recipe_yields.delete')
    )
  );

-- ============================================================
-- 5) Permission catalog — module `recipe_yields`
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('recipe_yields.view',   'recipe_yields', 'Voir les rendements',     'Consulter le rendement d''une recette'),
  ('recipe_yields.create', 'recipe_yields', 'Créer un rendement',      'Définir le rendement d''une recette'),
  ('recipe_yields.update', 'recipe_yields', 'Modifier un rendement',   'Modifier le rendement d''une recette'),
  ('recipe_yields.delete', 'recipe_yields', 'Supprimer un rendement',  'Supprimer le rendement d''une recette')
on conflict (slug) do nothing;

-- ============================================================
-- 6) Role → permission matrix
-- ============================================================
do $$
declare
  v_super_admin uuid;
  v_admin       uuid;
  v_manager     uuid;
  v_stock       uuid;
  v_accountant  uuid;
  v_purchasing  uuid;
  v_kitchen     uuid;
  v_bar         uuid;
begin
  select id into v_super_admin from public.roles where code = 'super_admin' and is_system;
  select id into v_admin       from public.roles where code = 'admin' and is_system;
  select id into v_manager     from public.roles where code = 'manager' and is_system;
  select id into v_stock       from public.roles where code = 'stock_manager' and is_system;
  select id into v_accountant  from public.roles where code = 'accountant' and is_system;
  select id into v_purchasing  from public.roles where code = 'purchasing' and is_system;
  select id into v_kitchen     from public.roles where code = 'kitchen' and is_system;
  select id into v_bar         from public.roles where code = 'bar' and is_system;

  -- Super Admin + Admin: full catalog (same contract as migrations 027/045).
  insert into public.role_permissions (role_id, permission_id)
  select v_super_admin, p.id from public.permissions p
   where p.module = 'recipe_yields'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_admin, p.id from public.permissions p
   where p.module = 'recipe_yields'
  on conflict (role_id, permission_id) do nothing;

  -- Manager: full yield workflow (definition + tuning + deletion).
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
   where p.slug in ('recipe_yields.view', 'recipe_yields.create',
                    'recipe_yields.update', 'recipe_yields.delete')
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager / accountant / purchasing: read yields (cost support).
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id from public.permissions p
   where p.slug = 'recipe_yields.view'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id from public.permissions p
   where p.slug = 'recipe_yields.view'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id from public.permissions p
   where p.slug = 'recipe_yields.view'
  on conflict (role_id, permission_id) do nothing;

  -- Kitchen / bar: read yields (they already view recipes).
  insert into public.role_permissions (role_id, permission_id)
  select v_kitchen, p.id from public.permissions p
   where p.slug = 'recipe_yields.view'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_bar, p.id from public.permissions p
   where p.slug = 'recipe_yields.view'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 7) Demo yields — espresso recipes (043) with the shared recipe header sync
-- ============================================================
do $$
declare
  v_est  uuid := '00000000-0000-0000-0000-000000000001';
  v_kg   uuid;
  v_cup  uuid;
  v_r1   uuid;
  v_r2   uuid;
begin
  select id into v_kg  from public.units where establishment_id is null and slug = 'kg';
  select id into v_cup from public.units where establishment_id is null and slug = 'cup';

  select id into v_r1 from public.recipes
   where establishment_id = v_est and version = 1 and name = 'Espresso';
  select id into v_r2 from public.recipes
   where establishment_id = v_est and version = 2 and name = 'Espresso intensif';

  -- v1 (active/default): 1 kg of roasted coffee → 70 / 85 / 100 cups.
  insert into public.recipe_yields (
    recipe_id, yield_type, input_quantity, input_unit_id, output_unit_id,
    minimum_yield, standard_yield, maximum_yield, notes, is_active
  )
  select v_r1, 'range_yield', 1, v_kg, v_cup, 70, 85, 100,
         '1 kg de café torréfié produit entre 70 et 100 tasses (85 en moyenne).', true
    where v_r1 is not null and v_kg is not null and v_cup is not null
  on conflict (recipe_id) do nothing;

  -- v2 (draft): double dose → ~91 cups/kg (80 / 91 / 100).
  insert into public.recipe_yields (
    recipe_id, yield_type, input_quantity, input_unit_id, output_unit_id,
    minimum_yield, standard_yield, maximum_yield, notes, is_active
  )
  select v_r2, 'range_yield', 1, v_kg, v_cup, 80, 91, 100,
         'Dose double — environ 91 tasses par kilogramme.', true
    where v_r2 is not null and v_kg is not null and v_cup is not null
  on conflict (recipe_id) do nothing;

  -- Keep the Phase-11 recipe headers coherent with the yield engine.
  update public.recipes
     set yield_type = 'range_yield',
         default_yield = 85,
         yield_unit_id = v_cup
   where id = v_r1 and v_cup is not null;

  update public.recipes
     set yield_type = 'range_yield',
         default_yield = 91,
         yield_unit_id = v_cup
   where id = v_r2 and v_cup is not null;
end $$;