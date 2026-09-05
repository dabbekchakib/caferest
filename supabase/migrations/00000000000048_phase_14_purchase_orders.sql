-- 048_phase_14_purchase_orders
-- Phase 14: Purchase orders (achats & bons de commande fournisseurs).
--
-- Legal/evolution rules:
--   * `purchase_orders` / `purchase_order_items` were scaffolded by 011 and
--     written through the blanket 023 `*_write` policies — this migration
--     NEVER recreates them: it evolves them additively and replaces the
--     blanket RLS with permission-gated policies,
--   * the order snapshots the COMMERCIAL data at line-creation time
--     (description, supplier_sku, purchase unit, unit_price, tax_rate),
--     exactly like a paper order: a price change in the supplier catalog
--     never alters an existing order (no retroactive re-pricing),
--   * every amount is recomputed SERVER-SIDE inside the atomic RPCs below;
--     the browser is never trusted with totals,
--   * NO STOCK MOVEMENT in this phase: received_quantity stays 0 and
--     remaining_quantity equals the ordered quantity (Phase 15 reception
--     consumes them),
--   * shipping / other charges are order-level and never apportioned over
--     ingredient costs in this phase,
--   * transitions are DB-enforced: a server action can only move the order
--     forward through the allowed flow (submit → approve → send, cancel at
--     any pre-received step, close after full reception),
--   * every transition is append-only in `purchase_order_status_history`.
--
-- Permission slugs (module `purchases`, which already carries
-- view/create/update/delete since 027): purchases.submit, purchases.approve,
-- purchases.send, purchases.cancel, purchases.close, purchases.duplicate.
-- purchases.receive stays reserved for Phase 15.

-- ============================================================
-- 1) purchase_orders evolution (additive; legacy columns renamed)
-- ============================================================

-- RPC used by the numbering backfill below (defined before the CHECKs).
create or replace function public.next_purchase_order_number(p_est uuid)
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
    hashtext('purchase_order_number:' || p_est::text || ':' || v_year));

  select coalesce(max(
      substring(po.order_number from 'BC-[0-9]{4}-([0-9]{6})$')::integer
    ), 0)
    into v_max
    from public.purchase_orders po
   where po.establishment_id = p_est
     and substring(po.order_number from '^BC-[0-9]{4}-') = ('BC-' || v_year || '-')
     and po.order_number ~ '^BC-[0-9]{4}-[0-9]{6}$';

  return 'BC-' || v_year || '-' || lpad((v_max + 1)::text, 6, '0');
end $$;

-- Align names with the Phase-14 terminology (columns are unused legacy
-- scaffolding — safe to rename, nothing else references them).
alter table public.purchase_orders
  rename column reference to order_number;

alter table public.purchase_orders
  rename column expected_date to expected_delivery_date;

-- Rename the unique index that followed `reference`.
alter index public.uq_purchase_orders_establishment_reference
  rename to uq_purchase_orders_establishment_order_number;

-- Map legacy scaffolded statuses onto the Phase-14 flow (no rows expected,
-- but keep any historical row readable).
update public.purchase_orders
   set status = case status
         when 'pending'          then 'pending_approval'
         when 'ordered'          then 'sent'
         when 'received'         then 'fully_received'
         else status
       end
 where status in ('pending', 'ordered', 'received');

-- Replace the legacy status CHECK with the Phase-14 status set.
alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

-- Backfill legacy order numbers so every row satisfies the BC pattern before
-- the CHECK is added. Unique per establishment via row_number.
with legacy as (
  select po.id,
         row_number() over (partition by po.establishment_id
                            order by po.created_at, po.id) as rn
    from public.purchase_orders po
   where not (po.order_number ~ '^BC-[0-9]{4}-[0-9]{6}$')
)
update public.purchase_orders po
   set order_number = 'BC-' || to_char(now(), 'YYYY') || '-' ||
                      lpad(l.rn::text, 6, '0')
  from legacy l
 where po.id = l.id;

