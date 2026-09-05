-- 043_seed_demo_recipes
-- Idempotent demo recipes for the default establishment (Mon Café).
-- References demo products (036), demo ingredients (040) and the global system
-- units (029). Pure reference data: safe by key (establishment_id, product_id,
-- version); never touches other establishments.
--
-- Demonstrates:
--   * versioning  (v1 active/default vs v2 draft),
--   * statuses    (active + draft),
--   * recipe_items with quantity + unit + waste + sort_order,
--   * recipe_translations (fr/en/ar).

do $$
declare
  v_est uuid := '00000000-0000-0000-0000-000000000001';
  v_espresso uuid;
  v_cafe     uuid;
  v_gram     uuid;
  v_r1 uuid := null;
  v_r2 uuid := null;
begin
  select id into v_espresso from public.products
   where establishment_id = v_est and slug = 'espresso';
  select id into v_cafe from public.ingredients
   where establishment_id = v_est and slug = 'cafe-en-grains';
  select id into v_gram from public.units
   where establishment_id is null and slug = 'g';

  -- ============================================================
  -- v1 — active + default (the reference recipe)
  -- ============================================================
  insert into public.recipes (
    establishment_id, product_id, name, description, yield_type, default_yield,
    yield_unit_id, preparation_time, is_active, version, status, is_default,
    notes, is_system, sort_order
  )
  select v_est, v_espresso, 'Espresso', 'Café espresso court et intense.',
         'exact_consumption', 1, null, 20, true, 1, 'active', true,
         'Recette de référence — café en grains torréfiés.', false, 10
    where v_espresso is not null and v_cafe is not null and v_gram is not null
  on conflict (establishment_id, product_id, version) do nothing
  returning id into v_r1;

  if v_r1 is not null then
    insert into public.recipe_items (recipe_id, ingredient_id, quantity, unit_id, waste_percentage, sort_order)
    values (v_r1, v_cafe, 10, v_gram, 0, 10);

    insert into public.recipe_translations (recipe_id, locale, name, description, notes) values
      (v_r1, 'fr', 'Espresso', 'Café espresso court et intense.', 'Recette de référence — café en grains torréfiés.'),
      (v_r1, 'en', 'Espresso', 'Short, intense espresso coffee.', 'Reference recipe — roasted coffee beans.'),
      (v_r1, 'ar', 'إسبريسو', 'قهوة إسبريسو قصيرة ومكثفة.', 'وصفة مرجعية — حبوب بن محمصة.');
  end if;

  -- ============================================================
  -- v2 — draft (a future, stronger recipe)
  -- ============================================================
  insert into public.recipes (
    establishment_id, product_id, name, description, yield_type, default_yield,
    yield_unit_id, preparation_time, is_active, version, status, is_default,
    notes, is_system, sort_order
  )
  select v_est, v_espresso, 'Espresso intensif', 'Espresso plus corsé — double dose.',
         'exact_consumption', 1, null, 25, false, 2, 'draft', false,
         'Variante à valider après dégustation.', false, 20
    where v_espresso is not null and v_cafe is not null and v_gram is not null
  on conflict (establishment_id, product_id, version) do nothing
  returning id into v_r2;

  if v_r2 is not null then
    insert into public.recipe_items (recipe_id, ingredient_id, quantity, unit_id, waste_percentage, sort_order)
    values (v_r2, v_cafe, 11, v_gram, 0, 10);

    insert into public.recipe_translations (recipe_id, locale, name, description, notes) values
      (v_r2, 'fr', 'Espresso intensif', 'Espresso plus corsé — double dose.', 'Variante à valider après dégustation.'),
      (v_r2, 'en', 'Intense espresso', 'Bolder espresso — double dose.', 'Variant to validate after tasting.'),
      (v_r2, 'ar', 'إسبريسو مكثف', 'إسبريسو أقوى — جرعة مضاعفة.', 'نسخة تجريبية تُعتمد بعد التذوق.');
  end if;
end $$;