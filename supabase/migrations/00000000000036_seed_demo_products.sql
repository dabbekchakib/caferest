-- 036_seed_demo_products
-- Idempotent demo catalog for the default establishment (Mon Café).
-- Pure reference data: safe by key (establishment_id, slug); never touches
-- other establishments. Categories are the system roots from 031, units are
-- the global system units from 029, taxes are the establishment rates from 024.

do $$
declare
  v_est uuid := '00000000-0000-0000-0000-000000000001';
  v_boissons uuid;
  v_cuisine  uuid;
  v_snacking uuid;
  v_cup uuid;
  v_glass uuid;
  v_bottle uuid;
  v_piece uuid;
  v_tva0  uuid;
  v_tva7  uuid;
  v_tva19 uuid;
begin
  select id into v_boissons from public.categories
   where establishment_id = v_est and slug = 'boissons';
  select id into v_cuisine from public.categories
   where establishment_id = v_est and slug = 'cuisine';
  select id into v_snacking from public.categories
   where establishment_id = v_est and slug = 'snacking';

  -- Global system units (establishment_id IS NULL).
  select id into v_cup   from public.units where establishment_id is null and slug = 'cup';
  select id into v_glass from public.units where establishment_id is null and slug = 'glass';
  select id into v_bottle from public.units where establishment_id is null and slug = 'bottle';
  select id into v_piece from public.units where establishment_id is null and slug = 'piece';

  select id into v_tva0  from public.taxes where establishment_id = v_est and code = 'tva0';
  select id into v_tva7  from public.taxes where establishment_id = v_est and code = 'tva7';
  select id into v_tva19 from public.taxes where establishment_id = v_est and code = 'tva19';

  -- ============================================================
  -- Products (keyed by establishment_id + slug)
  -- ============================================================
  insert into public.products (
    establishment_id, category_id, name, slug, sku, barcode, product_type,
    unit_id, tax_id, price, cost, sort_order, image_url,
    is_active, is_available, is_featured, is_pos_enabled, is_stock_tracked, is_system
  )
  select v_est,
         case p.category when 'boissons' then v_boissons
                         when 'cuisine'  then v_cuisine
                         when 'snacking' then v_snacking end,
         p.name, p.slug, p.sku, p.barcode, p.product_type,
         case p.unit when 'cup'   then v_cup
                     when 'glass' then v_glass
                     when 'bottle' then v_bottle
                     when 'piece' then v_piece end,
         case p.tax when 'tva0'   then v_tva0
                    when 'tva7'   then v_tva7
                    when 'tva19'  then v_tva19 end,
         p.price, p.cost, p.sort_order, null,
         true, p.is_available, p.is_featured, p.is_pos_enabled, p.is_stock_tracked, false
    from (values
      ('Espresso',              'espresso',        'CAF-ESP-001',   '6291041500015', 'product',   'boissons', 'cup',    'tva7',  2.200, 0.400, 10,  true, false, true,  false),
      ('Café au lait',          'cafe-au-lait',    'CAF-LAIT-001',  '6291041500022', 'product',   'boissons', 'cup',    'tva7',  4.500, 0.700, 20,  true, false, true,  false),
      ('Cappuccino',            'cappuccino',      'CAF-CAPP-001',  '6291041500039', 'product',   'boissons', 'cup',    'tva7',  5.000, 0.800, 30,  true, true,  true,  false),
      ('Thé à la menthe',       'the-a-la-menthe', 'BOI-THE-010',   '6291041500046', 'product',   'boissons', 'glass',  'tva7',  3.000, 0.500, 40,  true, false, true,  false),
      ('Jus d''orange',         'jus-d-orange',    'BOI-JUS-020',   '6291041500053', 'product',   'boissons', 'glass',  'tva0',  6.000, 1.500, 50,  true, false, true,  false),
      ('Mojito',                'mojito',          'CKT-MOJ-001',   '6291041500060', 'composite', 'boissons', 'glass',  'tva19', 12.000, 3.200, 60,  true, false, true,  false),
      ('Eau minérale 0.5 L',    'eau-minerale-05l','BOI-EAU-050',   '6291041500077', 'product',   'boissons', 'bottle', 'tva7',  1.500, 0.450, 70,  true, false, true,  false),
      ('Croissant',             'croissant',       'PAT-CRO-001',   '6291041500084', 'product',   'snacking', 'piece',  'tva19', 1.200, 0.350, 10,  true, false, false, false),
      ('Sandwich au thon',      'sandwich-thon',   'CUI-SAN-001',   '6291041500091', 'composite', 'cuisine',  'piece',  'tva19', 8.500, 2.600, 10,  true, true,  false, false),
      ('Service livraison',     'service-livraison','SRV-LIV-001',  '6291041500107', 'service',   null,       'piece',  'tva19', 5.000, 0,     10,  true, false, true,  false)
    ) as p(name, slug, sku, barcode, product_type, category, unit, tax, price, cost, sort_order,
           is_available, is_featured, is_pos_enabled, is_stock_tracked)
  on conflict (establishment_id, slug) do nothing;

  -- ============================================================
  -- Translations (name / short_description / description per locale)
  -- ============================================================
  insert into public.product_translations (product_id, locale, name, short_description, description)
  select pr.id, x.locale, x.name, x.short_description, x.description
    from (values
      ('espresso', 'fr', 'Espresso',         NULL, 'Café espresso court et intense.'),
      ('espresso', 'en', 'Espresso',         NULL, 'Short and intense espresso coffee.'),
      ('espresso', 'ar', 'إسبريسو',           NULL, 'قهوة إسبريسو قصيرة ومركّزة.'),

      ('cafe-au-lait', 'fr', 'Café au lait',    NULL, 'Café allongé avec du lait chaud.'),
      ('cafe-au-lait', 'en', 'Coffee with milk',NULL, 'Long coffee topped with hot milk.'),
      ('cafe-au-lait', 'ar', 'قهوة بالحليب',     NULL, 'قهوة طويلة مع حليب ساخن.'),

      ('cappuccino', 'fr', 'Cappuccino',      NULL, 'Espresso, lait vapeur et mousse de lait.'),
      ('cappuccino', 'en', 'Cappuccino',      NULL, 'Espresso, steamed milk and milk foam.'),
      ('cappuccino', 'ar', 'كابتشينو',         NULL, 'إسبريسو مع حليب مبخّر ورغوة الحليب.'),

      ('the-a-la-menthe', 'fr', 'Thé à la menthe', NULL, 'Thé vert infusé à la menthe fraîche.'),
      ('the-a-la-menthe', 'en', 'Mint tea',        NULL, 'Green tea infused with fresh mint.'),
      ('the-a-la-menthe', 'ar', 'شاي بالنعناع',    NULL, 'شاي أخضر منقوع بالنعناع الطازج.'),

      ('jus-d-orange', 'fr', 'Jus d''orange',  NULL, 'Jus d''orange pressée.'),
      ('jus-d-orange', 'en', 'Orange juice',   NULL, 'Freshly squeezed orange juice.'),
      ('jus-d-orange', 'ar', 'عصير برتقال',    NULL, 'عصير برتقال طازج.'),

      ('mojito', 'fr', 'Mojito',              NULL, 'Cocktail à base de rhum, menthe et citron vert.'),
      ('mojito', 'en', 'Mojito',              NULL, 'Rhum, fresh mint and lime cocktail.'),
      ('mojito', 'ar', 'موخيتو',               NULL, 'كوكتيل من الروم والنعناع والليمون.'),

      ('eau-minerale-05l', 'fr', 'Eau minérale 0.5 L', NULL, 'Bouteille d''eau minérale gazeuse 0,5 L.'),
      ('eau-minerale-05l', 'en', 'Mineral water 0.5 L', NULL, 'Sparkling mineral water bottle 0.5 L.'),
      ('eau-minerale-05l', 'ar', 'مياه معدنية 0.5 لتر', NULL, 'قنينة مياه معدنية غازية 0.5 لتر.'),

      ('croissant', 'fr', 'Croissant',          NULL, 'Viennoiserie au beurre.'),
      ('croissant', 'en', 'Croissant',          NULL, 'Butter croissant.'),
      ('croissant', 'ar', 'كرواسون',            NULL, 'معجّنة بالزبدة.'),

      ('sandwich-thon', 'fr', 'Sandwich au thon', NULL, 'Thon, œuf et crudités en baguette.'),
      ('sandwich-thon', 'en', 'Tuna sandwich',     NULL, 'Tuna, egg and fresh vegetables baguette.'),
      ('sandwich-thon', 'ar', 'ساندويتش تونة',     NULL, 'تونة وبيض وخضروات طازجة في باغيت.'),

      ('service-livraison', 'fr', 'Service livraison', NULL, 'Frais de livraison à domicile.'),
      ('service-livraison', 'en', 'Delivery service',   NULL, 'Home delivery fee.'),
      ('service-livraison', 'ar', 'خدمة التوصيل',       NULL, 'رسوم التوصيل إلى المنزل.')
    ) as x(slug, locale, name, short_description, description)
    join public.products pr on pr.establishment_id = v_est and pr.slug = x.slug
  on conflict (product_id, locale) do nothing;
end $$;