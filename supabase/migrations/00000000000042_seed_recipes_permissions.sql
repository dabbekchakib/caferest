-- 042_seed_recipes_permissions
-- Extends the recipe permission catalog with the Phase-11 workflow actions
-- and completes the matrices of the built-in roles.
--
-- Already seeded by migration 027 (unchanged here):
--   recipes.view, recipes.create, recipes.update, recipes.delete
--
-- New workflow slugs:
--   recipes.activate  -> draft/inactive -> active, set the active default
--   recipes.archive   -> move to archived (soft delete; never reused)
--   recipes.cost-view -> read raw costing output (ingredient cost data)

insert into public.permissions (slug, module, name, description) values
  ('recipes.activate',  'recipes', 'Activate recipes',         'Activer une recette'),
  ('recipes.archive',   'recipes', 'Archive recipes',          'Archiver une recette'),
  ('recipes.cost-view', 'recipes', 'View recipe cost',         'Consulter le coût des recettes')
on conflict (slug) do nothing;

do $$
declare
  v_manager    uuid;
  v_stock      uuid;
  v_accountant uuid;
  v_purchasing uuid;
begin
  select id into v_manager    from public.roles where code = 'manager';
  select id into v_stock      from public.roles where code = 'stock_manager';
  select id into v_accountant from public.roles where code = 'accountant';
  select id into v_purchasing from public.roles where code = 'purchasing';

  -- Manager: full recipe workflow on top of the existing view/create/update/delete.
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id
    from public.permissions p
   where p.slug in ('recipes.activate', 'recipes.archive', 'recipes.cost-view')
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager: manage the recipe catalog + the cost view.
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id
    from public.permissions p
   where p.slug in ('recipes.view', 'recipes.cost-view')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: view recipes and their raw costs (no edits).
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug in ('recipes.view', 'recipes.cost-view')
  on conflict (role_id, permission_id) do nothing;

  -- Purchasing: view recipes and their raw costs (sourcing support).
  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id
    from public.permissions p
   where p.slug in ('recipes.view', 'recipes.cost-view')
  on conflict (role_id, permission_id) do nothing;
end $$;