-- 049_phase_15_goods_receipts
-- Phase 15: Réception des marchandises & entrées en stock.
--
-- Legal/evolution rules:
--   * `goods_receipts` / `goods_receipt_items` / `goods_receipt_status_history`
--     are NEW tables. `stock_items` / `stock_movements` (from 012) are evolved
--     ADDITIVELY — no column is dropped or renamed,
--   * NO STOCK WRITE in this migration: `stock_items` / `stock_movements` are
--     only modified inside the atomic `validate_goods_receipt` RPC of 050,
--   * the 023 blanket `*_write` policies on the stock tables are DROPPED here:
--     all stock writes now flow exclusively through SECURITY DEFINER RPCs,
--   * receipts only exist for a `purchase_order` of the same establishment;
--     receiving without an order stays impossible by construction,
--   * every receipt number is SERVER-GENERATED (BR-YYYY-NNNNNN) by
--     `next_goods_receipt_number`, mirrors `next_purchase_order_number`,
--   * over-receipt is PROHIBITED by default: the line CHECK satisfies
--     `previously_received_quantity + received_quantity <= ordered_quantity`
--     (evolution toward `allow_over_receipt` / `over_receipt_tolerance`
--     is deferred to a later phase),
--   * stock movements reuse the normalized `movement_type = 'purchase'`
--     vocabulary of 012 and carry a `direction= 'in'`,
--   * idempotence: `stock_movements.goods_receipt_item_id` carries a UNIQUE
--     partial index, so validating the same receipt twice (retry, double
--     click, race) can never double-move the stock.
--
-- Permission slugs (new module `goods_receipts`):
--   view/create/update/delete/submit/validate/cancel.

-- ============================================================
-- 1) goods_receipts
-- ============================================================
create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  purchase_order_id uuid not null
    references public.purchase_orders(id) on delete restrict,
  receipt_number text not null,
  receipt_date date not null default current_date,
  supplier_id uuid not null
    references public.suppliers(id) on delete restrict,
  inventory_location_id uuid
    references public.inventory_locations(id) on delete set null,
  status text not null default 'draft',
  delivery_note_number text,
  supplier_invoice_number text,
  subtotal numeric(14,3) not null default 0,
  discount_amount numeric(14,3) not null default 0,
  tax_amount numeric(14,3) not null default 0,
  total_amount numeric(14,3) not null default 0,
  notes text,
  internal_notes text,
  received_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goods_receipts_status_check check (
    status in ('draft', 'pending_validation', 'validated', 'cancelled')
  ),
  constraint goods_receipts_number_check check (
    receipt_number ~ '^BR-[0-9]{4}-[0-9]{6}$'
  ),
  constraint goods_receipts_date_check check (receipt_date >= '2000-01-01'),
  constraint goods_receipts_amount_check check (
    subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0
    and total_amount >= 0
  ),
  constraint goods_receipts_pending_validation_fields check (
    status <> 'validated'
    or (validated_by is not null and validated_at is not null)
  ),
  constraint goods_receipts_cancelled_fields check (
    status <> 'cancelled'
    or (cancelled_by is not null and cancelled_at is not null)
  )
);

