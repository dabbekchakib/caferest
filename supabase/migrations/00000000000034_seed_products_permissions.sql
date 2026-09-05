-- 034_seed_products_permissions
-- Extends the Phase 09 product permissions:
--   products.update-price, products.update-status, products.reorder
-- and completes the matrices of the built-in roles.

insert into public.permissions (slug, module, name, description) values
  ('products.update-price',  'products', 'Update product pricing', 'Modifier les prix des produits'),
  ('products.update-status', 'products', 'Update product status',  'Changer le statut et la disponibilité des produits'),
  ('products.reorder',       'products', 'Reorder products',      'Réordonner les produits du catalogue')
on conflict (slug) do nothing;

do $$
declare
  v_manager    uuid;
  v_cashier    uuid;
  v_accountant uuid;
begin
  select id into v_manager    from public.roles where code = 'manager';
  select id into v_cashier    from public.roles where code = 'cashier';
  select id into v_accountant from public.roles where code = 'accountant';

  -- Manager: pricing, status and reorder on top of the existing view/create/update/delete.
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id
    from public.permissions p
   where p.slug in ('products.update-price', 'products.update-status', 'products.reorder')
  on conflict (role_id, permission_id) do nothing;

  -- Cashier / accountant: read-only access to the catalog.
  insert into public.role_permissions (role_id, permission_id)
  select v_cashier, p.id
    from public.permissions p
   where p.slug = 'products.view'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug = 'products.view'
  on conflict (role_id, permission_id) do nothing;
end $$;