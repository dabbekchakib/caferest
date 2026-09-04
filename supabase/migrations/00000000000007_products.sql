-- 007_products
-- Sellable products (can be simple, composite, or service).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  sku text,
  barcode text,
  product_type text not null default 'product',
  sale_price numeric not null default 0,
  cost_price numeric not null default 0,
  tax_id uuid references public.taxes (id) on delete set null,
  unit_id uuid references public.units (id) on delete set null,
  image_url text,
  is_sellable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_product_type_check check (
    product_type in ('product', 'composite', 'service')
  ),
  constraint products_sale_price_check check (sale_price >= 0),
  constraint products_cost_price_check check (cost_price >= 0),
  constraint products_name_check check (name <> ''),
  constraint products_slug_check check (slug <> '')
);

-- Unique SKU / barcode / slug per establishment (allowing NULL-friendly filtering).
create unique index if not exists uq_products_establishment_slug
  on public.products (establishment_id, slug);
create unique index if not exists uq_products_establishment_sku
  on public.products (establishment_id, sku)
  where sku is not null;
create unique index if not exists uq_products_establishment_barcode
  on public.products (establishment_id, barcode)
  where barcode is not null;

create index if not exists idx_products_establishment on public.products (establishment_id);
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_name on public.products (name);
create index if not exists idx_products_is_active on public.products (is_active);

create trigger trg_products_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();
