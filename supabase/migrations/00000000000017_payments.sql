-- 017_payments
-- Payment methods + payments.

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  code text not null,
  type text not null default 'other',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_type_check check (
    type in ('cash', 'card', 'bank_transfer', 'other')
  )
);

create unique index if not exists uq_payment_methods_establishment_code
  on public.payment_methods (establishment_id, code);

create index if not exists idx_payment_methods_establishment on public.payment_methods (establishment_id);
create index if not exists idx_payment_methods_is_active on public.payment_methods (is_active);

create trigger trg_payment_methods_updated_at
  before update on public.payment_methods
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- payments
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  amount numeric not null default 0,
  reference text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_check check (amount > 0),
  constraint payments_status_check check (status in ('pending', 'completed', 'failed', 'refunded'))
);

create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_payments_method on public.payments (payment_method_id);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_paid_at on public.payments (paid_at);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();
