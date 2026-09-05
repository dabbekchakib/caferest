-- Phase 10 sanity checks (run via `db query --file scripts/verify-ingredients.sql`).

select *
  from (
         select 'translations_table' as "key",
                case when to_regclass('public.ingredient_translations') is not null
                     then 'present' else 'MISSING' end as value

         union all select 'ingredients_columns',
                (select string_agg(column_name, ',' order by column_name)
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'ingredients'
                    and column_name in ('slug', 'ingredient_type',
                                        'purchase_quantity', 'purchase_cost',
                                        'waste_percentage', 'image_url',
                                        'is_system', 'sort_order',
                                        'is_stock_tracked'))

         union all select 'renamed_stock_column',
                (select case when count(*) = 0 then 'ok' else 'STILL_PRESENT' end
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'ingredients'
                    and column_name = 'is_stockable')

         union all select 'unique_indexes',
                (select string_agg(indexname, ',' order by indexname)
                   from pg_indexes
                  where schemaname = 'public' and tablename = 'ingredients'
                    and indexname in ('uq_ingredients_establishment_sku',
                                      'uq_ingredients_establishment_barcode',
                                      'uq_ingredients_establishment_slug'))

         union all select 'type_check',
                (select string_agg(conname, ',' order by conname)
                   from pg_constraint
                  where conrelid = 'public.ingredients'::regclass
                    and conname in ('ingredients_type_check',
                                    'ingredients_purchase_quantity_check',
                                    'ingredients_purchase_cost_check',
                                    'ingredients_waste_check'))

         union all select 'trigger',
                (select string_agg(tgname, ',' order by tgname)
                   from pg_trigger
                  where tgrelid = 'public.ingredients'::regclass
                    and tgname in ('trg_ingredients_protect_system')
                    and not tgisinternal)

         union all select 'references_function',
                (select case when to_regprocedure('ingredient_references_valid(uuid, uuid, uuid, uuid)') is not null
                             then 'present' else 'MISSING' end)

         union all select 'ingredients_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'ingredients')

         union all select 'translations_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'ingredient_translations')

         union all select 'ingredients_permissions',
                (select count(*)::text
                   from public.permissions
                  where module = 'ingredients')

         union all select 'permission_slugs',
                (select string_agg(slug, ',' order by slug)
                   from public.permissions
                  where module = 'ingredients')

         union all select 'manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'manager' and p.module = 'ingredients')

         union all select 'stock_manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'stock_manager' and p.module = 'ingredients')

         union all select 'cashier_view_only',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'cashier' and p.module = 'ingredients')

         union all select 'accountant_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'accountant' and p.module = 'ingredients')

         union all select 'demo_ingredients',
                (select count(*)::text
                   from public.ingredients
                  where establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'demo_translations',
                (select count(*)::text
                   from public.ingredient_translations it
                   join public.ingredients ing on ing.id = it.ingredient_id
                  where ing.establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'ingredient_types_used',
                (select string_agg(distinct ingredient_type, ',' order by ingredient_type)
                   from public.ingredients
                  where establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'images_bucket',
                (select count(*)::text
                   from storage.buckets
                  where id = 'ingredient-images')

         union all select 'images_policies',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname like 'ingredient_images%')
       ) checks
 order by "key";