alter table public.purchase_orders
  add column if not exists currency_code text not null default 'TND',
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists shipping_amount numeric not null default 0,
  add column if not exists other_charges numeric not null default 0,
  add column if not exists internal_notes text,
  add column if not exists supplier_notes text,
  add column if not exists shipping_address text,
  add column if not exists billing_address text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists updated_by uuid,
  add column if not exists cancellation_reason text;

alter table public.purchase_orders
  add constraint purchase_orders_status_check check (
    status in ('draft', 'pending_approval', 'approved', 'sent',
               'partially_received', 'fully_received', 'cancelled', 'closed')
  ),
  add constraint purchase_orders_number_check check (
    order_number ~ '^BC-[0-9]{4}-[0-9]{6}$'
  ),
  add constraint purchase_orders_currency_check check (
    currency_code ~ '^[A-Z]{3}$'
  ),
  add constraint purchase_orders_discount_check check (discount_amount >= 0),
  add constraint purchase_orders_shipping_check check (shipping_amount >= 0),
  add constraint purchase_orders_charges_check check (other_charges >= 0),
  add constraint purchase_orders_delivery_check check (
    expected_delivery_date is null or expected_delivery_date >= order_date
  );

create index if not exists idx_purchase_orders_est_status
  on public.purchase_orders (establishment_id, status);
create index if not exists idx_purchase_orders_est_order_date
  on public.purchase_orders (establishment_id, order_date desc);
create index if not exists idx_purchase_orders_est_supplier
  on public.purchase_orders (establishment_id, supplier_id);

-- ============================================================
-- 2) purchase_order_items evolution
-- ============================================================
alter table public.purchase_order_items
  rename column unit_id to purchase_unit_id;

alter table public.purchase_order_items
  add column if not exists ingredient_supplier_id uuid,
  add column if not exists description text,
  add column if not exists supplier_sku text,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists tax_rate numeric not null default 0,
  add column if not exists subtotal numeric not null default 0,
  add column if not exists received_quantity numeric not null default 0,
  add column if not exists remaining_quantity numeric not null default 0,
  add column if not exists notes text,
  add column if not exists sort_order integer not null default 0;

-- Safe to set_null: the order must survive the supplier removing the item
-- from their catalog (the snapshot columns carry the commercial data).
alter table public.purchase_order_items
  add constraint purchase_order_items_ins_fk
    foreign key (ingredient_supplier_id)
    references public.ingredient_suppliers (id)
    on delete set null;

-- Backfill the reception-ready columns (Phase 14: every unit is pending).
update public.purchase_order_items
   set received_quantity = received_quantity,
       remaining_quantity = quantity
 where remaining_quantity = 0 and received_quantity = 0;

-- Replace the legacy quantity >= 0 with a strictly positive one.
alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_quantity_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_quantity_check check (quantity > 0),
  add constraint purchase_order_items_discount_type_check check (
    discount_type in ('none', 'percentage', 'fixed')
  ),
  add constraint purchase_order_items_discount_value_check check (
    discount_value >= 0
    and (discount_type <> 'percentage' or discount_value <= 100)
  ),
  add constraint purchase_order_items_discount_amount_check check (
    discount_amount >= 0
  ),
  add constraint purchase_order_items_subtotal_check check (subtotal >= 0),
  add constraint purchase_order_items_tax_rate_check check (tax_rate >= 0),
  add constraint purchase_order_items_received_check check (
    received_quantity >= 0
  ),
  add constraint purchase_order_items_remaining_check check (
    remaining_quantity >= 0
  );

create index if not exists idx_poi_ingredient_supplier
  on public.purchase_order_items (ingredient_supplier_id);

-- Phase 14: a new line is always fully pending reception.
create or replace function public.trg_poi_remaining_quantity_apply()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.remaining_quantity := new.quantity;
  return new;
end $$;

drop trigger if exists trg_poi_remaining_quantity on public.purchase_order_items;
create trigger trg_poi_remaining_quantity
  before insert on public.purchase_order_items
  for each row
  execute function public.trg_poi_remaining_quantity_apply();

