-- 044_fix_demo_reference_units
-- Repairs Phase-10/11 demo reference data that silently no-opped on deployed
-- databases because the unit lookups used non-existent slugs:
--   * 040_seed_demo_ingredients resolved 'kilogram'/'litre'/'piece' but the
--     global system units carry symbol slugs ('kg'/'l'/'pc' after 028),
--     leaving every demo ingredient with NULL base/purchase units.
--   * 043_seed_demo_recipes was gated on a 'gram' slug (no-op); the demo
--     recipes were therefore never seeded.
-- This migration converges fresh and existing environments to the same data.
-- Idempotent: keyed on (establishment_id, slug) / (establishment_id,
-- product_id, version); guarded on the system-unit references.

do $$
declare
  v_est uuid := '00000000-0000-0000-0000-000000000001';
  v_kg uuid; v_g uuid; v_l uuid; v_ml uuid; v_pc uuid;
  v_espresso uuid;
  v_cafe uuid;
  v_r1 uuid := null;
  v_r2 uuid := null;
begin
  -- Global system units (slug = symbol since 028_units_v2).
  select id into v_kg from public.units where establishment_id is null and slug = 'kg';
  select id into v_g  from public.units where establishment_id is null and slug = 'g';
  select id into v_l  from public.units where establishment_id is null and slug = 'l';
  select id into v_ml from public.units where establishment_id is null and slug = 'ml';
  select id into v_pc from public.units where establishment_id is null and slug = 'pc';

  -- --------------------------------------------------------------------
  -- 1) Repair the demo ingredient purchase/base units.
  --    Mass: base g / purchase kg; volume: base ml / purchase l; count: pc.
  -- --------------------------------------------------------------------
  if v_kg is not null and v_g is not null and v_l is not null
     and v_ml is not null and v_pc is not null then
    update public.ingredients i
       set base_unit_id = x.base_unit,
           purchase_unit_id = x.purchase_unit
      from (values
        ('cafe-en-grains',  v_g , v_kg),
        ('lait',            v_ml, v_l ),
        ('sucre',           v_g , v_kg),
        ('citron',          v_pc, v_pc),
        ('orange',          v_pc, v_pc),
        ('menthe',          v_pc, v_pc),
        ('rhum',            v_ml, v_l ),
        ('sirop-de-sucre',  v_ml, v_l ),
        ('eau',             v_ml, v_l ),
        ('glace',           v_g , v_kg)
      ) as x(slug, base_unit, purchase_unit)
     where i.establishment_id = v_est and i.slug = x.slug
       and (i.base_unit_id is distinct from x.base_unit
            or i.purchase_unit_id is distinct from x.purchase_unit);
  end if;

  -- --------------------------------------------------------------------
  -- 2) Demo recipes (re-run of the 043 seed with the corrected 'g' unit).
  -- --------------------------------------------------------------------
  select id into v_espresso from public.products
   where establishment_id = v_est and slug = 'espresso';
  select id into v_cafe from public.ingredients
   where establishment_id = v_est and slug = 'cafe-en-grains';

  -- v1 — active + default (the reference recipe)
  insert into public.recipes (
    establishment_id, product_id, name, description, yield_type, default_yield,
    yield_unit_id, preparation_time, is_active, version, status, is_default,
    notes, is_system, sort_order
  )
  select v_est, v_espresso, 'Espresso', 'Café espresso court et intense.',
         'exact_consumption', 1, null, 20, true, 1, 'active', true,
         'Recette de référence — café en grains torréfiés.', false, 10
    where v_espresso is not null and v_cafe is not null and v_g is not null
  on conflict (establishment_id, product_id, version) do nothing
  returning id into v_r1;

  if v_r1 is not null then
    insert into public.recipe_items (recipe_id, ingredient_id, quantity, unit_id, waste_percentage, sort_order)
    values (v_r1, v_cafe, 10, v_g, 0, 10);

    insert into public.recipe_translations (recipe_id, locale, name, description, notes) values
      (v_r1, 'fr', 'Espresso', 'Café espresso court et intense.', 'Recette de référence — café en grains torréfiés.'),
      (v_r1, 'en', 'Espresso', 'Short, intense espresso coffee.', 'Reference recipe — roasted coffee beans.'),
      (v_r1, 'ar', 'إسبريسو', 'قهوة إسبريسو قصيرة ومكثفة.', 'وصفة مرجعية — حبوب بن محمصة.');
  end if;

  -- v2 — draft (a future, stronger recipe)
  insert into public.recipes (
    establishment_id, product_id, name, description, yield_type, default_yield,
    yield_unit_id, preparation_time, is_active, version, status, is_default,
    notes, is_system, sort_order
  )
  select v_est, v_espresso, 'Espresso intensif', 'Espresso plus corsé — double dose.',
         'exact_consumption', 1, null, 25, false, 2, 'draft', false,
         'Variante à valider après dégustation.', false, 20
    where v_espresso is not null and v_cafe is not null and v_g is not null
  on conflict (establishment_id, product_id, version) do nothing
  returning id into v_r2;

  if v_r2 is not null then
    insert into public.recipe_items (recipe_id, ingredient_id, quantity, unit_id, waste_percentage, sort_order)
    values (v_r2, v_cafe, 11, v_g, 0, 10);

    insert into public.recipe_translations (recipe_id, locale, name, description, notes) values
      (v_r2, 'fr', 'Espresso intensif', 'Espresso plus corsé — double dose.', 'Variante à valider après dégustation.'),
      (v_r2, 'en', 'Intense espresso', 'Bolder espresso — double dose.', 'Variant to validate after tasting.'),
      (v_r2, 'ar', 'إسبريسو مكثف', 'إسبريسو أقوى — جرعة مضاعفة.', 'نسخة تجريبية تُعتمد بعد التذوق.');
  end if;
end $$;