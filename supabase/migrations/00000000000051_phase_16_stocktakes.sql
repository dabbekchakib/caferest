-- 051_phase_16_stocktakes
-- Phase 16: Inventaire physique — table de bord, gel/snapshot théorique,
-- comptage, écarts et ajustements de stock contrôlés (validation atomique en 052).
--
-- Legal/evolution rules:
--   * `stocktakes` / `stocktake_items` / `stocktake_status_history` are NEW
--     tables; `stock_movements` (012) / `stock_items` are evolved ADDITIVELY,
--   * NO STOCK WRITE in this migration: `stock_items` / `stock_movements` are
--     only touched inside the atomic `validate_stocktake` RPC of 052,
--   * an inventory NEVER moves stock at count time — the snapshot is frozen at
--     start (`started_at`), the theoretical quantity at validation is
--     `snapshot_quantity + movements_since_snapshot`, the variance is applied
--     ONLY by `validate_stocktake`,
--   * idempotence: `stock_take adjustment movements` reference
--     `stocktake_item_id` with a UNIQUE partial index, so validating the same
--     stocktake twice can never double-move the stock,
--   * every stocktake number is SERVER-GENERATED (INV-YYYY-NNNNNN) by
--     `next_stocktake_number`, mirrors `next_goods_receipt_number`,
--   * movement vocabulary reuses `adjustment_in` / `adjustment_out` of 012
--     with `direction` in/out; each row is tagged `reference_type='stocktake'`,
--     `stocktake_id` and `stocktake_item_id` so stocktake adjustments stay
--     identifiable forever (reporting, theoretical/reference reconciliation).
--
-- Permission slugs (new module `stocktakes`): view/create/update/delete/
-- start/count/review/approve/validate/cancel/view_cost/approve_high_variance.

-- ============================================================
-- 1) stocktakes
-- ============================================================
create table if not exists public.stocktakes (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  inventory_location_id uuid not null
    references public.inventory_locations(id) on delete restrict,
  stocktake_number text not null,
  status text not null default 'draft',
  mode text not null default 'standard',
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  validated_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  started_by uuid references auth.users(id) on delete set null,
  completed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  notes text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stocktakes_status_check check (
    status in ('draft', 'counting', 'pending_review', 'approved',
               'validated', 'cancelled')
  ),
  constraint stocktakes_mode_check check (mode in ('standard', 'blind')),
  constraint stocktakes_number_check check (
    stocktake_number ~ '^INV-[0-9]{4}-[0-9]{6}$'
  ),
  constraint stocktakes_counting_fields check (
    status <> 'counting' or (started_at is not null and started_by is not null)
  ),
  constraint stocktakes_review_fields check (
    status <> 'pending_review'
    or (completed_at is not null and completed_by is not null)
  ),
  constraint stocktakes_approved_fields check (
    status <> 'approved'
    or (approved_at is not null and approved_by is not null
        and completed_at is not null and completed_by is not null)
  ),
  constraint stocktakes_validated_fields check (
    status <> 'validated'
    or (validated_at is not null and validated_by is not null
        and approved_at is not null and approved_by is not null)
  ),
  constraint stocktakes_cancelled_fields check (
    status <> 'cancelled'
    or (cancelled_at is not null and cancelled_by is not null)
  )
);

-- ============================================================
-- 2) stocktake_items
-- ============================================================
-- One row per (stocktake, ingredient). Quantities are ALWAYS stored in the
-- ingredient base unit (counted_quantity is normalized server-side from any
-- compatible unit via convert_unit_value). The server recomputes
-- expected/variance/percentage/value at complete/approve/validate time — the
-- frontend is never trusted for these.
create table if not exists public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null
    references public.stocktakes(id) on delete cascade,
  ingredient_id uuid not null
    references public.ingredients(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  base_unit_id uuid references public.units(id) on delete set null,
  snapshot_quantity numeric not null default 0,
  movements_quantity numeric,
  expected_quantity numeric,
  counted_quantity numeric,
  variance_quantity numeric,
  variance_percentage numeric,
  unit_cost numeric not null default 0,
  variance_value numeric,
  count_status text not null default 'pending',
  notes text,
  counted_by uuid references auth.users(id) on delete set null,
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stocktake_items_ingredient_unique unique (stocktake_id, ingredient_id),
  constraint stocktake_items_snapshot_check check (snapshot_quantity >= 0),
  constraint stocktake_items_expected_check check (expected_quantity >= 0),
  constraint stocktake_items_counted_check check (counted_quantity >= 0),
  constraint stocktake_items_cost_check check (unit_cost >= 0),
  constraint stocktake_items_count_status_check check (
    count_status in ('pending', 'counted')
  )
);