-- ============================================================
-- 3) purchase_order_status_history (append-only transition ledger)
-- ============================================================
create table if not exists public.purchase_order_status_history (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null
    references public.purchase_orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint purchase_order_status_history_from_check check (
    from_status is null or from_status in (
      'draft', 'pending_approval', 'approved', 'sent',
      'partially_received', 'fully_received', 'cancelled', 'closed'
    )
  ),
  constraint purchase_order_status_history_to_check check (
    to_status in (
      'draft', 'pending_approval', 'approved', 'sent',
      'partially_received', 'fully_received', 'cancelled', 'closed'
    )
  )
);

create index if not exists idx_purchase_order_history_order
  on public.purchase_order_status_history (purchase_order_id, created_at);

-- ============================================================
-- 4) Cross-establishment reference guards (security definer, RLS-proof)
-- ============================================================
create or replace function public.purchase_order_references_valid(
  p_establishment_id uuid,
  p_supplier_id uuid,
  p_currency_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.suppliers s
      where s.id = p_supplier_id
        and s.establishment_id = p_establishment_id
    )
    and (p_currency_code ~ '^[A-Z]{3}$')
$$;

create or replace function public.purchase_order_item_references_valid(
  p_establishment_id uuid,
  p_order_supplier_id uuid,
  p_ingredient_id uuid,
  p_ingredient_supplier_id uuid,
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
    (p_ingredient_id is null or exists (
      select 1 from public.ingredients i
      where i.id = p_ingredient_id
        and i.establishment_id = p_establishment_id
    ))
    and (p_ingredient_supplier_id is null or exists (
      select 1 from public.ingredient_suppliers ins
      where ins.id = p_ingredient_supplier_id
        and ins.establishment_id = p_establishment_id
        and ins.ingredient_id = p_ingredient_id
        and ins.supplier_id = p_order_supplier_id
    ))
    and (p_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_unit_id
        and (u.establishment_id = p_establishment_id
             or u.establishment_id is null)
    ))
    and (p_tax_id is null or exists (
      select 1 from public.taxes t
      where t.id = p_tax_id
        and t.establishment_id = p_establishment_id
    ))
$$;

-- ============================================================
-- 5) Atomic workflow RPCs (security definer, permission + status checked
--    inside, establishment scoped, amounts recomputed server-side)
-- ============================================================

