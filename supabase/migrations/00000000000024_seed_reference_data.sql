-- 024_seed_reference_data
-- Idempotent seed of reference data (locales, roles, units, conversions, taxes,
-- payment methods, default establishment + default settings).

-- ============================================================
-- Locales
-- ============================================================
insert into public.locales (code, name, native_name, rtl, sort_order) values
  ('fr', 'Français', 'Français', false, 1),
  ('en', 'English', 'English', false, 2),
  ('ar', 'Arabe', 'العربية', true, 3)
on conflict (code) do nothing;

-- ============================================================
-- Roles
-- ============================================================
insert into public.roles (code, name, description) values
  ('super_admin',  'Super Admin',           'Accès total, multi-établissement'),
  ('admin',        'Administrateur',        'Gestion complète de l''établissement'),
  ('manager',      'Gérant',                'Gestion opérationnelle'),
  ('cashier',      'Caissier',              'Encaissement'),
  ('waiter',       'Serveur',               'Prise de commandes'),
  ('kitchen',      'Cuisine',               'Préparation cuisine'),
  ('bar',          'Bar',                   'Préparation bar'),
  ('stock_manager','Gestionnaire de stock', 'Gestion des stocks'),
  ('purchasing',   'Achats',                'Gestion des achats'),
  ('accountant',   'Comptable',             'Comptabilité et rapports')
on conflict (code) do nothing;

-- ============================================================
-- Default establishment
-- ============================================================
do $$
declare
  v_est uuid;
  v_kg uuid;
  v_g  uuid;
  v_l  uuid;
  v_ml uuid;
  v_cl uuid;
  v_tva_default uuid;