-- ============================================================
-- 2) goods_receipt_items
-- ============================================================
-- Snapshot columns (description, supplier_sku, unit price, discount, tax rate)
-- copy the linked purchase_order_item at creation time — the document never
-- re-prices retroactively, exactly like its purchase order.
create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null
    references public.goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid not null
    references public.purchase_order_items(id) on delete restrict,
  ingredient_id uuid not null
    references public.ingredients(id) on delete restrict,
  description text,
  supplier_sku text,
  ordered_quantity numeric not null,
  previously_received_quantity numeric not null default 0,
  received_quantity numeric not null default 0,
  accepted_quantity numeric not null default 0,
  rejected_quantity numeric not null default 0,
  purchase_unit_id uuid references public.units(id) on delete set null,
  stock_unit_id uuid references public.units(id) on delete set null,
  conversion_factor numeric not null default 1,
  unit_price numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  subtotal numeric not null default 0,
  total_amount numeric not null default 0,
  lot_number text,
  batch_number text,
  expiry_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goods_receipt_items_ordered_check check (ordered_quantity > 0),
  constraint goods_receipt_items_previously_check check (previously_received_quantity >= 0),
  constraint goods_receipt_items_received_check check (received_quantity >= 0),
  constraint goods_receipt_items_accepted_check check (accepted_quantity >= 0),
  constraint goods_receipt_items_rejected_check check (rejected_quantity >= 0),
  constraint goods_receipt_items_split_check check (
    accepted_quantity + rejected_quantity <= received_quantity
  ),
  -- Over-receipt guard (policy: no tolerance before a later phase).
  constraint goods_receipt_items_overdelivery_check check (
    previously_received_quantity + received_quantity <= ordered_quantity
  ),
  constraint goods_receipt_items_price_check check (unit_price >= 0),
  constraint goods_receipt_items_discount_check check (discount_amount >= 0),
  constraint goods_receipt_items_tax_check check (tax_rate >= 0),
  constraint goods_receipt_items_subtotal_check check (subtotal >= 0),
  constraint goods_receipt_items_total_check check (total_amount >= 0),
  constraint goods_receipt_items_conversion_check check (conversion_factor >= 0)
);

-- ============================================================
-- 3) goods_receipt_status_history (append-only ledger)
-- ============================================================
create table if not exists public.goods_receipt_status_history (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null
    references public.establishments(id) on delete cascade,
  goods_receipt_id uuid not null
    references public.goods_receipts(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint goods_receipt_history_from_check check (
    from_status is null
    or from_status in ('draft', 'pending_validation', 'validated', 'cancelled')
  ),
  constraint goods_receipt_history_to_check check (
    to_status in ('draft', 'pending_validation', 'validated', 'cancelled')
  )
);

-- ============================================================
-- 4) Receipt numbering (server-generated, mirrors BC numbering)
-- ============================================================
create or replace function public.next_goods_receipt_number(p_est uuid)
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
    hashtext('goods_receipt_number:' || p_est::text || ':' || v_year));

  select coalesce(max(
      substring(gr.receipt_number from 'BR-[0-9]{4}-([0-9]{6})$')::integer
    ), 0)
    into v_max
    from public.goods_receipts gr
   where gr.establishment_id = p_est
     and substring(gr.receipt_number from '^BR-[0-9]{4}-') = ('BR-' || v_year || '-')
     and gr.receipt_number ~ '^BR-[0-9]{4}-[0-9]{6}$';

  return 'BR-' || v_year || '-' || lpad((v_max + 1)::text, 6, '0');
end $$;

-- ============================================================
-- 5) Reference guards (used by RLS + the atomic RPCs of 050)
-- ============================================================
create or replace function public.goods_receipt_references_valid(
  p_est uuid,
  p_purchase_order_id uuid,
  p_supplier_id uuid,
  p_inventory_location_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.purchase_orders po
     where po.id = p_purchase_order_id
       and po.establishment_id = p_est
       and po.supplier_id = p_supplier_id
       and po.status in ('approved', 'sent', 'partially_received')
  )
  and (
    p_inventory_location_id is null
    or exists (
      select 1 from public.inventory_locations il
       where il.id = p_inventory_location_id
         and il.establishment_id = p_est
         and il.is_active
    )
  );
$$;

create or replace function public.goods_receipt_item_references_valid(
  p_est uuid,
  p_goods_receipt_id uuid,
  p_purchase_order_item_id uuid,
  p_ingredient_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.goods_receipt_items gri
      join public.goods_receipts gr on gr.id = gri.goods_receipt_id
      join public.purchase_orders po on po.id = gr.purchase_order_id
      join public.purchase_order_items poi
        on poi.id = gri.purchase_order_item_id
     where gri.id = p_purchase_order_item_id
       and gr.establishment_id = p_est
       and poi.purchase_order_id = gr.purchase_order_id
       and poi.ingredient_id = p_ingredient_id
       and exists (
         select 1 from public.ingredients i
          where i.id = p_ingredient_id and i.establishment_id = p_est
       )
  );
$$;

