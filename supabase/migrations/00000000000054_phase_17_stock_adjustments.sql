-- 054_phase_17_stock_adjustments
-- Phase 17: Ajustements de stock (pertes, casse, gaspillage, expiration,
-- consommation interne, échantillons, nettoyage, autre).
--
-- Legal/evolution rules:
--   * `stock_adjustments` / `stock_adjustment_items` /
--     `stock_adjustment_reasons` / `stock_adjustment_status_history` are NEW
--     tables; `stock_movements` (012) / `stock_items` are evolved ADDITIVELY,
--   * NO STOCK WRITE in this migration: `stock_items` / `stock_movements` are
--     only touched inside the atomic RPCs of 055 (`validate_stock_adjustment`
--     is the SINGLE stock-writing point),
--   * an adjustment is an OUT-only document (direction 'out'); every line
--     stores its quantity in the ingredient BASE unit (`base_quantity`) and
--     the unit cost is frozen at submission time from the live
--     `stock_items.average_cost` — the header totals are always recomputed
--     server-side, the frontend is never trusted for them,
--   * `movement_type` vocabulary is extended with the adjustment types NOT
--     already present (waste already exists) so each adjustment writes
--     `movement_type = stock_adjustments.adjustment_type` and stays
--     identifiable forever via `reference_type = 'stock_adjustment'`,
--   * idempotence: `stock_adjustment_item_id` carries a UNIQUE partial index,
--     so validating the same adjustment twice can never double-move the stock,
--   * every adjustment number is SERVER-GENERATED (PER-YYYY-NNNNNN) by
--     `next_stock_adjustment_number`, mirrors the INV/BR/BC numbering,
--   * push-down workflow: submit → (pending_approval | approved) depending on
--     the establishment settings (approval required OR total above a value
--     threshold), approve (manual) → approved, validate → validated (stock),
--     cancel from any pre-validated state, delete of a draft only.
--
-- Permission slugs (new module `stock_adjustments`):
--   view/create/update/delete/submit/approve/validate/cancel/view_cost/
--   approve_high_value.

-- ============================================================
-- 1) stock_adjustment_reasons (catalog; management UI deferred to a later
--    phase — only system reasons are seeded here, establishment_id is NULL)
-- ============================================================
create table if not exists public.stock_adjustment_reasons (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid
    references public.establishments(id) on delete cascade,
  code text not null,
  label text not null,
  adjustment_type text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_adjustment_reasons_type_check check (
    adjustment_type is null or adjustment_type in (
      'loss', 'breakage', 'waste', 'expired', 'damaged',
      'internal_consumption', 'sample', 'staff_consumption',
      'cleaning', 'other'
    )
  )
);

-- System codes stay globally unique; establishment codes are scoped.
create unique index if not exists uq_stock_adjustment_reasons_system_code
  on public.stock_adjustment_reasons (code)
  where establishment_id is null;

create unique index if not exists uq_stock_adjustment_reasons_est_code
  on public.stock_adjustment_reasons (establishment_id, code)
  where establishment_id is not null;

-- ============================================================
-- 2) stock_adjustments
-- ============================================================
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  inventory_location_id uuid not null
    references public.inventory_locations(id) on delete restrict,
  adjustment_number text not null,
  status text not null default 'draft',
  adjustment_type text not null,
  adjustment_date date not null default current_date,
  reason_id uuid
    references public.stock_adjustment_reasons(id) on delete set null,
  notes text,
  internal_reference text,
  total_quantity numeric(14,3) not null default 0,
  total_value numeric(14,3) not null default 0,
  requires_approval boolean not null default false,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_adjustments_status_check check (
    status in ('draft', 'pending_approval', 'approved',
               'validated', 'cancelled')
  ),
  constraint stock_adjustments_number_check check (
    adjustment_number ~ '^PER-[0-9]{4}-[0-9]{6}$'
  ),
  constraint stock_adjustments_type_check check (
    adjustment_type in (
      'loss', 'breakage', 'waste', 'expired', 'damaged',
      'internal_consumption', 'sample', 'staff_consumption',
      'cleaning', 'other'
    )
  ),
  constraint stock_adjustments_date_check check (adjustment_date >= '2000-01-01'),
  constraint stock_adjustments_amount_check check (
    total_quantity >= 0 and total_value >= 0
  ),
  constraint stock_adjustments_approved_fields check (
    status <> 'approved'
    or (approved_at is not null and approved_by is not null)
  ),
  constraint stock_adjustments_validated_fields check (
    status <> 'validated'
    or (validated_at is not null and validated_by is not null
        and approved_at is not null and approved_by is not null)
  ),
  constraint stock_adjustments_cancelled_fields check (
    status <> 'cancelled'
    or (cancelled_at is not null and cancelled_by is not null)
  )
);