begin
  -- Insert default establishment (idempotent).
  insert into public.establishments (id, name, legal_name, country, is_active)
  values ('00000000-0000-0000-0000-000000000001', 'Mon Café', 'Mon Café SARL', 'TN', true)
  on conflict (id) do nothing;

  v_est := '00000000-0000-0000-0000-000000000001';

  -- ============================================================
  -- Units (per-establishment, unique symbol via uq_units_establishment_symbol)
  -- ============================================================
  insert into public.units (establishment_id, name, symbol, category, precision) values
    (v_est, 'Kilogramme', 'kg', 'weight', 3),
    (v_est, 'Gramme',     'g',  'weight', 1),
    (v_est, 'Milligramme','mg', 'weight', 3),
    (v_est, 'Litre',      'L',  'volume', 3),
    (v_est, 'Millilitre', 'ml', 'volume', 1),
    (v_est, 'Centilitre', 'cl', 'volume', 1),
    (v_est, 'Pièce',      'pc', 'quantity', 0),
    (v_est, 'Bouteille',  'btl','packaging', 0),
    (v_est, 'Canette',    'can','packaging', 0),
    (v_est, 'Boîte',      'box','packaging', 0),
    (v_est, 'Tasse',      'cup','portion', 0),
    (v_est, 'Verre',      'glass','portion', 0),
    (v_est, 'Portion',    'portion','portion', 2)
  on conflict (establishment_id, symbol) do nothing;

  -- ============================================================
  -- Unit conversions (1 kg = 1000 g, 1 L = 1000 ml, 1 cl = 10 ml)
  -- ============================================================
  select id into v_kg from public.units where establishment_id = v_est and symbol = 'kg' limit 1;
  select id into v_g  from public.units where establishment_id = v_est and symbol = 'g'  limit 1;
  select id into v_l  from public.units where establishment_id = v_est and symbol = 'L'  limit 1;
  select id into v_ml from public.units where establishment_id = v_est and symbol = 'ml' limit 1;
  select id into v_cl from public.units where establishment_id = v_est and symbol = 'cl' limit 1;

  insert into public.unit_conversions (from_unit_id, to_unit_id, factor) values
    (v_kg, v_g,  1000),
    (v_l,  v_ml, 1000),
    (v_cl, v_ml, 10)
  on conflict (from_unit_id, to_unit_id) do nothing;

  -- ============================================================
  -- Taxes (configurable rates; never 19% hardcoded in the frontend)
  -- ============================================================
  insert into public.taxes (establishment_id, name, code, rate, is_default, is_active) values
    (v_est, 'TVA 0%',  'tva0',  0,  false, true),
    (v_est, 'TVA 7%',  'tva7',  7,  true,  true),
    (v_est, 'TVA 13%', 'tva13', 13, false, true),
    (v_est, 'TVA 19%', 'tva19', 19, false, true)
  on conflict (establishment_id, code) do nothing;

  -- ============================================================
  -- Payment methods
  -- ============================================================
  insert into public.payment_methods (establishment_id, name, code, type, is_active) values
    (v_est, 'Espèces',        'cash',          'cash',         true),
    (v_est, 'Carte bancaire', 'card',          'card',         true),
    (v_est, 'Virement',       'bank_transfer', 'bank_transfer', true),
    (v_est, 'Autre',          'other',         'other',        true)
  on conflict (establishment_id, code) do nothing;

  -- ============================================================
  -- Default settings (establishment-scoped)
  -- ============================================================
  insert into public.settings (establishment_id, key, value, type, group_name, is_public) values
    -- general
    (v_est, 'establishment.name',  'Mon Café', 'string', 'general', true),
    -- branding
    (v_est, 'branding.primary_color',   '#2563eb', 'color', 'branding', true),
    (v_est, 'branding.secondary_color', '#7c3aed', 'color', 'branding', true),
    (v_est, 'branding.accent_color',    '#f59e0b', 'color', 'branding', true),
    (v_est, 'branding.success_color',   '#16a34a', 'color', 'branding', true),
    (v_est, 'branding.warning_color',   '#d97706', 'color', 'branding', true),
    (v_est, 'branding.danger_color',    '#dc2626', 'color', 'branding', true),
    (v_est, 'branding.dark_mode',       'system',   'string', 'branding', true),
    -- localization
    (v_est, 'localization.default_locale',  'fr', 'string', 'localization', true),
    (v_est, 'localization.available_locales','["fr","en","ar"]', 'json', 'localization', true),
    (v_est, 'localization.timezone',        'Africa/Tunis', 'string', 'localization', true),
    (v_est, 'localization.date_format',     'DD/MM/YYYY',   'string', 'localization', true),
    (v_est, 'localization.time_format',     'HH:mm',        'string', 'localization', true),
    (v_est, 'localization.number_format',   'fr-TN',        'string', 'localization', true),
    (v_est, 'localization.first_day_of_week', '1',          'integer','localization', true),
    (v_est, 'localization.rtl_enabled',     'auto',         'string', 'localization', true),
    -- currency
    (v_est, 'currency.code',              'TND',  'string', 'currency', true),
    (v_est, 'currency.symbol',            'د.ت',  'string', 'currency', true),
    (v_est, 'currency.position',          'after','string', 'currency', true),
    (v_est, 'currency.decimal_places',    '3',    'integer','currency', true),
    (v_est, 'currency.thousand_separator',',',   'string', 'currency', true),
    (v_est, 'currency.decimal_separator', '.',    'string', 'currency', true),
    -- tax
    (v_est, 'tax.default_rate', '7', 'decimal', 'tax', true),
    -- pos
    (v_est, 'pos.allow_negative_stock', 'false', 'boolean', 'pos', false),
    (v_est, 'pos.require_order_confirmation', 'true', 'boolean', 'pos', false),
    (v_est, 'pos.allow_discount', 'true', 'boolean', 'pos', false),
    -- inventory
    (v_est, 'inventory.allow_negative_stock', 'false', 'boolean', 'inventory', false),
    (v_est, 'inventory.low_stock_threshold',  '5', 'integer', 'inventory', false),
    -- printing
    (v_est, 'printing.receipt_width', '80', 'integer', 'printing', false),
    (v_est, 'printing.show_tax',      'true', 'boolean', 'printing', false),
    (v_est, 'printing.show_server',   'true', 'boolean', 'printing', false),
    -- notifications
    (v_est, 'notifications.stock_alerts',    'true', 'boolean', 'notifications', false),
    (v_est, 'notifications.new_orders',      'true', 'boolean', 'notifications', false),
    (v_est, 'notifications.cash_register',   'true', 'boolean', 'notifications', false),
    (v_est, 'notifications.purchasing',      'true', 'boolean', 'notifications', false)
  on conflict (establishment_id, key) do nothing;

end $$;