-- ============================================================
-- 6) stock_movements evolution (additive; 012 untouched columns)
-- ============================================================
-- Movement-type vocabulary from 012 maps to a normalized direction:
--   purchase/transfer_in/opening/return → 'in'   (sale_consumption is 'out')
--   transfer_out/adjustment_out/waste/sale_consumption → 'out'
alter table public.stock_movements
  add column if not exists direction text;

update public.stock_movements
   set direction = case
     when movement_type in ('transfer_out', 'adjustment_out', 'waste',
                            'sale_consumption') then 'out'
     else 'in'
   end;

alter table public.stock_movements
  alter column direction set not null,
  alter column direction set default 'in';

alter table public.stock_movements
  add constraint stock_movements_direction_check
    check (direction in ('in', 'out'));

-- Physical quantities: base quantity is ALWAYS expressed in the ingredient
-- base unit; `unit_id` stays the historical purchase-unit snapshot.
alter table public.stock_movements
  add column if not exists base_quantity numeric,
  add column if not exists base_unit_id uuid
    references public.units(id) on delete set null,
  add column if not exists lot_number text,
  add column if not exists batch_number text,
  add column if not exists expiry_date date,
  add column if not exists goods_receipt_id uuid
    references public.goods_receipts(id) on delete set null,
  add column if not exists goods_receipt_item_id uuid
    references public.goods_receipt_items(id) on delete set null;

-- Idempotence: any movement that already materialised a receipt line cannot
-- be created again (protects validate against retries/races).
create unique index if not exists uq_stock_movements_receipt_item
  on public.stock_movements (goods_receipt_item_id)
  where goods_receipt_item_id is not null;

-- ============================================================
-- 7) RLS hardening on the 012 stock tables + inventory_locations
-- ============================================================
-- The blanked 023 `*_write` policies on stock come DOWN: stock is now only
-- mutated by SECURITY DEFINER RPCs. Reads are gated behind a permission
-- (inventory.view or goods_receipts.view) instead of any member.
drop policy if exists inventory_locations_write on public.inventory_locations;
drop policy if exists stock_items_write on public.stock_items;
drop policy if exists stock_movements_write on public.stock_movements;
drop policy if exists inventory_locations_read on public.inventory_locations;
drop policy if exists stock_items_read on public.stock_items;
drop policy if exists stock_movements_read on public.stock_movements;

create policy "inventory_locations_read" on public.inventory_locations
  for select using (belongs_to_establishment(establishment_id));

create policy "stock_items_read" on public.stock_items
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'inventory.view')
         or has_permission(establishment_id, 'goods_receipts.view'))
  );

create policy "stock_movements_read" on public.stock_movements
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'inventory.view')
         or has_permission(establishment_id, 'goods_receipts.view'))
  );

-- No member-level write policies exist anymore: stock writes are RPC-only.

-- ============================================================
-- 8) RLS — the three new tables
-- ============================================================
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.goods_receipt_status_history enable row level security;

create policy "goods_receipts_read" on public.goods_receipts
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'goods_receipts.view'))
  );

-- Defense in depth: drafts/pending only, updaters only. The real writes flow
-- through the atomic RPCs (which re-check permission, status and references).
create policy "goods_receipts_member_insert" on public.goods_receipts
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'goods_receipts.create')
    and goods_receipt_references_valid(
      establishment_id, purchase_order_id, supplier_id, inventory_location_id)
  );

create policy "goods_receipts_member_update" on public.goods_receipts
  for update using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'goods_receipts.update')
    and status in ('draft', 'pending_validation')
  ) with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'goods_receipts.update')
    and goods_receipt_references_valid(
      establishment_id, purchase_order_id, supplier_id, inventory_location_id)
  );

create policy "goods_receipts_member_delete" on public.goods_receipts
  for delete using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'goods_receipts.delete')
    and status = 'draft'
  );

create policy "goods_receipt_items_read" on public.goods_receipt_items
  for select using (
    exists (
      select 1 from public.goods_receipts gr
       where gr.id = goods_receipt_id
         and belongs_to_establishment(gr.establishment_id)
         and (is_super_admin()
              or has_permission(gr.establishment_id, 'goods_receipts.view'))
    )
  );

