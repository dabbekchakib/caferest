-- 018_cash_registers
-- Cash registers + cash sessions.

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_cash_registers_establishment_code
  on public.cash_registers (establishment_id, code);

create index if not exists idx_cash_registers_establishment on public.cash_registers (establishment_id);
create index if not exists idx_cash_registers_is_active on public.cash_registers (is_active);

create trigger trg_cash_registers_updated_at
  before update on public.cash_registers
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- cash_sessions
-- ============================================================
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references public.cash_registers (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  opening_amount numeric not null default 0,
  closed_at timestamptz,
  closing_amount numeric,
  expected_amount numeric,
  difference numeric,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_sessions_status_check check (status in ('open', 'closed', 'reconciled'))
);

create index if not exists idx_cash_sessions_register on public.cash_sessions (cash_register_id);
create index if not exists idx_cash_sessions_user on public.cash_sessions (user_id);
create index if not exists idx_cash_sessions_status on public.cash_sessions (status);

create trigger trg_cash_sessions_updated_at
  before update on public.cash_sessions
  for each row
  execute function public.set_updated_at();
