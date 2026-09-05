-- 033_products_v2
-- Phase 09: evolve `products` into the catalog model.
--   * rename sale_price -> price, cost_price -> cost, is_sellable -> is_pos_enabled
--   * add short_description, sort_order, is_available, is_featured,
--     is_stock_tracked, is_system
--   * add product_translations (fr/en/ar) with unique (product_id, locale)
--   * replace the establishment-scoped RLS (023) with permission-gated policies
--     that also protect system products and forbid cross-establishment refs.

-- ============================================================
-- 1) Column evolution (additive + renames, no data loss)
-- ============================================================
alter table public.products rename column sale_price to price;
alter table public.products rename column cost_price to cost;
alter table public.products rename column is_sellable to is_pos_enabled;

alter table public.products
  add column if not exists short_description text,
  add column if not exists sort_order integer not null default 10,
  add column if not exists is_available boolean not null default true,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_stock_tracked boolean not null default false,
  add column if not exists is_system boolean not null default false;

-- Rebuild the monetary constraints under their new names.
alter table public.products drop constraint if exists products_sale_price_check;
alter table public.products drop constraint if exists products_cost_price_check;
alter table public.products
  add constraint products_price_check check (price >= 0);
alter table public.products
  add constraint products_cost_check check (cost >= 0);

-- ============================================================
-- 2) Indexes for the operational selectors (POS, availability, type, sort)
-- ============================================================
create index if not exists idx_products_name_lower
  on public.products (lower(name));
create index if not exists idx_products_category_sort
  on public.products (category_id, sort_order);
create index if not exists idx_products_is_available
  on public.products (is_available);
create index if not exists idx_products_is_pos_enabled
  on public.products (is_pos_enabled);
create index if not exists idx_products_type
  on public.products (product_type);
create index if not exists idx_products_featured
  on public.products (is_featured);

-- ============================================================
-- 3) product_translations
-- ============================================================
create table if not exists public.product_translations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  locale text not null check (locale in ('fr', 'en', 'ar')),
  name text not null check (name <> ''),
  short_description text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_product_translations_product_locale
  on public.product_translations (product_id, locale);
create index if not exists idx_product_translations_locale
  on public.product_translations (locale);

create trigger trg_product_translations_updated_at
  before update on public.product_translations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4) RLS helper: forbid cross-establishment references
--    (a product may only reference a category/tax of its own
--     establishment and a unit of its establishment or a system unit)
-- ============================================================
create or replace function public.product_references_valid(
  p_establishment_id uuid,
  p_category_id uuid,
  p_unit_id uuid,
  p_tax_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_category_id is null or exists (
      select 1 from public.categories c
      where c.id = p_category_id
        and c.establishment_id = p_establishment_id))
    and (p_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_unit_id
        and (u.establishment_id = p_establishment_id
             or u.establishment_id is null)))
    and (p_tax_id is null or exists (
      select 1 from public.taxes t
      where t.id = p_tax_id
        and t.establishment_id = p_establishment_id));
$$;

-- ============================================================
-- 5) System-product protection trigger
--    (identity fields / inserts / deletes; migrations bypass via owner)
-- ============================================================
create or replace function public.protect_system_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_product_protected';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null and not is_super_admin() then
      raise exception 'system_product_protected';
    end if;
    return old;
  end if;

  if old.is_system
     and (
       new.is_system is distinct from old.is_system
       or new.slug is distinct from old.slug
       or new.establishment_id is distinct from old.establishment_id
     )
     and auth.uid() is not null
     and not is_super_admin() then
    raise exception 'system_product_protected';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_protect_system on public.products;
create trigger trg_products_protect_system
  before insert or update or delete on public.products
  for each row
  execute function public.protect_system_products();

-- ============================================================
-- 6) RLS — products
-- ============================================================
drop policy if exists products_read on public.products;
drop policy if exists products_write on public.products;

create policy "products_read" on public.products
  for select using (
    is_super_admin()
    or belongs_to_establishment(establishment_id)
  );

create policy "products_member_insert" on public.products
  for insert with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'products.create')
      and product_references_valid(establishment_id, category_id, unit_id, tax_id)
    )
  );

create policy "products_member_update" on public.products
  for update using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'products.update')
    )
  ) with check (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'products.update')
      and product_references_valid(establishment_id, category_id, unit_id, tax_id)
    )
  );

create policy "products_member_delete" on public.products
  for delete using (
    is_super_admin()
    or (
      not is_system
      and has_permission(establishment_id, 'products.delete')
    )
  );

-- ============================================================
-- 7) RLS — product_translations (access inherited from the product)
-- ============================================================
alter table public.product_translations enable row level security;

create policy "product_translations_read" on public.product_translations
  for select using (
    is_super_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and belongs_to_establishment(p.establishment_id)
    )
  );

create policy "product_translations_member_insert" on public.product_translations
  for insert with check (
    is_super_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and not p.is_system
        and has_permission(p.establishment_id, 'products.create')
    )
  );

create policy "product_translations_member_update" on public.product_translations
  for update using (
    is_super_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and not p.is_system
        and has_permission(p.establishment_id, 'products.update')
    )
  ) with check (
    is_super_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and not p.is_system
        and has_permission(p.establishment_id, 'products.update')
    )
  );

create policy "product_translations_member_delete" on public.product_translations
  for delete using (
    is_super_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and not p.is_system
        and has_permission(p.establishment_id, 'products.update')
    )
  );