-- ============================================================
-- 3) stocktake_status_history (append-only ledger)
-- ============================================================
create table if not exists public.stocktake_status_history (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  stocktake_id uuid not null
    references public.stocktakes(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint stocktake_history_from_check check (
    from_status is null
    or from_status in ('draft', 'counting', 'pending_review', 'approved',
                       'validated', 'cancelled')
  ),
  constraint stocktake_history_to_check check (
    to_status in ('draft', 'counting', 'pending_review', 'approved',
                  'validated', 'cancelled')
  )
);

-- ============================================================
-- 4) Stocktake numbering (server-generated, mirrors BR/BC numbering)
-- ============================================================
create or replace function public.next_stocktake_number(p_est uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_max integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtext('stocktake_number:' || p_est::text || ':' || v_year));

  select coalesce(max(
      substring(st.stocktake_number from 'INV-[0-9]{4}-([0-9]{6})$')::integer
    ), 0)
    into v_max
    from public.stocktakes st
   where st.establishment_id = p_est
     and substring(st.stocktake_number from '^INV-[0-9]{4}-') = ('INV-' || v_year || '-')
     and st.stocktake_number ~ '^INV-[0-9]{4}-[0-9]{6}$';

  return 'INV-' || v_year || '-' || lpad((v_max + 1)::text, 6, '0');
end $$;

-- ============================================================
-- 5) stock_movements evolution (additive; 012 columns untouched)
-- ============================================================
-- Stocktake adjustments reuse the `adjustment_in`/`adjustment_out` vocabulary
-- with `direction` in/out; the new FK columns make every adjustment traceable
-- to its stocktake + item. `movement_type` is NOT extended: the reference
-- columns are the identity (spec: adjustments must stay identifiable).
alter table public.stock_movements
  add column if not exists stocktake_id uuid
    references public.stocktakes(id) on delete set null,
  add column if not exists stocktake_item_id uuid
    references public.stocktake_items(id) on delete set null;

-- Idempotence: a movement that already materialised a stocktake item can
-- never be created again (protects validate against retries/races).
create unique index if not exists uq_stock_movements_stocktake_item
  on public.stock_movements (stocktake_item_id)
  where stocktake_item_id is not null;

create index if not exists idx_stock_movements_stocktake
  on public.stock_movements (stocktake_id);

-- ============================================================
-- 6) RLS — the three new tables
-- ============================================================
alter table public.stocktakes enable row level security;
alter table public.stocktake_items enable row level security;
alter table public.stocktake_status_history enable row level security;

-- Reads are gated behind `stocktakes.view`; cross-establishment reads are
-- impossible by construction (belongs_to_establishment guard).
create policy "stocktakes_read" on public.stocktakes
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'stocktakes.view'))
  );

-- Writes flow exclusively through the SECURITY DEFINER RPCs of 052. The member
-- insert policy below is defense-in-depth only (draft headers created by the
-- RPC; direct inserts stay constrained by references).
create policy "stocktakes_member_insert" on public.stocktakes
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'stocktakes.create')
    and exists (
      select 1 from public.inventory_locations il
       where il.id = inventory_location_id
         and il.establishment_id = establishment_id
         and il.is_active
    )
  );

create policy "stocktake_items_read" on public.stocktake_items
  for select using (
    exists (
      select 1 from public.stocktakes st
       where st.id = stocktake_id
         and belongs_to_establishment(st.establishment_id)
         and (is_super_admin()
              or has_permission(st.establishment_id, 'stocktakes.view'))
    )
  );

-- History is appendix: only the status RPCs write it, never direct inserts.
create policy "stocktake_status_history_read"
  on public.stocktake_status_history
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'stocktakes.view'))
  );