-- ============================================================
-- 3) stock_adjustment_items
-- ============================================================
-- One row per (adjustment, ingredient). `base_quantity` is ALWAYS in the
-- ingredient base unit (converted server-side via convert_unit_value from any
-- compatible unit). `unit_cost` is frozen at submission, `total_cost` and the
-- header totals are recomputed server-side.
create table if not exists public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  stock_adjustment_id uuid not null
    references public.stock_adjustments(id) on delete cascade,
  ingredient_id uuid not null
    references public.ingredients(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  base_unit_id uuid references public.units(id) on delete set null,
  base_quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_adjustment_items_ingredient_unique
    unique (stock_adjustment_id, ingredient_id),
  constraint stock_adjustment_items_quantity_check check (base_quantity > 0),
  constraint stock_adjustment_items_cost_check check (unit_cost >= 0),
  constraint stock_adjustment_items_total_check check (total_cost >= 0)
);

-- ============================================================
-- 4) stock_adjustment_status_history (append-only ledger)
-- ============================================================
create table if not exists public.stock_adjustment_status_history (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  stock_adjustment_id uuid not null
    references public.stock_adjustments(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint stock_adjustment_history_from_check check (
    from_status is null
    or from_status in ('draft', 'pending_approval', 'approved',
                       'validated', 'cancelled')
  ),
  constraint stock_adjustment_history_to_check check (
    to_status in ('draft', 'pending_approval', 'approved',
                  'validated', 'cancelled')
  )
);

-- ============================================================
-- 5) Adjustment numbering (server-generated, mirrors INV/BR/BC numbering)
-- ============================================================
create or replace function public.next_stock_adjustment_number(p_est uuid)
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
    hashtext('stock_adjustment_number:' || p_est::text || ':' || v_year));

  select coalesce(max(
      substring(sa.adjustment_number from 'PER-[0-9]{4}-([0-9]{6})$')::integer
    ), 0)
    into v_max
    from public.stock_adjustments sa
   where sa.establishment_id = p_est
     and substring(sa.adjustment_number from '^PER-[0-9]{4}-') = ('PER-' || v_year || '-')
     and sa.adjustment_number ~ '^PER-[0-9]{4}-[0-9]{6}$';

  return 'PER-' || v_year || '-' || lpad((v_max + 1)::text, 6, '0');
end $$;

-- ============================================================
-- 6) stock_movements evolution (additive; 012 columns untouched)
-- ============================================================
-- Each adjustment writes one movement per line with
-- `movement_type = stock_adjustments.adjustment_type`, `direction = 'out'`
-- and the new FK columns making it traceable to the adjustment + item.
alter table public.stock_movements
  add column if not exists stock_adjustment_id uuid
    references public.stock_adjustments(id) on delete set null,
  add column if not exists stock_adjustment_item_id uuid
    references public.stock_adjustment_items(id) on delete set null;

-- Movement-type vocabulary: add the adjustment types absent from 012 (`waste`
-- already exists). The constraint is dropped and re-created with the full list.
alter table public.stock_movements
  drop constraint if exists stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check check (
    movement_type in (
      'purchase', 'sale_consumption', 'transfer_in', 'transfer_out',
      'adjustment_in', 'adjustment_out', 'waste', 'return', 'opening',
      'loss', 'breakage', 'expired', 'damaged', 'internal_consumption',
      'sample', 'staff_consumption', 'cleaning', 'other'
    )
  );

-- Idempotence: a movement that already materialised an adjustment item can
-- never be created again (protects validate against retries/races).
create unique index if not exists uq_stock_movements_stock_adjustment_item
  on public.stock_movements (stock_adjustment_item_id)
  where stock_adjustment_item_id is not null;

