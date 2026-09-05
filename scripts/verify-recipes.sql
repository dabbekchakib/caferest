-- 041-045 sanity checks (run via `db query --file scripts/verify-recipes.sql`).

select *
  from (
         select 'translations_table' as "key",
                case when to_regclass('public.recipe_translations') is not null
                     then 'present' else 'MISSING' end as value

         union all select 'recipes_columns',
                (select string_agg(column_name, ',' order by column_name)
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'recipes'
                    and column_name in ('version', 'status', 'is_default',
                                        'notes', 'is_system', 'sort_order',
                                        'created_by', 'updated_by'))

         union all select 'recipe_items_columns',
                (select string_agg(column_name, ',' order by column_name)
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'recipe_items'
                    and column_name in ('sub_recipe_id', 'notes', 'sort_order'))

         union all select 'unique_indexes',
                (select string_agg(indexname, ',' order by indexname)
                   from pg_indexes
                  where schemaname = 'public' and tablename = 'recipes'
                    and indexname in ('uq_recipes_establishment_product_version',
                                      'uq_recipes_default_per_product'))

         union all select 'check_constraints',
                (select string_agg(conname, ',' order by conname)
                   from pg_constraint
                  where conrelid = 'public.recipe_items'::regclass
                    and conname in ('recipe_items_reference_xor',
                                    'recipe_items_quantity_check',
                                    'recipe_items_waste_check'))

         union all select 'protect_trigger',
                (select count(*)::text
                   from pg_trigger
                  where tgrelid = 'public.recipes'::regclass
                    and tgname = 'trg_recipes_protect_system'
                    and not tgisinternal)

         union all select 'references_functions',
                (select string_agg(pp.proname, ',' order by pp.proname)
                   from pg_proc pp
                  where pp.proname in ('recipe_references_valid',
                                       'recipe_item_references_valid'))

         union all select 'recipes_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'recipes')

         union all select 'recipe_items_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'recipe_items')

         union all select 'translations_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'recipe_translations')

         union all select 'recipes_permissions',
                (select count(*)::text
                   from public.permissions
                  where module = 'recipes')

         union all select 'permission_slugs',
                (select string_agg(slug, ',' order by slug)
                   from public.permissions
                  where module = 'recipes')

         union all select 'manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'manager' and p.module = 'recipes')

         union all select 'stock_manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'stock_manager' and p.module = 'recipes')

         union all select 'accountant_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'accountant' and p.module = 'recipes')

         union all select 'demo_recipes',
                (select count(*)::text
                   from public.recipes
                  where establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'demo_active_default',
                (select count(*)::text
                   from public.recipes
                  where establishment_id = '00000000-0000-0000-0000-000000000001'
                    and status = 'active' and is_default)

         union all select 'demo_items',
                (select count(*)::text
                   from public.recipe_items
                   join public.recipes r on r.id = recipe_id
                  where r.establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'demo_translations',
                (select count(*)::text
                   from public.recipe_translations rt
                   join public.recipes r on r.id = rt.recipe_id
                  where r.establishment_id = '00000000-0000-0000-0000-000000000001')
       ) checks
 order by "key";