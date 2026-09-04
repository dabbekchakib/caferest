-- 016_orders
-- Orders + order items.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  order_number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  table_id uuid references public.tables (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'draft',
  order_type text not null default 'dine_in',
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in ('draft', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled')
  ),
  constraint orders_type_check check (order_type in ('dine_in', 'takeaway', 'delivery')),
  constraint orders_subtotal_check check (subtotal >= 0),
  constraint orders_discount_check check (discount_amount >= 0),
  constraint orders_tax_check check (tax_amount >= 0),
  constraint orders_total_check check (total >= 0)
);

create unique index if not exists uq_orders_establishment_number
  on public.orders (establishment_id, order_number);

create index if not exists idx_orders_establishment on public.orders (establishment_id);
create index if not exists idx_orders_customer on public.orders (customer_id);
create index if not exists idx_orders_table on public.orders (table_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_order_type on public.orders (order_type);
create index if not exists idx_orders_created_at on public.orders (created_at);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- order_items
-- ============================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_check check (quantity >= 0),
  constraint order_items_price_check check (unit_price >= 0),
  constraint order_items_discount_check check (discount_amount >= 0),
  constraint order_items_tax_check check (tax_amount >= 0),
  constraint order_items_total_check check (total >= 0)
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_product on public.order_items (product_id);

create trigger trg_order_items_updated_at
  before update on public.order_items
  for each row
  execute function public.set_updated_at();