create index if not exists idx_stock_movements_stock_adjustment
  on public.stock_movements (stock_adjustment_id);

-- ============================================================
-- 7) RLS — the four new tables
-- ============================================================
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.stock_adjustment_status_history enable row level security;
alter table public.stock_adjustment_reasons enable row level security;

-- Reasons is an open catalog: system rows (establishment_id NULL) plus the
-- rows of the caller establishment.
create policy "stock_adjustment_reasons_read"
  on public.stock_adjustment_reasons
  for select using (
    establishment_id is null
    or belongs_to_establishment(establishment_id)
  );

create policy "stock_adjustments_read" on public.stock_adjustments
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'stock_adjustments.view'))
  );

-- Writes flow exclusively through the SECURITY DEFINER RPCs of 055. The member
-- insert policy below is defense-in-depth only (draft headers created by the
-- RPC; direct inserts stay constrained by references).
create policy "stock_adjustments_member_insert" on public.stock_adjustments
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'stock_adjustments.create')
    and exists (
      select 1 from public.inventory_locations il
       where il.id = inventory_location_id
         and il.establishment_id = establishment_id
         and il.is_active
    )
  );

create policy "stock_adjustment_items_read" on public.stock_adjustment_items
  for select using (
    exists (
      select 1 from public.stock_adjustments sa
       where sa.id = stock_adjustment_id
         and belongs_to_establishment(sa.establishment_id)
         and (is_super_admin()
              or has_permission(sa.establishment_id, 'stock_adjustments.view'))
    )
  );

-- History is appendix: only the status RPCs write it, never direct inserts.
create policy "stock_adjustment_status_history_read"
  on public.stock_adjustment_status_history
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'stock_adjustments.view'))
  );

-- The 012/049 read policies on the stock tables are re-asserted with the
-- `stock_adjustments.view` reach so adjustment workflows can preview the live
-- stock (locations, quantities, costs) and the movements they generate.
drop policy if exists stock_items_read on public.stock_items;
drop policy if exists stock_movements_read on public.stock_movements;

create policy "stock_items_read" on public.stock_items
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'inventory.view')
         or has_permission(establishment_id, 'goods_receipts.view')
         or has_permission(establishment_id, 'stock_adjustments.view'))
  );

create policy "stock_movements_read" on public.stock_movements
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'inventory.view')
         or has_permission(establishment_id, 'goods_receipts.view')
         or has_permission(establishment_id, 'stock_adjustments.view'))
  );

-- ============================================================
-- 8) Permission catalog — module `stock_adjustments`
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('stock_adjustments.view',        'stock_adjustments', 'Voir les ajustements de stock',       'Consulter les ajustements de stock (pertes, casse, gaspillage...) et leurs lignes'),
  ('stock_adjustments.create',      'stock_adjustments', 'Créer un ajustement de stock',        'Créer un ajustement de stock (en-tête brouillon)'),
  ('stock_adjustments.update',      'stock_adjustments', 'Modifier un ajustement de stock',     'Modifier un ajustement en brouillon et ses lignes'),
  ('stock_adjustments.delete',      'stock_adjustments', 'Supprimer un ajustement de stock',    'Supprimer définitivement un ajustement en brouillon'),
  ('stock_adjustments.submit',      'stock_adjustments', 'Soumettre un ajustement de stock',    'Soumettre un ajustement pour approbation et validation stock'),
  ('stock_adjustments.approve',     'stock_adjustments', 'Approuver un ajustement de stock',    'Approuver un ajustement soumis'),
  ('stock_adjustments.validate',    'stock_adjustments', 'Valider un ajustement de stock',      'Valider un ajustement et sortir les quantités du stock'),
  ('stock_adjustments.cancel',      'stock_adjustments', 'Annuler un ajustement de stock',      'Annuler un ajustement non encore validé'),
  ('stock_adjustments.view_cost',   'stock_adjustments', 'Voir la valorisation des ajustements','Voir la valeur des ajustements de stock'),
  ('stock_adjustments.approve_high_value','stock_adjustments','Approuver les montants élevés',  'Approuver un ajustement dont la valeur dépasse le seuil de contrôle')
on conflict (slug) do nothing;