-- Helper used by creation/update: recomputes a line from its inputs.
-- The DB is the source of truth — the client totals are always ignored.
create or replace function public.purchase_order_item_amounts(
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_tax_rate numeric
)
returns table (
  out_subtotal numeric,
  out_discount_amount numeric,
  out_tax_amount numeric,
  out_total numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_gross numeric := p_quantity * p_unit_price;
  v_disc numeric;
begin
  if p_discount_type = 'percentage' then
    v_disc := v_gross * p_discount_value / 100;
  elsif p_discount_type = 'fixed' then
    v_disc := p_discount_value;
  else
    v_disc := 0;
  end if;

  if v_disc < 0 or v_disc > v_gross then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_discount_invalid';
  end if;

  -- tax_rate is expressed like taxes.rate: percentage points (7 == 7%).
  out_discount_amount := v_disc;
  out_subtotal := v_gross - v_disc;
  out_tax_amount := out_subtotal * p_tax_rate / 100;
  out_total := out_subtotal + out_tax_amount;
  return next;
end $$;

-- Insert the items + recompute the header totals of `p_order_id`.
-- p_items is the JSONB array of {ingredient_id, ingredient_supplier_id,
-- description, supplier_sku, quantity, purchase_unit_id, unit_price,
-- discount_type, discount_value, tax_id, tax_rate, notes, sort_order}.
-- Returns the recomputed order totals.
create or replace function public.restore_purchase_order_lines(
  p_est uuid,
  p_order_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  out_subtotal numeric,
  out_discount numeric,
  out_tax numeric,
  out_total numeric
)
returns record
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_item_id uuid;
  v_status text;
  v_line record;
begin
  -- Both the creation and the update flows feed lines through this helper.
  if not (has_permission(p_est, 'purchases.update')
          or has_permission(p_est, 'purchases.create')) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status not in ('draft', 'pending_approval') then
    raise exception using errcode = 'P0001', message = 'purchase_order_locked';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'purchase_order_empty';
  end if;

  delete from public.purchase_order_items
   where purchase_order_id = p_order_id;

  out_subtotal := 0;
  out_discount := 0;
  out_tax := 0;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not purchase_order_item_references_valid(
         p_est, p_supplier_id,
         (v_item ->> 'ingredient_id')::uuid,
         (v_item ->> 'ingredient_supplier_id')::uuid,
         (v_item ->> 'purchase_unit_id')::uuid,
         (v_item ->> 'tax_id')::uuid
       ) then
      raise exception using errcode = 'P0001',
        message = 'cross_establishment_reference';
    end if;

    -- Recompute the line amounts — the DB is the source of truth.
    select * into v_line
      from purchase_order_item_amounts(
             (v_item ->> 'quantity')::numeric,
             (v_item ->> 'unit_price')::numeric,
             coalesce(nullif(v_item ->> 'discount_type', ''), 'none'),
             coalesce((v_item ->> 'discount_value')::numeric, 0),
             coalesce((v_item ->> 'tax_rate')::numeric, 0)
           );

    insert into public.purchase_order_items (
      purchase_order_id, ingredient_id, ingredient_supplier_id,
      description, supplier_sku,
      quantity, purchase_unit_id, unit_price,
      discount_type, discount_value, discount_amount,
      tax_id, tax_rate, tax_amount,
      subtotal, total, remaining_quantity, notes, sort_order
    ) values (
      p_order_id,
      (v_item ->> 'ingredient_id')::uuid,
      (v_item ->> 'ingredient_supplier_id')::uuid,
      (v_item ->> 'description'),
      (v_item ->> 'supplier_sku'),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'purchase_unit_id')::uuid,
      (v_item ->> 'unit_price')::numeric,
      coalesce(nullif(v_item ->> 'discount_type', ''), 'none'),
      coalesce((v_item ->> 'discount_value')::numeric, 0),
      v_line.out_discount_amount,
      (v_item ->> 'tax_id')::uuid,
      coalesce((v_item ->> 'tax_rate')::numeric, 0),
      v_line.out_tax_amount,
      v_line.out_subtotal,
      v_line.out_total,
      0,
      (v_item ->> 'notes'),
      coalesce((v_item ->> 'sort_order')::integer, 0)
    )
    returning id into v_item_id;

    out_subtotal := out_subtotal + v_line.out_subtotal;
    out_discount := out_discount + v_line.out_discount_amount;
    out_tax      := out_tax      + v_line.out_tax_amount;
  end loop;

  out_total := out_subtotal + out_tax;
  return;
end $$;

