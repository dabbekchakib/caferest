-- 031_seed_categories_permissions
-- Idempotent seed of:
--   * the default (demo) root system categories for the default establishment
--   * the categories permission catalog
--   * the default role -> permission matrix entries for built-in roles

-- ============================================================
-- Permission catalog (slug is the stable key referenced in the app)
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('categories.view',    'categories', 'Voir les catégories',    'Consulter les catégories et sous-catégories'),
  ('categories.create',  'categories', 'Créer une catégorie',    'Créer des catégories et sous-catégories'),
  ('categories.update',  'categories', 'Modifier une catégorie', 'Modifier les catégories, leurs traductions et leur statut'),
  ('categories.delete',  'categories', 'Supprimer une catégorie','Supprimer des catégories inutilisées'),
  ('categories.reorder', 'categories', 'Réorganiser les catégories', 'Réordonner et déplacer les catégories')
on conflict (slug) do nothing;

-- ============================================================
-- Default role -> permission matrix (additive, idempotent)
--   manager        : full category management
--   stock_manager  : read-only
--   purchasing     : read-only
-- (super_admin/admin hold the whole catalog automatically)
-- ============================================================
do $$
declare
  v_manager      uuid;
  v_stock        uuid;
  v_purchasing   uuid;
begin
  select id into v_manager    from public.roles where code = 'manager';
  select id into v_stock      from public.roles where code = 'stock_manager';
  select id into v_purchasing from public.roles where code = 'purchasing';

  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
  where p.slug in (
    'categories.view', 'categories.create', 'categories.update',
    'categories.delete', 'categories.reorder'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id from public.permissions p
  where p.slug = 'categories.view'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id from public.permissions p
  where p.slug = 'categories.view'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- Default root system categories (default establishment only;
-- mirrors the "Boissons / Cuisine / Snacking" structure).
-- ============================================================
do $$
declare
  v_est uuid;
  v_id  uuid;
begin
  select id into v_est
  from public.establishments
  where id = '00000000-0000-0000-0000-000000000001'
  limit 1;

  if v_est is null then
    return;
  end if;

  -- Boissons
  insert into public.categories
    (establishment_id, parent_id, name, slug, description, icon, color, sort_order, is_active, is_system)
  values
    (v_est, null, 'Boissons', 'boissons', 'Boissons chaudes et froides.', 'cup-soda', '#2563eb', 1, true, true)
  on conflict (establishment_id, slug) do nothing;

  select id into v_id
  from public.categories
  where establishment_id = v_est and slug = 'boissons'
  limit 1;
  insert into public.category_translations (category_id, locale, name, description) values
    (v_id, 'fr', 'Boissons', 'Boissons chaudes et froides.'),
    (v_id, 'en', 'Drinks',   'Hot and cold drinks.'),
    (v_id, 'ar', 'المشروبات', 'المشروبات الساخنة والباردة.')
  on conflict (category_id, locale) do nothing;

  -- Cuisine
  insert into public.categories
    (establishment_id, parent_id, name, slug, description, icon, color, sort_order, is_active, is_system)
  values
    (v_est, null, 'Cuisine', 'cuisine', 'Plats salés et préparations chaudes.', 'cooking-pot', '#16a34a', 2, true, true)
  on conflict (establishment_id, slug) do nothing;

  select id into v_id
  from public.categories
  where establishment_id = v_est and slug = 'cuisine'
  limit 1;
  insert into public.category_translations (category_id, locale, name, description) values
    (v_id, 'fr', 'Cuisine', 'Plats salés et préparations chaudes.'),
    (v_id, 'en', 'Kitchen', 'Savory dishes and hot preparations.'),
    (v_id, 'ar', 'مطبخ',  'الأطباق المالحة والتحضيرات الساخنة.')
  on conflict (category_id, locale) do nothing;

  -- Snacking
  insert into public.categories
    (establishment_id, parent_id, name, slug, description, icon, color, sort_order, is_active, is_system)
  values
    (v_est, null, 'Snacking', 'snacking', 'Sandwichs, pizzas et burgers.', 'sandwich', '#f59e0b', 3, true, true)
  on conflict (establishment_id, slug) do nothing;

  select id into v_id
  from public.categories
  where establishment_id = v_est and slug = 'snacking'
  limit 1;
  insert into public.category_translations (category_id, locale, name, description) values
    (v_id, 'fr', 'Snacking', 'Sandwichs, pizzas et burgers.'),
    (v_id, 'en', 'Snacks',   'Sandwiches, pizzas and burgers.'),
    (v_id, 'ar', 'وجبات خفيفة', 'سندويشات وبيتزا وبرغر.')
  on conflict (category_id, locale) do nothing;
end $$;