-- Phase 08 sanity checks (run via `db query --file scripts/verify-categories.sql`).

select *
  from (
         select 'translations_table' as "key",
                case when to_regclass('public.category_translations') is not null
                     then 'present' else 'MISSING' end as value

         union all select 'categories_columns',
                (select string_agg(column_name, ',' order by column_name)
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'categories'
                    and column_name in ('icon', 'color', 'is_system'))

         union all select 'category_triggers',
                (select string_agg(tgname, ',' order by tgname)
                   from pg_trigger
                  where tgrelid = 'public.categories'::regclass
                    and tgname in ('trg_categories_validate_cycle',
                                   'trg_categories_protect_system')
                    and not tgisinternal)

         union all select 'categories_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'categories')

         union all select 'translations_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'category_translations')

         union all select 'categories_permissions',
                (select count(*)::text
                   from public.permissions
                  where module = 'categories')

         union all select 'permission_slugs',
                (select string_agg(slug, ',' order by slug)
                   from public.permissions
                  where module = 'categories')

         union all select 'manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'manager' and p.module = 'categories')

         union all select 'stock_manager_view_only',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'stock_manager' and p.module = 'categories')

         union all select 'purchasing_view_only',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'purchasing' and p.module = 'categories')

         union all select 'system_categories',
                (select string_agg(name, ',' order by sort_order)
                   from public.categories
                  where establishment_id = '00000000-0000-0000-0000-000000000001'
                    and is_system)

         union all select 'system_translations',
                (select count(*)::text
                   from public.category_translations ct
                   join public.categories c on c.id = ct.category_id
                  where c.establishment_id = '00000000-0000-0000-0000-000000000001'
                    and c.is_system)

         union all select 'images_bucket',
                (select count(*)::text
                   from storage.buckets
                  where id = 'category-images')

         union all select 'images_policies',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname like 'category_images%')
       ) checks
 order by "key";