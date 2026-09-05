-- 038_seed_ingredients_permissions
-- Extends the Phase 10 ingredient permissions:
--   ingredients.update-cost, ingredients.update-status, ingredients.reorder
-- and completes the matrices of the built-in roles.
--
-- Already seeded by migration 027 (unchanged here):
--   ingredients.view, ingredients.create, ingredients.update, ingredients.delete

insert into public.permissions (slug, module, name, description) values
  ('ingredients.update-cost',   'ingredients', 'Update ingredient purchase cost', 'Modifier le coût d''achat des ingrédients'),
  ('ingredients.update-status', 'ingredients', 'Update ingredient status',       'Changer le statut des ingrédients'),
  ('ingredients.reorder',       'ingredients', 'Reorder ingredients',            'Réordonner les ingrédients')
on conflict (slug) do nothing;

do $$
declare
  v_manager    uuid;
  v_stock      uuid;
  v_accountant uuid;
  v_cashier    uuid;
begin
  select id into v_manager    from public.roles where code = 'manager';
  select id into v_stock      from public.roles where code = 'stock_manager';
  select id into v_accountant from public.roles where code = 'accountant';
  select id into v_cashier    from public.roles where code = 'cashier';

  -- Manager / stock_manager: full ingredient management on top of the
  -- existing view/create/update/delete.
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id
    from public.permissions p
   where p.slug in ('ingredients.update-cost', 'ingredients.update-status', 'ingredients.reorder')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id
    from public.permissions p
   where p.slug in ('ingredients.update-cost', 'ingredients.update-status', 'ingredients.reorder')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: read the catalog and update purchase costs (no creates).
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug in ('ingredients.view', 'ingredients.update-cost')
  on conflict (role_id, permission_id) do nothing;

  -- Cashier: read-only access to the ingredient catalog.
  insert into public.role_permissions (role_id, permission_id)
  select v_cashier, p.id
    from public.permissions p
   where p.slug = 'ingredients.view'
  on conflict (role_id, permission_id) do nothing;
end $$;