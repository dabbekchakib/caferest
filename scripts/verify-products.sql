-- Phase 09 sanity checks (run via `db query --file scripts/verify-products.sql`).

select *
  from (
         select 'translations_table' as "key",
                case when to_regclass('public.product_translations') is not null
                     then 'present' else 'MISSING' end as value

         union all select 'products_columns',
                (select string_agg(column_name, ',' order by column_name)
                   from information_schema.columns
                  where table_schema = 'public' and table_name = 'products'
                    and column_name in ('price', 'cost', 'is_pos_enabled',
                                        'short_description', 'sort_order',
                                        'is_available', 'is_featured',
                                        'is_stock_tracked', 'is_system'))

         union all select 'price_checks',
                (select string_agg(conname, ',' order by conname)
                   from pg_constraint
                  where conrelid = 'public.products'::regclass
                    and conname in ('products_price_check', 'products_cost_check'))

         union all select 'trigger',
                (select string_agg(tgname, ',' order by tgname)
                   from pg_trigger
                  where tgrelid = 'public.products'::regclass
                    and tgname in ('trg_products_protect_system')
                    and not tgisinternal)

         union all select 'translations_trigger',
                (select string_agg(tgname, ',' order by tgname)
                   from pg_trigger
                  where tgrelid = 'public.product_translations'::regclass
                    and tgname = 'trg_product_translations_updated_at'
                    and not tgisinternal)

         union all select 'products_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'products')

         union all select 'translations_rls',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'public' and tablename = 'product_translations')

         union all select 'products_permissions',
                (select count(*)::text
                   from public.permissions
                  where module = 'products')

         union all select 'permission_slugs',
                (select string_agg(slug, ',' order by slug)
                   from public.permissions
                  where module = 'products')

         union all select 'manager_matrix',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'manager' and p.module = 'products')

         union all select 'cashier_view_only',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'cashier' and p.module = 'products')

         union all select 'accountant_view_only',
                (select string_agg(p.slug, ',' order by p.slug)
                   from public.role_permissions rp
                   join public.roles r on r.id = rp.role_id
                   join public.permissions p on p.id = rp.permission_id
                  where r.code = 'accountant' and p.module = 'products')

         union all select 'demo_products',
                (select count(*)::text
                   from public.products
                  where establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'demo_translations',
                (select count(*)::text
                   from public.product_translations pt
                   join public.products pr on pr.id = pt.product_id
                  where pr.establishment_id = '00000000-0000-0000-0000-000000000001')

         union all select 'composite_products',
                (select count(*)::text
                   from public.products
                  where establishment_id = '00000000-0000-0000-0000-000000000001'
                    and product_type = 'composite')

         union all select 'images_bucket',
                (select count(*)::text
                   from storage.buckets
                  where id = 'product-images')

         union all select 'images_policies',
                (select count(*)::text
                   from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname like 'product_images%')
       ) checks
 order by "key";