-- Create the order (status draft), its lines and the initial history row.
create or replace function public.create_purchase_order(
  p_est uuid,
  p_supplier_id uuid,
  p_order_date timestamptz,
  p_expected_delivery_date timestamptz,
  p_currency_code text,
  p_notes text,
  p_internal_notes text,
  p_supplier_notes text,
  p_shipping_address text,
  p_billing_address text,
  p_shipping_amount numeric,
  p_other_charges numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
  v_number text;
begin
  if not has_permission(p_est, 'purchases.create') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'purchase_order_empty';
  end if;
  if not purchase_order_references_valid(
       p_est, p_supplier_id, p_currency_code
     ) then
    raise exception using errcode = 'P0001',
      message = 'cross_establishment_reference';
  end if;

  v_number := next_purchase_order_number(p_est);

  insert into public.purchase_orders (
    establishment_id, order_number, supplier_id, status, order_date,
    expected_delivery_date, currency_code, notes, internal_notes,
    supplier_notes, shipping_address, billing_address,
    shipping_amount, other_charges, created_by, updated_by
  ) values (
    p_est, v_number, p_supplier_id, 'draft',
    coalesce(p_order_date, now()), p_expected_delivery_date,
    p_currency_code, p_notes, p_internal_notes,
    p_supplier_notes, p_shipping_address, p_billing_address,
    coalesce(p_shipping_amount, 0), coalesce(p_other_charges, 0),
    auth.uid(), auth.uid()
  )
  returning id into v_order_id;

  select *
    into v_subtotal, v_discount, v_tax, v_total
    from restore_purchase_order_lines(
           p_est, v_order_id, p_supplier_id, p_items
         );

  update public.purchase_orders
     set subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         total = v_total + coalesce(p_shipping_amount, 0)
                      + coalesce(p_other_charges, 0)
   where id = v_order_id;

  insert into public.purchase_order_status_history (
    purchase_order_id, from_status, to_status, changed_by
  ) values (
    v_order_id, null, 'draft', auth.uid()
  );

  return v_order_id;
end $$;

-- Update a draft / pending approval order: header + lines in ONE transaction.
create or replace function public.update_purchase_order(
  p_est uuid,
  p_order_id uuid,
  p_supplier_id uuid,
  p_order_date timestamptz,
  p_expected_delivery_date timestamptz,
  p_currency_code text,
  p_notes text,
  p_internal_notes text,
  p_supplier_notes text,
  p_shipping_address text,
  p_billing_address text,
  p_shipping_amount numeric,
  p_other_charges numeric,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
begin
  if not has_permission(p_est, 'purchases.update') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status not in ('draft', 'pending_approval') then
    raise exception using errcode = 'P0001', message = 'purchase_order_locked';
  end if;
  if not purchase_order_references_valid(
       p_est, p_supplier_id, p_currency_code
     ) then
    raise exception using errcode = 'P0001',
      message = 'cross_establishment_reference';
  end if;

  update public.purchase_orders
     set supplier_id = p_supplier_id,
         order_date = coalesce(p_order_date, order_date),
         expected_delivery_date = p_expected_delivery_date,
         currency_code = p_currency_code,
         notes = p_notes,
         internal_notes = p_internal_notes,
         supplier_notes = p_supplier_notes,
         shipping_address = p_shipping_address,
         billing_address = p_billing_address,
         shipping_amount = coalesce(p_shipping_amount, 0),
         other_charges = coalesce(p_other_charges, 0),
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  select *
    into v_subtotal, v_discount, v_tax, v_total
    from restore_purchase_order_lines(
           p_est, p_order_id, p_supplier_id, p_items
         );

  update public.purchase_orders
     set subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         total = v_total + coalesce(p_shipping_amount, 0)
                      + coalesce(p_other_charges, 0)
   where id = p_order_id;
end $$;

-- Generic transition ledger append (permission + history in one place).
create or replace function public.purchase_order_set_status(
  p_est uuid,
  p_order_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_permission(p_est, 'purchases.update')
          or has_permission(p_est, 'purchases.submit')
          or has_permission(p_est, 'purchases.approve')
          or has_permission(p_est, 'purchases.send')
          or has_permission(p_est, 'purchases.cancel')
          or has_permission(p_est, 'purchases.close')) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  insert into public.purchase_order_status_history (
    purchase_order_id, from_status, to_status, reason, changed_by
  ) values (
    p_order_id, p_from_status, p_to_status, p_reason, auth.uid()
  );
end $$;

create or replace function public.submit_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.submit') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  update public.purchase_orders
     set status = 'pending_approval',
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  perform purchase_order_set_status(
    p_est, p_order_id, 'draft', 'pending_approval', null);
end $$;

create or replace function public.approve_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.approve') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'pending_approval' then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  update public.purchase_orders
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  perform purchase_order_set_status(
    p_est, p_order_id, 'pending_approval', 'approved', null);
end $$;

create or replace function public.send_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.send') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'approved' then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  update public.purchase_orders
     set status = 'sent',
         sent_at = now(),
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  perform purchase_order_set_status(
    p_est, p_order_id, 'approved', 'sent', null);
end $$;

create or replace function public.cancel_purchase_order(
  p_est uuid,
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.cancel') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status not in ('draft', 'pending_approval', 'approved', 'sent',
                      'partially_received', 'fully_received') then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  update public.purchase_orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  perform purchase_order_set_status(
    p_est, p_order_id, v_status, 'cancelled', p_reason);
end $$;

create or replace function public.close_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.close') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'fully_received' then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  update public.purchase_orders
     set status = 'closed',
         closed_at = now(),
         updated_by = auth.uid()
   where id = p_order_id and establishment_id = p_est;

  perform purchase_order_set_status(
    p_est, p_order_id, 'fully_received', 'closed', null);
end $$;

-- Drafts may be physically removed; everything else is history-protected.
create or replace function public.delete_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not has_permission(p_est, 'purchases.delete') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'purchase_order_locked';
  end if;

  delete from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;
end $$;

-- Duplicate any order into a brand-new draft (fresh number, snapshots kept).
create or replace function public.duplicate_purchase_order(
  p_est uuid,
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_number text;
  v_shipping numeric;
  v_charges numeric;
begin
  if not has_permission(p_est, 'purchases.duplicate')
     or not has_permission(p_est, 'purchases.create') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select shipping_amount, other_charges
    into v_shipping, v_charges
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;

  v_number := next_purchase_order_number(p_est);

  insert into public.purchase_orders (
    establishment_id, order_number, supplier_id, status, order_date,
    expected_delivery_date, currency_code, notes, internal_notes,
    supplier_notes, shipping_address, billing_address,
    shipping_amount, other_charges, created_by, updated_by
  ) select
    p_est, v_number, src.supplier_id, 'draft',
    now(), src.expected_delivery_date,
    src.currency_code, src.notes, src.internal_notes,
    src.supplier_notes, src.shipping_address, src.billing_address,
    coalesce(src.shipping_amount, 0), coalesce(src.other_charges, 0),
    auth.uid(), auth.uid()
    from public.purchase_orders src
   where src.id = p_order_id and src.establishment_id = p_est
  returning id into v_new_id;

  insert into public.purchase_order_items (
    purchase_order_id, ingredient_id, ingredient_supplier_id,
    description, supplier_sku,
    quantity, purchase_unit_id, unit_price,
    discount_type, discount_value, discount_amount,
    tax_id, tax_rate, tax_amount,
    subtotal, total, received_quantity, remaining_quantity, notes, sort_order
  )
  select v_new_id, ingredient_id, ingredient_supplier_id,
         description, supplier_sku,
         quantity, purchase_unit_id, unit_price,
         discount_type, discount_value, discount_amount,
         tax_id, tax_rate, tax_amount,
         subtotal, total, 0, quantity, notes, sort_order
    from public.purchase_order_items
   where purchase_order_id = p_order_id;

  perform refresh_purchase_order_totals(
    p_est, v_new_id, v_shipping, v_charges);

  return v_new_id;
end $$;

-- Reset the totals from the order's own lines (used by duplicate + demo seed;
-- draft/pending only so direct calls never rewrite settled amounts).
create or replace function public.refresh_purchase_order_totals(
  p_est uuid,
  p_order_id uuid,
  p_shipping_amount numeric,
  p_other_charges numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
begin
  select status into v_status
    from public.purchase_orders
   where id = p_order_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'purchase_order_locked';
  end if;

  select coalesce(sum(subtotal), 0),
         coalesce(sum(discount_amount), 0),
         coalesce(sum(tax_amount), 0),
         coalesce(sum(total), 0)
    into v_subtotal, v_discount, v_tax, v_total
    from public.purchase_order_items
   where purchase_order_id = p_order_id;

  update public.purchase_orders
     set subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         total = v_total + coalesce(p_shipping_amount, 0)
                      + coalesce(p_other_charges, 0)
   where id = p_order_id and establishment_id = p_est;

  insert into public.purchase_order_status_history (
    purchase_order_id, from_status, to_status, changed_by
  ) values (p_order_id, null, 'draft', auth.uid());
end $$;

-- ============================================================
-- 6) RLS — permission-gated (replaces the 023 blanket policies)
-- ============================================================
drop policy if exists purchase_orders_read on public.purchase_orders;
drop policy if exists purchase_orders_write on public.purchase_orders;
drop policy if exists purchase_order_items_read on public.purchase_order_items;
drop policy if exists purchase_order_items_write on public.purchase_order_items;

create policy "purchase_orders_read" on public.purchase_orders
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin() or has_permission(establishment_id, 'purchases.view'))
  );

