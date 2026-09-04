-- 011_purchasing
-- Purchase orders + items (for supplier ordering; reception feeds stock later).

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  reference text not null,
  status text not null default 'draft',
  order_date timestamptz not null default now(),
  expected_date timestamptz,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_status_check check (
    status in ('draft', 'pending', 'ordered', 'partially_received', 'received', 'cancelled')
  ),
  constraint purchase_orders_subtotal_check check (subtotal >= 0),
  constraint purchase_orders_tax_check check (tax_amount >= 0),
  constraint purchase_orders_total_check check (total >= 0)
);

create unique index if not exists uq_purchase_orders_establishment_reference
  on public.purchase_orders (establishment_id, reference);

create index if not exists idx_purchase_orders_establishment on public.purchase_orders (establishment_id);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders (supplier_id);
create index if not exists idx_purchase_orders_status on public.purchase_orders (status);
create index if not exists idx_purchase_orders_order_date on public.purchase_orders (order_date);

create trigger trg_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- purchase_order_items
-- ============================================================
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  quantity numeric not null default 0,
  unit_id uuid references public.units (id) on delete set null,
  unit_price numeric not null default 0,
  tax_id uuid references public.taxes (id) on delete set null,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_items_quantity_check check (quantity >= 0),
  constraint purchase_order_items_price_check check (unit_price >= 0),
  constraint purchase_order_items_tax_check check (tax_amount >= 0),
  constraint purchase_order_items_total_check check (total >= 0)
);

create index if not exists idx_poi_order on public.purchase_order_items (purchase_order_id);
create index if not exists idx_poi_ingredient on public.purchase_order_items (ingredient_id);

create trigger trg_poi_updated_at
  before update on public.purchase_order_items
  for each row
  execute function public.set_updated_at();