-- ============================================================
-- 7) Permission catalog — module `stocktakes`
-- ============================================================
-- The legacy `inventory.stocktake` slug (phase 06) is left untouched: it keeps
-- its grants, the granular `stocktakes.*` module below is the Phase 16 API.
insert into public.permissions (slug, module, name, description) values
  ('stocktakes.view',                'stocktakes', 'Voir les inventaires',                 'Consulter les inventaires physiques et leurs lignes'),
  ('stocktakes.create',              'stocktakes', 'Créer un inventaire',                  'Créer un inventaire physique (en-tête brouillon)'),
  ('stocktakes.update',              'stocktakes', 'Modifier un inventaire',               'Modifier les notes d''un inventaire'),
  ('stocktakes.delete',              'stocktakes', 'Supprimer un inventaire',              'Supprimer définitivement un inventaire en brouillon'),
  ('stocktakes.start',               'stocktakes', 'Démarrer un inventaire',               'Démarrer le comptage et geler le stock théorique'),
  ('stocktakes.count',               'stocktakes', 'Compter un inventaire',                'Saisir les quantités physiques comptées'),
  ('stocktakes.review',              'stocktakes', 'Contrôler un inventaire',              'Terminer le comptage et réconcilier les écarts'),
  ('stocktakes.approve',             'stocktakes', 'Approuver un inventaire',              'Approuver un inventaire avant validation'),
  ('stocktakes.validate',            'stocktakes', 'Valider un inventaire',                'Valider l''inventaire et appliquer les ajustements de stock'),
  ('stocktakes.cancel',              'stocktakes', 'Annuler un inventaire',                'Annuler un inventaire non encore validé'),
  ('stocktakes.view_cost',           'stocktakes', 'Voir la valorisation',                 'Voir la valeur des écarts d''inventaire'),
  ('stocktakes.approve_high_variance','stocktakes','Approuver les écarts importants',      'Approuver un inventaire présentant des écarts supérieurs aux seuils')
on conflict (slug) do nothing;

-- ============================================================
-- 8) Role → permission matrix
-- ============================================================
do $$
declare
  v_super_admin uuid;
  v_admin       uuid;
  v_manager     uuid;
  v_stock       uuid;
  v_accountant  uuid;
  v_purchasing  uuid;
begin
  select id into v_super_admin from public.roles where code = 'super_admin' and is_system;
  select id into v_admin       from public.roles where code = 'admin' and is_system;
  select id into v_manager     from public.roles where code = 'manager' and is_system;
  select id into v_stock       from public.roles where code = 'stock_manager' and is_system;
  select id into v_accountant  from public.roles where code = 'accountant' and is_system;
  select id into v_purchasing  from public.roles where code = 'purchasing' and is_system;

  -- Full workflow (super_admin/admin/manager): count, review, approve AND validate.
  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_super_admin as role_id union all
    select v_admin union all
    select v_manager
  ) r
  cross join (select id from public.permissions
               where slug like 'stocktakes.%') p
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager: does the whole counting/review chain but NEVER validates
  -- the stock (approve/validate/high-variance stay with a manager-level role).
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id
    from public.permissions p
   where p.slug in ('stocktakes.view', 'stocktakes.create',
                    'stocktakes.update', 'stocktakes.delete',
                    'stocktakes.start', 'stocktakes.count',
                    'stocktakes.review', 'stocktakes.cancel',
                    'stocktakes.view_cost')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: read-only, but sees the valuation of variances.
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug in ('stocktakes.view', 'stocktakes.view_cost')
  on conflict (role_id, permission_id) do nothing;

  -- Purchasing: read-only (receiving data, no counting duty).
  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id
    from public.permissions p
   where p.slug = 'stocktakes.view'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 9) Indexes
-- ============================================================
create unique index if not exists uq_stocktakes_establishment_number
  on public.stocktakes (establishment_id, stocktake_number);

create index if not exists idx_stocktakes_establishment_status
  on public.stocktakes (establishment_id, status);

create index if not exists idx_stocktakes_location
  on public.stocktakes (inventory_location_id);

create index if not exists idx_stocktakes_created_at
  on public.stocktakes (establishment_id, created_at desc);

create index if not exists idx_stocktakes_item_stocktake
  on public.stocktake_items (stocktake_id);

create index if not exists idx_stocktakes_item_ingredient
  on public.stocktake_items (ingredient_id);

create index if not exists idx_stocktake_history_stocktake
  on public.stocktake_status_history (stocktake_id, created_at);