create policy "purchase_orders_member_insert" on public.purchase_orders
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'purchases.create')
  );

create policy "purchase_orders_member_update" on public.purchase_orders
  for update using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'purchases.update')
  ) with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'purchases.update')
  );

create policy "purchase_orders_member_delete" on public.purchase_orders
  for delete using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'purchases.delete')
  );

create policy "purchase_order_items_read" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and belongs_to_establishment(po.establishment_id)
        and (is_super_admin()
             or has_permission(po.establishment_id, 'purchases.view'))
    )
  );

-- Defense in depth: drafts/pending only, updaters only. The real writes flow
-- through the atomic RPCs (which re-check permission and status).
create policy "purchase_order_items_member_write" on public.purchase_order_items
  for all using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and belongs_to_establishment(po.establishment_id)
        and has_permission(po.establishment_id, 'purchases.update')
        and po.status in ('draft', 'pending_approval')
    )
  ) with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and belongs_to_establishment(po.establishment_id)
        and has_permission(po.establishment_id, 'purchases.update')
        and po.status in ('draft', 'pending_approval')
    )
  );

-- Append-only history. The ledger is only written by the status RPCs above.
alter table public.purchase_order_status_history enable row level security;

create policy "purchase_order_status_history_read" on public.purchase_order_status_history
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and belongs_to_establishment(po.establishment_id)
        and (is_super_admin()
             or has_permission(po.establishment_id, 'purchases.view'))
    )
  );