-- Lines only belong to a draft/pending receipt at write time; the header
-- references stay consistent (the header update policy re-checks them).
create policy "goods_receipt_items_member_write" on public.goods_receipt_items
  for all using (
    exists (
      select 1 from public.goods_receipts gr
       where gr.id = goods_receipt_id
         and belongs_to_establishment(gr.establishment_id)
         and has_permission(gr.establishment_id, 'goods_receipts.update')
         and gr.status in ('draft', 'pending_validation')
    )
  ) with check (
    exists (
      select 1 from public.goods_receipts gr
       where gr.id = goods_receipt_id
         and belongs_to_establishment(gr.establishment_id)
         and has_permission(gr.establishment_id, 'goods_receipts.update')
         and gr.status in ('draft', 'pending_validation')
    )
  );

-- History is appendix: only the status RPCs write it, never direct inserts.
create policy "goods_receipt_status_history_read"
  on public.goods_receipt_status_history
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin()
         or has_permission(establishment_id, 'goods_receipts.view'))
  );

-- ============================================================
-- 9) Permission catalog — module `goods_receipts`
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('goods_receipts.view',     'goods_receipts', 'Voir les réceptions',             'Consulter les réceptions de marchandises et leurs lignes'),
  ('goods_receipts.create',   'goods_receipts', 'Créer une réception',             'Créer un brouillon de réception depuis un bon de commande'),
  ('goods_receipts.update',   'goods_receipts', 'Modifier une réception',          'Modifier une réception en brouillon ou en attente de validation'),
  ('goods_receipts.delete',   'goods_receipts', 'Supprimer une réception',         'Supprimer définitivement une réception en brouillon'),
  ('goods_receipts.submit',   'goods_receipts', 'Soumettre une réception',         'Soumettre une réception pour validation stock'),
  ('goods_receipts.validate', 'goods_receipts', 'Valider une réception',           'Valider une réception et entrer les marchandises en stock'),
  ('goods_receipts.cancel',   'goods_receipts', 'Annuler une réception',           'Annuler une réception non encore validée')
on conflict (slug) do nothing;

-- ============================================================
-- 10) Role → permission matrix
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

  -- Full workflow (super_admin/admin/managers/purchasing keep all 7 slugs;
  -- loaned only through 045 re-insertion — grants are re-asserted here).
  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_super_admin as role_id union all
    select v_admin union all
    select v_manager union all
    select v_purchasing
  ) r
  cross join (select id from public.permissions
               where slug like 'goods_receipts.%') p
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager: document + reception workflow but NEVER validates stock
  -- (validation belongs to a manager/purchasing with goods_receipts.validate).
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id
    from public.permissions p
   where p.slug in ('goods_receipts.view', 'goods_receipts.create',
                    'goods_receipts.update', 'goods_receipts.delete',
                    'goods_receipts.submit', 'goods_receipts.cancel')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: read-only.
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id
    from public.permissions p
   where p.slug = 'goods_receipts.view'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 11) Indexes
-- ============================================================
create unique index if not exists uq_goods_receipts_establishment_number
  on public.goods_receipts (establishment_id, receipt_number);

create index if not exists idx_goods_receipts_establishment_status
  on public.goods_receipts (establishment_id, status);

create index if not exists idx_goods_receipts_receipt_date
  on public.goods_receipts (establishment_id, receipt_date desc);

create index if not exists idx_goods_receipts_purchase_order
  on public.goods_receipts (purchase_order_id);

create index if not exists idx_goods_receipts_supplier
  on public.goods_receipts (establishment_id, supplier_id);

create index if not exists idx_goods_receipts_location
  on public.goods_receipts (inventory_location_id);

create index if not exists idx_goods_receipts_received_by
  on public.goods_receipts (received_by);

create index if not exists idx_goods_receipt_items_receipt
  on public.goods_receipt_items (goods_receipt_id);

create index if not exists idx_goods_receipt_items_po_item
  on public.goods_receipt_items (purchase_order_item_id);

create index if not exists idx_goods_receipt_items_ingredient
  on public.goods_receipt_items (ingredient_id);

create index if not exists idx_goods_receipt_history_receipt
  on public.goods_receipt_status_history (goods_receipt_id, created_at);