-- ============================================================
-- 9) Role → permission matrix
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

  -- Full workflow (super_admin/admin/manager): sees everything AND can
  -- approve/validate the stock writes.
  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_super_admin as role_id union all
    select v_admin union all
    select v_manager
  ) r
  cross join (select id from public.permissions
               where slug like 'stock_adjustments.%') p
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager: prepares and submits the document but NEVER approves the
  -- stock write (approve/validate/high-value stay with a manager-level role).
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id
    from public.permissions p
   where p.slug in ('stock_adjustments.view', 'stock_adjustments.create',
                    'stock_adjustments.update', 'stock_adjustments.delete',
                    'stock_adjustments.submit', 'stock_adjustments.cancel',
                    'stock_adjustments.view_cost')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: read-only, but sees the valuation of the adjustments.
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug in ('stock_adjustments.view', 'stock_adjustments.view_cost')
  on conflict (role_id, permission_id) do nothing;

  -- Purchasing: read-only (visibility on stock movements they cause).
  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id
    from public.permissions p
   where p.slug = 'stock_adjustments.view'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 10) System reasons seed (catalog is idempotent; labels are the French
--     fallback — the UI translates the codes via i18n)
-- ============================================================
insert into public.stock_adjustment_reasons
  (code, label, adjustment_type, is_system, is_active, sort_order)
values
  ('shrinkage',            'Perte d''inventaire (marge)', 'loss', true, true, 1),
  ('process_loss',         'Perte de process',            'loss', true, true, 2),
  ('unaccounted_loss',     'Perte non justifiée',         'loss', true, true, 3),
  ('broken_glassware',     'Casse de verrerie',           'breakage', true, true, 1),
  ('broken_packaging',     'Casse d''emballage',          'breakage', true, true, 2),
  ('handling_accident',    'Accident de manipulation',    'breakage', true, true, 3),
  ('preparation_error',    'Erreur de préparation',       'waste', true, true, 1),
  ('overproduction',       'Surproduction',               'waste', true, true, 2),
  ('presentation_quality', 'Qualité / présentation',      'waste', true, true, 3),
  ('expired_date',         'Dépassement de DLC / DLUO',   'expired', true, true, 1),
  ('spoiled',              'Produit détérioré',           'expired', true, true, 2),
  ('damaged_goods',        'Marchandise endommagée',      'damaged', true, true, 1),
  ('storage_damage',       'Dommage de stockage',         'damaged', true, true, 2),
  ('staff_meal',           'Repas du personnel',          'internal_consumption', true, true, 1),
  ('recipe_test',          'Test de recette',             'internal_consumption', true, true, 2),
  ('internal_use',         'Consommation interne',        'internal_consumption', true, true, 3),
  ('customer_sample',      'Échantillon client',          'sample', true, true, 1),
  ('tasting',              'Dégustation',                 'sample', true, true, 2),
  ('staff_personal',       'Consommation personnelle',    'staff_consumption', true, true, 1),
  ('cleaning',             'Entretien / nettoyage',       'cleaning', true, true, 1),
  ('other',                'Autre motif',                 'other', true, true, 1)
on conflict (code) where establishment_id is null do nothing;

-- ============================================================
-- 11) Indexes
-- ============================================================
create unique index if not exists uq_stock_adjustments_establishment_number
  on public.stock_adjustments (establishment_id, adjustment_number);

create index if not exists idx_stock_adjustments_establishment_status
  on public.stock_adjustments (establishment_id, status);

create index if not exists idx_stock_adjustments_location
  on public.stock_adjustments (inventory_location_id);

create index if not exists idx_stock_adjustments_type
  on public.stock_adjustments (establishment_id, adjustment_type);

create index if not exists idx_stock_adjustments_date
  on public.stock_adjustments (establishment_id, adjustment_date desc);

create index if not exists idx_stock_adjustments_reason
  on public.stock_adjustments (reason_id);

create index if not exists idx_stock_adjustments_created_at
  on public.stock_adjustments (establishment_id, created_at desc);

create index if not exists idx_stock_adjustment_items_adjustment
  on public.stock_adjustment_items (stock_adjustment_id);

create index if not exists idx_stock_adjustment_items_ingredient
  on public.stock_adjustment_items (ingredient_id);

create index if not exists idx_stock_adjustment_history_adjustment
  on public.stock_adjustment_status_history (stock_adjustment_id, created_at);