-- History is appendix: only the status RPCs write it, never direct inserts.

-- ============================================================
-- 7) Permission catalog — module `purchases` workflow additions
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('purchases.submit',    'purchases', 'Soumettre un bon de commande',   'Soumettre un bon de commande pour approbation'),
  ('purchases.approve',   'purchases', 'Approuver un bon de commande',   'Approuver un bon de commande soumis'),
  ('purchases.send',      'purchases', 'Envoyer un bon de commande',     'Envoyer un bon de commande approuvé au fournisseur'),
  ('purchases.cancel',    'purchases', 'Annuler un bon de commande',     'Annuler un bon de commande'),
  ('purchases.close',     'purchases', 'Clôturer un bon de commande',    'Clôturer un bon de commande entièrement reçu'),
  ('purchases.duplicate', 'purchases', 'Dupliquer un bon de commande',   'Créer un nouveau brouillon depuis un bon existant')
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

  -- Full workflow: super_admin, admin, manager, purchasing.
  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_super_admin as role_id union all
    select v_admin union all
    select v_manager union all
    select v_purchasing
  ) r
  cross join (select id from public.permissions
               where slug in ('purchases.submit', 'purchases.approve',
                              'purchases.send', 'purchases.cancel',
                              'purchases.close', 'purchases.duplicate')) p
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager + accountant: no workflow (view already granted by 045;
  -- stock_manager keeps its pre-existing inventory create/update/delete/receive
  -- grants from 027, which the TS matrix mirrors).
  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_stock as role_id union all
    select v_accountant
  ) r
  cross join (select id from public.permissions
               where slug in ('purchases.view')) p
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 9) Demo data — one draft purchase order for the demo supplier
-- ============================================================
do $$
declare
  v_est     uuid := '00000000-0000-0000-0000-000000000001';
  v_sup     uuid;
  v_order   uuid;
  v_number  text;
  v_default_tax uuid;
  v_base_rate numeric := 0;
  v_cafe_ins uuid;
  v_lait_ins uuid;
  v_sucre_ins uuid;
