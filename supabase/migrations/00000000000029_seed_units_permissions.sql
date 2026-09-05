-- 029_seed_units_permissions
-- Idempotent seed of:
--   a) the global system-unit catalog (dimensions + base units) and the
--      system conversions between them (inverse/reverse are derived by the
--      conversion engine, never stored)
--   b) the permission catalog for units / unit_conversions and the default
--      matrices of the built-in roles

-- ============================================================
-- 1) System units (global, establishment_id = NULL)
-- ============================================================
do $$
declare
  v_kg uuid; v_g uuid; v_mg uuid;
  v_l uuid; v_cl uuid; v_ml uuid;
  v_piece uuid; v_cup uuid; v_glass uuid; v_bottle uuid;
begin
  -- Mass: base = g
  v_kg := (select id from public.units where establishment_id is null and symbol = 'kg');
  if v_kg is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Kilogram', 'kg', 'kilogram', 'mass', 'SI unite de masse', 3, false, true)
    returning id into v_kg;
  end if;

  v_g := (select id from public.units where establishment_id is null and symbol = 'g');
  if v_g is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Gram', 'g', 'gram', 'mass', 'Unite de base de masse', 2, true, true)
    returning id into v_g;
  end if;

  v_mg := (select id from public.units where establishment_id is null and symbol = 'mg');
  if v_mg is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Milligram', 'mg', 'milligram', 'mass', 'Milligramme', 3, false, true)
    returning id into v_mg;
  end if;

  -- Volume: base = ml
  v_l := (select id from public.units where establishment_id is null and symbol = 'L');
  if v_l is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Litre', 'L', 'litre', 'volume', 'Litre', 3, false, true)
    returning id into v_l;
  end if;

  v_cl := (select id from public.units where establishment_id is null and symbol = 'cl');
  if v_cl is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Centilitre', 'cl', 'centilitre', 'volume', 'Centilitre', 1, false, true)
    returning id into v_cl;
  end if;

  v_ml := (select id from public.units where establishment_id is null and symbol = 'ml');
  if v_ml is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Millilitre', 'ml', 'millilitre', 'volume', 'Unite de base de volume', 2, true, true)
    returning id into v_ml;
  end if;

  -- Count: base = piece
  v_piece := (select id from public.units where establishment_id is null and symbol = 'piece');
  if v_piece is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Piece', 'piece', 'piece', 'count', 'Unite de base de quantite', 0, true, true)
    returning id into v_piece;
  end if;

  -- Service
  v_cup := (select id from public.units where establishment_id is null and symbol = 'cup');
  if v_cup is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Cup', 'cup', 'cup', 'service', 'Service tasse', 0, false, true)
    returning id into v_cup;
  end if;

  v_glass := (select id from public.units where establishment_id is null and symbol = 'glass');
  if v_glass is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Glass', 'glass', 'glass', 'service', 'Service verre', 0, false, true)
    returning id into v_glass;
  end if;

  v_bottle := (select id from public.units where establishment_id is null and symbol = 'bottle');
  if v_bottle is null then
    insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
    values (null, 'Bottle', 'bottle', 'bottle', 'service', 'Service bouteille', 0, false, true)
    returning id into v_bottle;
  end if;

  -- ============================================================
  -- 2) System conversions (inverse directions are derived, not stored)
  -- ============================================================
  insert into public.unit_conversions (from_unit_id, to_unit_id, factor, offset_value, is_system, establishment_id, is_active)
  values
    (v_kg, v_g,  1000, 0, true, null, true),
    (v_g,  v_mg, 1000, 0, true, null, true),
    (v_l,  v_ml, 1000, 0, true, null, true),
    (v_cl, v_ml, 10,   0, true, null, true)
  on conflict (from_unit_id, to_unit_id) do nothing;
end $$;

-- ============================================================
-- 3) Permission catalog (slug is the stable key)
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('units.view',              'units',             'Voir les unités',        'Lister et consulter les unités'),
  ('units.create',            'units',             'Créer une unité',        'Créer des unités personnalisées'),
  ('units.update',            'units',             'Modifier une unité',     'Modifier des unités personnalisées'),
  ('units.delete',            'units',             'Supprimer une unité',    'Supprimer des unités personnalisées'),
  ('unit_conversions.view',   'unit_conversions',  'Voir les conversions',   'Lister et consulter les conversions'),
  ('unit_conversions.create', 'unit_conversions',  'Créer une conversion',   'Créer des conversions entre unités'),
  ('unit_conversions.update', 'unit_conversions',  'Modifier une conversion','Modifier des conversions'),
  ('unit_conversions.delete', 'unit_conversions',  'Supprimer une conversion','Supprimer des conversions')
on conflict (slug) do nothing;

-- ============================================================
-- 4) Default role -> permission matrix (idempotent)
-- ============================================================
do $$
declare
  v_super_admin uuid;
  v_admin uuid;
  v_manager uuid;
  v_stock uuid;
  v_purchasing uuid;
begin
  select id into v_super_admin from public.roles where code = 'super_admin';
  select id into v_admin        from public.roles where code = 'admin';
  select id into v_manager      from public.roles where code = 'manager';
  select id into v_stock        from public.roles where code = 'stock_manager';
  select id into v_purchasing   from public.roles where code = 'purchasing';

  -- Super Admin + Admin keep the full catalog (new permissions auto-attached).
  insert into public.role_permissions (role_id, permission_id)
  select v_super_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  -- Manager: full unit + conversion management.
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
  where p.slug in (
    'units.view', 'units.create', 'units.update', 'units.delete',
    'unit_conversions.view', 'unit_conversions.create',
    'unit_conversions.update', 'unit_conversions.delete'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager + purchasing: read-only access to units/conversions.
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id from public.permissions p
  where p.slug in ('units.view', 'unit_conversions.view')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id from public.permissions p
  where p.slug in ('units.view', 'unit_conversions.view')
  on conflict (role_id, permission_id) do nothing;
end $$;