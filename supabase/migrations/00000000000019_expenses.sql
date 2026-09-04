-- 019_expenses
-- Operating expenses.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  category text,
  description text not null,
  amount numeric not null default 0,
  tax_amount numeric not null default 0,
  expense_date timestamptz not null default now(),
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_check check (amount >= 0),
  constraint expenses_tax_check check (tax_amount >= 0)
);

create index if not exists idx_expenses_establishment on public.expenses (establishment_id);
create index if not exists idx_expenses_date on public.expenses (expense_date);
create index if not exists idx_expenses_category on public.expenses (category);

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row
  execute function public.set_updated_at();