begin
  if exists (select 1 from public.purchase_orders where establishment_id = v_est) then
    return;
  end if;

  select id into v_sup from public.suppliers
   where establishment_id = v_est and code = 'SUP-0001';
  select id into v_cafe_ins from public.ingredient_suppliers
   where establishment_id = v_est and supplier_id = v_sup
     and supplier_sku = 'SUP-ARABICA-001';
  select id into v_lait_ins from public.ingredient_suppliers
   where establishment_id = v_est and supplier_id = v_sup
     and supplier_sku = 'SUP-LAIT-001';
  select id into v_sucre_ins from public.ingredient_suppliers
   where establishment_id = v_est and supplier_id = v_sup
     and supplier_sku = 'SUP-SUCRE-001';

  select id, rate into v_default_tax, v_base_rate
    from public.taxes
   where establishment_id = v_est and is_default and is_active
   limit 1;

  v_number := next_purchase_order_number(v_est);

  insert into public.purchase_orders (
    establishment_id, order_number, supplier_id, status, order_date,
    expected_delivery_date, currency_code, notes, internal_notes,
    supplier_notes, shipping_address, billing_address,
    shipping_amount, other_charges, created_by, updated_by
  ) values (
    v_est, v_number, v_sup, 'draft',
    now() - interval '1 day', now() + interval '3 days',
    'TND', 'Commande de démonstration du café, lait et sucre.',
    'Première commande de test.', 'Livraison matinale souhaitée.',
    'Zone industrielle, Tunis', 'Avenue Habib Bourguiba 12, Tunis',
    5.000, 0.000, null, null
  )
  returning id into v_order;

  insert into public.purchase_order_items (
    purchase_order_id, ingredient_id, ingredient_supplier_id,
    description, supplier_sku, quantity, purchase_unit_id, unit_price,
    discount_type, discount_value, discount_amount,
    tax_id, tax_rate, tax_amount, subtotal, total, notes, sort_order
  )
  select v_order, ins.ingredient_id, ins.id,
         i.name, ins.supplier_sku, 2, ins.purchase_unit_id, ins.purchase_price,
         'none', 0, 0, v_default_tax, v_base_rate,
         2 * ins.purchase_price * v_base_rate / 100,
         2 * ins.purchase_price, 2 * ins.purchase_price * (1 + v_base_rate / 100),
         'Café arabica en grains.', 1
    from public.ingredient_suppliers ins
    join public.ingredients i on i.id = ins.ingredient_id
   where ins.id = v_cafe_ins;

  insert into public.purchase_order_items (
    purchase_order_id, ingredient_id, ingredient_supplier_id,
    description, supplier_sku, quantity, purchase_unit_id, unit_price,
    discount_type, discount_value, discount_amount,
    tax_id, tax_rate, tax_amount, subtotal, total, notes, sort_order
  )
  select v_order, ins.ingredient_id, ins.id,
         i.name, ins.supplier_sku, 12, ins.purchase_unit_id, ins.purchase_price,
         'none', 0, 0, v_default_tax, v_base_rate,
         12 * ins.purchase_price * v_base_rate / 100,
         12 * ins.purchase_price, 12 * ins.purchase_price * (1 + v_base_rate / 100),
         'Lait entier UHT.', 2
    from public.ingredient_suppliers ins
    join public.ingredients i on i.id = ins.ingredient_id
   where ins.id = v_lait_ins;

  insert into public.purchase_order_items (
    purchase_order_id, ingredient_id, ingredient_supplier_id,
    description, supplier_sku, quantity, purchase_unit_id, unit_price,
    discount_type, discount_value, discount_amount,
    tax_id, tax_rate, tax_amount, subtotal, total, notes, sort_order
  )
  select v_order, ins.ingredient_id, ins.id,
         i.name, ins.supplier_sku, 1, ins.purchase_unit_id, ins.purchase_price,
         'none', 0, 0, v_default_tax, v_base_rate,
         ins.purchase_price * v_base_rate / 100,
         ins.purchase_price, ins.purchase_price * (1 + v_base_rate / 100),
         'Carton de 24 paquets de sucre.', 3
    from public.ingredient_suppliers ins
    join public.ingredients i on i.id = ins.ingredient_id
   where ins.id = v_sucre_ins;

  perform refresh_purchase_order_totals(v_est, v_order, 5.000, 0.000);
end $$;
