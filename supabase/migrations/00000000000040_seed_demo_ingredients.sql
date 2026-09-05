-- 040_seed_demo_ingredients
-- Idempotent demo raw-material catalog for the default establishment (Mon Café).
-- Pure reference data: safe by key (establishment_id, slug); never touches
-- other establishments. Categories are the system roots from 031, units are
-- the global system units from 029 (kg/g/L/ml/piece). Purchase configs use the
-- same unit for base and purchase so the cost-per-base-unit is exact, e.g.
-- 70 TND/kg of coffee -> 0.070 TND/g via the system kg<->g conversion.

do $$
declare
  v_est   uuid := '00000000-0000-0000-0000-000000000001';
  v_boissons uuid;
  v_cuisine  uuid;
  v_kg uuid; v_l uuid; v_piece uuid;
begin
  select id into v_boissons from public.categories
   where establishment_id = v_est and slug = 'boissons';
  select id into v_cuisine from public.categories
   where establishment_id = v_est and slug = 'cuisine';

  -- Global system units (establishment_id IS NULL).
  select id into v_kg    from public.units where establishment_id is null and slug = 'kilogram';
  select id into v_l     from public.units where establishment_id is null and slug = 'litre';
  select id into v_piece from public.units where establishment_id is null and slug = 'piece';

  -- ============================================================
  -- Ingredients (keyed by establishment_id + slug)
  -- ============================================================
  insert into public.ingredients (
    establishment_id, category_id, name, slug, sku, barcode, description,
    ingredient_type, base_unit_id, purchase_unit_id, purchase_quantity,
    purchase_cost, waste_percentage, sort_order,
    is_active, is_stock_tracked, is_system
  )
  select v_est,
         case x.category when 'boissons' then v_boissons
                         when 'cuisine'  then v_cuisine end,
         x.name, x.slug, x.sku, x.barcode, x.description,
         x.ingredient_type,
         case x.unit when 'kg' then v_kg
                     when 'L'  then v_l
                     when 'piece' then v_piece end,
         case x.unit when 'kg' then v_kg
                     when 'L'  then v_l
                     when 'piece' then v_piece end,
         x.purchase_quantity, x.purchase_cost, x.waste_percentage, x.sort_order,
         true, x.is_stock_tracked, false
    from (values
      ('Café en grains',  'cafe-en-grains',  'ING-CAF-001',  '6291041600012', 'raw_material', 'boissons', 'kg',    1,  70.000,  2,  true,  10, 'Café vert ou torréfié en grains.'),
      ('Lait',            'lait',            'ING-CRE-001',  '6291041600029', 'raw_material', 'cuisine',  'L',     1,   1.200,  0,  true,  20, 'Lait entier frais.'),
      ('Sucre',           'sucre',           'ING-SUC-001',  '6291041600036', 'raw_material', 'cuisine',  'kg',    1,   2.500,  0,  true,  30, 'Sucre blanc en poudre.'),
      ('Citron',          'citron',          'ING-AGR-001',  '6291041600043', 'raw_material', 'cuisine',  'piece', 1,   0.300,  5,  true,  40, 'Citron jaune frais.'),
      ('Orange',          'orange',          'ING-AGR-002',  '6291041600050', 'raw_material', 'boissons', 'piece', 1,   0.500,  5,  true,  50, 'Orange fraîche à jus.'),
      ('Menthe',          'menthe',          'ING-AGR-003',  '6291041600067', 'raw_material', 'cuisine',  'piece', 1,   0.800, 10,  true,  60, 'Botte de menthe fraîche.'),
      ('Rhum',            'rhum',            'ING-ALC-001',  '6291041600074', 'raw_material', 'boissons', 'L',     1,  25.000,  0,  true,  70, 'Rhum blanc.'),
      ('Sirop de sucre',  'sirop-de-sucre',  'ING-SUC-002',  '6291041600081', 'packaged',     'boissons', 'L',     1,   3.500,  0,  true,  80, 'Sirop de sucre liquide.'),
      ('Eau',             'eau',             'ING-EAU-001',  '6291041600098', 'raw_material', 'boissons', 'L',     1,   0.300,  0,  true,  90, 'Eau de source.'),
      ('Glace',           'glace',           'ING-GLA-001',  '6291041600104', 'raw_material', 'cuisine',  'kg',    1,   1.000, 15,  false, 100, 'Glaçons en morceaux.')
    ) as x(name, slug, sku, barcode, ingredient_type, category, unit,
            purchase_quantity, purchase_cost, waste_percentage, is_stock_tracked,
            sort_order, description)
  on conflict (establishment_id, slug) do nothing;

  -- ============================================================
  -- Translations (name / description per locale)
  -- ============================================================
  insert into public.ingredient_translations (ingredient_id, locale, name, description)
  select i.id, x.locale, x.name, x.description
    from (values
      ('cafe-en-grains', 'fr', 'Café en grains',    'Café vert ou torréfié en grains.'),
      ('cafe-en-grains', 'en', 'Coffee beans',      'Green or roasted coffee beans.'),
      ('cafe-en-grains', 'ar', 'حبوب القهوة',        'حبوب قهوة خضراء أو محمّصة.'),

      ('lait', 'fr', 'Lait',    'Lait entier frais.'),
      ('lait', 'en', 'Milk',    'Fresh whole milk.'),
      ('lait', 'ar', 'حليب',     'حليب طازج كامل الدسم.'),

      ('sucre', 'fr', 'Sucre',       'Sucre blanc en poudre.'),
      ('sucre', 'en', 'Sugar',       'White granulated sugar.'),
      ('sucre', 'ar', 'سكر',          'سكر أبيض حبيبات.'),

      ('citron', 'fr', 'Citron',    'Citron jaune frais.'),
      ('citron', 'en', 'Lemon',     'Fresh yellow lemon.'),
      ('citron', 'ar', 'ليمون',      'ليمون أصفر طازج.'),

      ('orange', 'fr', 'Orange',    'Orange fraîche à jus.'),
      ('orange', 'en', 'Orange',    'Fresh juice orange.'),
      ('orange', 'ar', 'برتقال',     'برتقال طازج للعصير.'),

      ('menthe', 'fr', 'Menthe',            'Botte de menthe fraîche.'),
      ('menthe', 'en', 'Fresh mint',        'Fresh mint bunch.'),
      ('menthe', 'ar', 'نعناع طازج',         'حزمة نعناع طازج.'),

      ('rhum', 'fr', 'Rhum',    'Rhum blanc.'),
      ('rhum', 'en', 'Rum',     'White rum.'),
      ('rhum', 'ar', 'روم',      'روم أبيض.'),

      ('sirop-de-sucre', 'fr', 'Sirop de sucre',  'Sirop de sucre liquide.'),
      ('sirop-de-sucre', 'en', 'Sugar syrup',     'Liquid sugar syrup.'),
      ('sirop-de-sucre', 'ar', 'شراب السكر',       'شراب سكر سائل.'),

      ('eau', 'fr', 'Eau',    'Eau de source.'),
      ('eau', 'en', 'Water',  'Spring water.'),
      ('eau', 'ar', 'ماء',     'مياه نبع.'),

      ('glace', 'fr', 'Glace',        'Glaçons en morceaux.'),
      ('glace', 'en', 'Ice cubes',    'Ice cubes in pieces.'),
      ('glace', 'ar', 'ثلج',           'مكعبات ثلج.')
    ) as x(slug, locale, name, description)
    join public.ingredients i on i.establishment_id = v_est and i.slug = x.slug
  on conflict (ingredient_id, locale) do nothing;
end $$;