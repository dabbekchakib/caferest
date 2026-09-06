-- 050_phase_15_goods_receipt_rpc
-- Phase 15: Réception des marchandises — atomic stock-validating RPCs.
--
-- Rules honored here:
--   * the DB is the ONLY place where stock moves: `validate_goods_receipt`
--     is the single code path that writes stock_items / stock_movements,
--   * one atomic transaction per RPC: row locks on receipt, PO, PO items and
--     the touched stock_items serialize concurrent receipts on the same PO
--     or on the same ingredient/location (deadlock-safe read: locks are taken
--     in a stable order — receipt, PO, PO items by id, stock rows keyed),
--   * server-side conversions: `convert_unit_value` (+/- edges, depth 8)
--     mirrors the JS engine of src/lib/units/conversions.ts,
--   * over-receipt stays forbidden (no tolerance yet), satisfied both by the
--     row CHECK of 049 and by these live checks against the locked PO items,
--   * cost is accepted-qty based: unit_cost = net/stock_qty with the PO line
--     discount prorated by accepted/ordered; taxes never enter stock cost,
--   * idempotence: stock_movements carries a unique partial index on
--     goods_receipt_item_id, so a retried validate can never double-move.

-- ============================================================
-- 1) convert_unit_value — graph conversion (+/- edges, depth-capped)
-- ============================================================
-- Semantics (mirrors the TS engine): an edge (a -> b, factor f, offset o)
-- means value_b = value_a * f + o. Reverse travel inverts:
-- value_a = (value_b - o) / f. Best (shortest) path wins.
create or replace function public.convert_unit_value(
  p_from uuid,
  p_to uuid,
  p_value numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_factor numeric;
  v_offset numeric;
begin
  if p_from is null or p_to is null or p_value is null then
    return null;
  end if;
  if p_from = p_to then
    return p_value;
  end if;

  with recursive conv(node_id, factor, offset_value, depth, path) as (
    -- direct forward edges out of the start unit
    select uc.to_unit_id, uc.factor, uc.offset_value, 1, array[p_from]
      from public.unit_conversions uc
     where uc.from_unit_id = p_from
    union all
    -- both directions in ONE recursive arm: a recursive CTE may reference
    -- its own name only once (forward + inverse edges via a lateral scan).
    select n.node_id, n.factor, n.offset_value, c.depth + 1, c.path || n.node_id
      from conv c,
      lateral (
        select uc.to_unit_id as node_id, c.factor * uc.factor as factor,
               c.offset_value * uc.factor + uc.offset_value as offset_value
          from public.unit_conversions uc
         where uc.from_unit_id = c.node_id
           and uc.to_unit_id <> all (c.path)
        union all
        select uc.from_unit_id, c.factor / uc.factor,
               (c.offset_value - uc.offset_value) / uc.factor
          from public.unit_conversions uc
         where uc.to_unit_id = c.node_id
           and uc.from_unit_id <> all (c.path)
           and uc.factor <> 0
      ) n
     where c.depth < 8
  )
  select c.factor, c.offset_value
    into v_factor, v_offset
    from conv c
   where c.node_id = p_to
   order by c.depth
   limit 1;

  if v_factor is null then
    return null;
  end if;

  return p_value * v_factor + v_offset;
end $$;

-- ============================================================
-- 2) receipt_item_amounts — line valuation (accepted qty, prorated discount)
-- ============================================================
-- The stored discount_amount on a receipt line is the FULL order-line
-- discount; only the accepted share of it applies to this receipt line.
create or replace function public.receipt_item_amounts(
  p_ordered numeric,
  p_accepted numeric,
  p_unit_price numeric,
  p_line_discount numeric,
  p_tax_rate numeric
)
returns table (
  out_subtotal numeric,
  out_discount numeric,
  out_tax numeric,
  out_total numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_accepted numeric := coalesce(p_accepted, 0);
  v_ordered numeric := coalesce(p_ordered, 0);
  v_gross numeric := v_accepted * coalesce(p_unit_price, 0);
  v_prorated numeric;
begin
  if v_ordered > 0 then
    v_prorated := coalesce(p_line_discount, 0) * v_accepted / v_ordered;
  else
    v_prorated := 0;
  end if;

  if v_prorated < 0 or v_prorated > v_gross then
    raise exception using errcode = 'P0001',
      message = 'goods_receipt_quantity_invalid';
  end if;

  -- tax_rate is expressed in percentage points (7 == 7%).
  out_discount := v_prorated;
  out_subtotal := v_gross - v_prorated;
  out_tax      := out_subtotal * coalesce(p_tax_rate, 0) / 100;
  out_total    := out_subtotal + out_tax;
  return next;
end $$;

-- ============================================================
-- 3) goods_receipt_line_check — live input validation (creation/update)
-- ============================================================
-- Returns NULL when the line is acceptable, otherwise an error code.
create or replace function public.goods_receipt_line_check(
  p_po_id uuid,
  p_po_item_id uuid,
  p_ingredient_id uuid,
  p_received numeric,
  p_accepted numeric,
  p_rejected numeric
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.purchase_order_items poi
       where poi.id = p_po_item_id
         and poi.purchase_order_id = p_po_id
         and poi.ingredient_id = p_ingredient_id
    ) then 'cross_establishment_reference'
    when coalesce(p_received, 0) < 0
      or coalesce(p_accepted, 0) < 0
      or coalesce(p_rejected, 0) < 0 then 'goods_receipt_quantity_invalid'
    when coalesce(p_accepted, 0) + coalesce(p_rejected, 0)
         > coalesce(p_received, 0) then 'goods_receipt_quantity_invalid'
    when exists (
      select 1 from public.purchase_order_items poi
       where poi.id = p_po_item_id
         and poi.received_quantity + coalesce(p_received, 0) > poi.quantity
    ) then 'goods_receipt_overdelivery'
    else null
  end;
$$;

-- ============================================================
-- 4) restore_goods_receipt_lines — rebuild the lines of a draft
-- ============================================================
-- p_items JSONB array entries:
--   {purchase_order_item_id, ingredient_id, received_quantity,
--    accepted_quantity, rejected_quantity, lot_number, batch_number,
--    expiry_date, notes, sort_order}
-- Everything else (description, sku, prices, tax, base-unit conversion) is
-- SNAPSHOT from the live purchase order item — never trusted from the client.
create or replace function public.restore_goods_receipt_lines(
  p_est uuid,
  p_receipt_id uuid,
  p_items jsonb,
  out_subtotal OUT numeric,
  out_discount OUT numeric,
  out_tax OUT numeric,
  out_total OUT numeric
)
returns record
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt record;
  v_po record;
  v_item jsonb;
  v_poi record;
  v_ingredient record;
  v_check text;
  v_amount record;
  v_stock_unit uuid;
  v_factor numeric;
begin
  if not (has_permission(p_est, 'goods_receipts.create')
          or has_permission(p_est, 'goods_receipts.update')) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  -- Lock the receipt (serializes with validate) before touching its lines.
  select * into v_receipt
    from public.goods_receipts
   where id = p_receipt_id and establishment_id = p_est
   for update;

  if v_receipt.id is null then
    raise exception using errcode = 'P0001', message = 'goods_receipt_not_found';
  end if;
  if v_receipt.status not in ('draft', 'pending_validation') then
    raise exception using errcode = 'P0001', message = 'goods_receipt_locked';
  end if;

  select * into v_po
    from public.purchase_orders
   where id = v_receipt.purchase_order_id and establishment_id = p_est;

  if v_po.id is null
     or v_po.status not in ('approved', 'sent', 'partially_received') then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_not_receivable';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'goods_receipt_empty';
  end if;

  delete from public.goods_receipt_items
   where goods_receipt_id = p_receipt_id;

  out_subtotal := 0;
  out_discount := 0;
  out_tax := 0;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_check := goods_receipt_line_check(
      v_po.id,
      (v_item->>'purchase_order_item_id')::uuid,
      (v_item->>'ingredient_id')::uuid,
      (v_item->>'received_quantity')::numeric,
      (v_item->>'accepted_quantity')::numeric,
      (v_item->>'rejected_quantity')::numeric);
    if v_check is not null then
      raise exception using errcode = 'P0001', message = v_check;
    end if;

    select * into v_poi
      from public.purchase_order_items
     where id = (v_item->>'purchase_order_item_id')::uuid;

    select * into v_ingredient
      from public.ingredients
     where id = (v_item->>'ingredient_id')::uuid;

    -- Base-unit conversion for the accepted (stocked) quantity.
    v_stock_unit := null;
    v_factor := 1;
    if v_ingredient.is_stock_tracked then
      v_stock_unit := v_ingredient.base_unit_id;
      v_factor := public.convert_unit_value(
        v_poi.purchase_unit_id, v_stock_unit, 1);
      if v_factor is null then
        raise exception using errcode = 'P0001',
          message = 'stock_unit_incompatible';
      end if;
    end if;

    select * into v_amount
      from public.receipt_item_amounts(
             v_poi.quantity,
             coalesce((v_item->>'accepted_quantity')::numeric, 0),
             v_poi.unit_price,
             v_poi.discount_amount,
             v_poi.tax_rate);

    insert into public.goods_receipt_items (
      goods_receipt_id, purchase_order_item_id, ingredient_id,
      description, supplier_sku,
      ordered_quantity, previously_received_quantity,
      received_quantity, accepted_quantity, rejected_quantity,
      purchase_unit_id, stock_unit_id, conversion_factor,
      unit_price, discount_amount, tax_rate, tax_amount, subtotal,
      total_amount, lot_number, batch_number, expiry_date,
      notes, sort_order
    ) values (
      p_receipt_id,
      (v_item->>'purchase_order_item_id')::uuid,
      (v_item->>'ingredient_id')::uuid,
      v_poi.description, v_poi.supplier_sku,
      v_poi.quantity, v_poi.received_quantity,
      coalesce((v_item->>'received_quantity')::numeric, 0),
      coalesce((v_item->>'accepted_quantity')::numeric, 0),
      coalesce((v_item->>'rejected_quantity')::numeric, 0),
      v_poi.purchase_unit_id, v_stock_unit, v_factor,
      v_poi.unit_price, v_poi.discount_amount, v_poi.tax_rate,
      v_amount.out_tax, v_amount.out_subtotal, v_amount.out_total,
      (v_item->>'lot_number'), (v_item->>'batch_number'),
      (v_item->>'expiry_date')::date,
      (v_item->>'notes'), coalesce((v_item->>'sort_order')::integer, 0)
    );

    out_subtotal := out_subtotal + v_amount.out_subtotal;
    out_discount := out_discount + v_amount.out_discount;
    out_tax      := out_tax      + v_amount.out_tax;
  end loop;

  out_total := out_subtotal + out_tax;
  return;
end $$;

-- ============================================================
-- 5) create_goods_receipt
-- ============================================================
create or replace function public.create_goods_receipt(
  p_est uuid,
  p_purchase_order_id uuid,
  p_receipt_date date,
  p_inventory_location_id uuid,
  p_delivery_note_number text,
  p_supplier_invoice_number text,
  p_notes text,
  p_internal_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
  v_receipt_id uuid;
  v_number text;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
begin
  if not has_permission(p_est, 'goods_receipts.create') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'goods_receipt_empty';
  end if;

  select * into v_po
    from public.purchase_orders
   where id = p_purchase_order_id and establishment_id = p_est;

  if v_po.id is null
     or v_po.status not in ('approved', 'sent', 'partially_received') then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_not_receivable';
  end if;

  if p_inventory_location_id is null then
    raise exception using errcode = 'P0001', message = 'stock_location_invalid';
  end if;
  if not exists (
    select 1 from public.inventory_locations il
     where il.id = p_inventory_location_id
       and il.establishment_id = p_est
       and il.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'stock_location_invalid';
  end if;
  if not goods_receipt_references_valid(
       p_est, p_purchase_order_id, v_po.supplier_id, p_inventory_location_id
     ) then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_not_receivable';
  end if;

  if p_receipt_date is not null
     and p_receipt_date < (v_po.order_date)::date then
    raise exception using errcode = 'P0001', message = 'goods_receipt_date_invalid';
  end if;

  v_number := next_goods_receipt_number(p_est);

  insert into public.goods_receipts (
    establishment_id, purchase_order_id, receipt_number,
    receipt_date, supplier_id, inventory_location_id, status,
    delivery_note_number, supplier_invoice_number,
    notes, internal_notes, received_by, created_by, updated_by
  ) values (
    p_est, p_purchase_order_id, v_number,
    coalesce(p_receipt_date, current_date), v_po.supplier_id,
    p_inventory_location_id, 'draft',
    p_delivery_note_number, p_supplier_invoice_number,
    p_notes, p_internal_notes, auth.uid(), auth.uid(), auth.uid()
  )
  returning id into v_receipt_id;

  select * into v_subtotal, v_discount, v_tax, v_total
    from public.restore_goods_receipt_lines(
           p_est, v_receipt_id, p_items);

  update public.goods_receipts
     set subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         total_amount = v_total
   where id = v_receipt_id;

  insert into public.goods_receipt_status_history (
    establishment_id, goods_receipt_id, from_status, to_status, changed_by
  ) values (p_est, v_receipt_id, null, 'draft', auth.uid());

  return v_receipt_id;
end $$;

-- ============================================================
-- 6) update_goods_receipt
-- ============================================================
create or replace function public.update_goods_receipt(
  p_est uuid,
  p_receipt_id uuid,
  p_receipt_date date,
  p_inventory_location_id uuid,
  p_delivery_note_number text,
  p_supplier_invoice_number text,
  p_notes text,
  p_internal_notes text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt record;
  v_po record;
  v_subtotal numeric;
  v_discount numeric;
  v_tax numeric;
  v_total numeric;
begin
  if not has_permission(p_est, 'goods_receipts.update') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select * into v_receipt
    from public.goods_receipts
   where id = p_receipt_id and establishment_id = p_est;

  if v_receipt.id is null then
    raise exception using errcode = 'P0001', message = 'goods_receipt_not_found';
  end if;
  if v_receipt.status not in ('draft', 'pending_validation') then
    raise exception using errcode = 'P0001', message = 'goods_receipt_locked';
  end if;

  select * into v_po
    from public.purchase_orders
   where id = v_receipt.purchase_order_id and establishment_id = p_est;

  if v_po.id is null
     or v_po.status not in ('approved', 'sent', 'partially_received') then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_not_receivable';
  end if;

  if p_inventory_location_id is null then
    raise exception using errcode = 'P0001', message = 'stock_location_invalid';
  end if;
  if not exists (
    select 1 from public.inventory_locations il
     where il.id = p_inventory_location_id
       and il.establishment_id = p_est
       and il.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'stock_location_invalid';
  end if;
  if not goods_receipt_references_valid(
       p_est, v_po.id, v_po.supplier_id, p_inventory_location_id
     ) then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_not_receivable';
  end if;

  if p_receipt_date is not null
     and p_receipt_date < (v_po.order_date)::date then
    raise exception using errcode = 'P0001', message = 'goods_receipt_date_invalid';
  end if;

  select * into v_subtotal, v_discount, v_tax, v_total
    from public.restore_goods_receipt_lines(p_est, p_receipt_id, p_items);

  update public.goods_receipts
     set receipt_date = coalesce(p_receipt_date, receipt_date),
         inventory_location_id = p_inventory_location_id,
         delivery_note_number = p_delivery_note_number,
         supplier_invoice_number = p_supplier_invoice_number,
         notes = p_notes,
         internal_notes = p_internal_notes,
         subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         total_amount = v_total,
         updated_by = auth.uid()
   where id = p_receipt_id;
end $$;

-- ============================================================
-- 7) submit_goods_receipt
-- ============================================================
create or replace function public.submit_goods_receipt(
  p_est uuid,
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission(p_est, 'goods_receipts.submit') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if not exists (
    select 1 from public.goods_receipts
     where id = p_receipt_id and establishment_id = p_est
       and status = 'draft'
  ) then
    raise exception using errcode = 'P0001',
      message = 'goods_receipt_invalid_status';
  end if;

  if not exists (
    select 1 from public.goods_receipt_items
     where goods_receipt_id = p_receipt_id and received_quantity > 0
  ) then
    raise exception using errcode = 'P0001', message = 'goods_receipt_empty';
  end if;

  update public.goods_receipts
     set status = 'pending_validation',
         updated_by = auth.uid()
   where id = p_receipt_id;

  insert into public.goods_receipt_status_history (
    establishment_id, goods_receipt_id, from_status, to_status, changed_by
  ) values (p_est, p_receipt_id, 'draft', 'pending_validation', auth.uid());
end $$;

-- ============================================================
-- 8) cancel_goods_receipt
-- ============================================================
create or replace function public.cancel_goods_receipt(
  p_est uuid,
  p_receipt_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not has_permission(p_est, 'goods_receipts.cancel') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select status into v_status
    from public.goods_receipts
   where id = p_receipt_id and establishment_id = p_est;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'goods_receipt_not_found';
  end if;
  if v_status not in ('draft', 'pending_validation') then
    raise exception using errcode = 'P0001',
      message = 'goods_receipt_invalid_status';
  end if;

  update public.goods_receipts
     set status = 'cancelled',
         cancelled_by = auth.uid(),
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_by = auth.uid()
   where id = p_receipt_id;

  insert into public.goods_receipt_status_history (
    establishment_id, goods_receipt_id, from_status, to_status,
    reason, changed_by
  ) values (p_est, p_receipt_id, v_status, 'cancelled',
            p_reason, auth.uid());
end $$;

-- ============================================================
-- 9) delete_goods_receipt (drafts only)
-- ============================================================
create or replace function public.delete_goods_receipt(
  p_est uuid,
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission(p_est, 'goods_receipts.delete') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if not exists (
    select 1 from public.goods_receipts
     where id = p_receipt_id and establishment_id = p_est and status = 'draft'
  ) then
    raise exception using errcode = 'P0001', message = 'goods_receipt_locked';
  end if;

  -- Lines and history cascade; only drafts are ever hard-deleted.
  delete from public.goods_receipts
   where id = p_receipt_id and establishment_id = p_est;
end $$;

-- ============================================================
-- 10) validate_goods_receipt — THE only code path that moves stock
-- ============================================================
create or replace function public.validate_goods_receipt(
  p_est uuid,
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt record;
  v_po record;
  v_poi record;
  v_ingredient record;
  v_gri record;
  v_key record;
  v_factor numeric;
  v_base_qty numeric;
  v_net numeric;
  v_unit_cost numeric;
  v_all_done boolean;
  v_any_received boolean;
  v_new_po_status text;
begin
  if not has_permission(p_est, 'goods_receipts.validate') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  -- 1) Lock + fetch the receipt (serialize concurrent validates → idempotence).
  select * into v_receipt
    from public.goods_receipts
   where id = p_receipt_id and establishment_id = p_est
   for update;

  if v_receipt.id is null then
    raise exception using errcode = 'P0001', message = 'goods_receipt_not_found';
  end if;
  if v_receipt.status <> 'pending_validation' then
    raise exception using errcode = 'P0001',
      message = 'goods_receipt_invalid_status';
  end if;

  -- 2) Lock the purchase order (serialize concurrent receipts on one PO).
  select * into v_po
    from public.purchase_orders
   where id = v_receipt.purchase_order_id and establishment_id = p_est
   for update;

  if v_po.id is null then
    raise exception using errcode = 'P0001', message = 'purchase_order_not_found';
  end if;
  if v_po.status not in ('approved', 'sent', 'partially_received') then
    raise exception using errcode = 'P0001',
      message = 'purchase_order_invalid_status';
  end if;

  if v_receipt.inventory_location_id is null
     or not exists (
       select 1 from public.inventory_locations il
        where il.id = v_receipt.inventory_location_id
          and il.establishment_id = p_est
     ) then
    raise exception using errcode = 'P0001', message = 'stock_location_invalid';
  end if;

  -- 3) Lock every PO line (stable order by id → deadlock-safe).
  for v_key in
    select id from public.purchase_order_items
     where purchase_order_id = v_po.id
     order by id
     for update
  loop
    perform 1;
  end loop;

  -- 4) Pre-lock the touched stock_items rows (stable order by ingredient, then
  --    location). Rows that do not exist yet are created by the upsert below —
  --    the unique (est, ingredient, location) index resolves any race.
  for v_key in
    select distinct gri.ingredient_id, gr.inventory_location_id
      from public.goods_receipt_items gri
      join public.goods_receipts gr on gr.id = gri.goods_receipt_id
     where gri.goods_receipt_id = p_receipt_id
       and exists (select 1 from public.ingredients i
                    where i.id = gri.ingredient_id and i.is_stock_tracked)
     order by gri.ingredient_id, gr.inventory_location_id
     for update
  loop
    perform 1
      from public.stock_items
     where establishment_id = p_est
       and ingredient_id = v_key.ingredient_id
       and location_id = v_key.inventory_location_id
     for update;
  end loop;

  -- 5) Process each receipt line against its (locked) PO line.
  for v_gri in
    select * from public.goods_receipt_items
     where goods_receipt_id = p_receipt_id
     order by sort_order, id
  loop
    select * into v_poi
      from public.purchase_order_items
     where id = v_gri.purchase_order_item_id;

    if v_poi.id is null then
      raise exception using errcode = 'P0001',
        message = 'goods_receipt_item_invalid';
    end if;

    -- Live over-receipt guard against the locked, up-to-date PO line.
    if v_poi.received_quantity + v_gri.accepted_quantity > v_poi.quantity then
      raise exception using errcode = 'P0001',
        message = 'goods_receipt_overdelivery';
    end if;

    if v_gri.accepted_quantity > 0 then
      select * into v_ingredient
        from public.ingredients where id = v_gri.ingredient_id;

      v_factor := v_gri.conversion_factor;
      if v_ingredient.is_stock_tracked then
        if v_gri.stock_unit_id is null
           or v_gri.conversion_factor is null then
          raise exception using errcode = 'P0001',
            message = 'stock_unit_incompatible';
        end if;
        v_factor := public.convert_unit_value(
          v_gri.purchase_unit_id, v_gri.stock_unit_id, v_gri.conversion_factor);
      end if;

      v_base_qty := v_gri.accepted_quantity * v_factor;

      -- Valuation on the accepted quantity, discount prorated by
      -- accepted/ordered, taxes excluded from the stock cost.
      v_net := v_gri.subtotal;             -- accepted * unit_price − discount
      if v_base_qty > 0 then
        v_unit_cost := v_net / v_base_qty;
      else
        v_unit_cost := 0;
      end if;

      if v_ingredient.is_stock_tracked then
        -- Idempotent: the unique partial index on goods_receipt_item_id
        -- makes a retried validate a no-op instead of a double movement.
        insert into public.stock_movements (
          establishment_id, ingredient_id, location_id,
          movement_type, direction, quantity,
          base_quantity, base_unit_id, unit_id,
          unit_cost, total_cost,
          reference_type, reference_id,
          goods_receipt_id, goods_receipt_item_id,
          lot_number, batch_number, expiry_date,
          reason, created_by
        ) values (
          p_est, v_gri.ingredient_id, v_receipt.inventory_location_id,
          'purchase', 'in', v_base_qty,
          v_base_qty, v_gri.stock_unit_id, v_gri.purchase_unit_id,
          v_unit_cost, v_net,
          'goods_receipt', p_receipt_id,
          p_receipt_id, v_gri.id,
          v_gri.lot_number, v_gri.batch_number, v_gri.expiry_date,
          coalesce(v_gri.notes, 'Reception ' || v_receipt.receipt_number),
          auth.uid()
        )
        on conflict (goods_receipt_item_id) where goods_receipt_item_id is not null
        do nothing;

        -- Weighted-average costing on the receiving location.
        insert into public.stock_items (
          establishment_id, ingredient_id, location_id,
          quantity, reserved_quantity, average_cost, last_cost
        ) values (
          p_est, v_gri.ingredient_id, v_receipt.inventory_location_id,
          v_base_qty, 0, v_unit_cost, v_unit_cost
        )
        on conflict (establishment_id, ingredient_id, location_id)
        do update set
          quantity = round((stock_items.quantity + excluded.quantity)::numeric, 6),
          average_cost = round(
            (stock_items.quantity * stock_items.average_cost
             + excluded.quantity * excluded.average_cost)
            / (stock_items.quantity + excluded.quantity), 6),
          last_cost = excluded.last_cost;
      end if;

      -- Fulfillment tracking on the linked purchase order line.
      update public.purchase_order_items
         set received_quantity = v_poi.received_quantity + v_gri.accepted_quantity,
             remaining_quantity = v_poi.quantity
                                  - v_poi.received_quantity
                                  - v_gri.accepted_quantity
       where id = v_poi.id;
    end if;
  end loop;

  -- 6) Refresh the purchase order status from its remaining quantities.
  select coalesce(bool_and(coalesce(q.remaining, 0) = 0), false)
    into v_all_done
    from (
      select poi.quantity - poi.received_quantity as remaining
        from public.purchase_order_items poi
       where poi.purchase_order_id = v_po.id
    ) q;

  select exists (
    select 1 from public.purchase_order_items
     where purchase_order_id = v_po.id and received_quantity > 0
  ) into v_any_received;

  v_new_po_status := v_po.status;
  if v_all_done then
    v_new_po_status := 'fully_received';
  elsif v_any_received
        and v_po.status in ('approved', 'sent') then
    v_new_po_status := 'partially_received';
  end if;

  if v_new_po_status <> v_po.status then
    update public.purchase_orders
       set status = v_new_po_status,
           updated_by = auth.uid()
     where id = v_po.id;

    insert into public.purchase_order_status_history (
      purchase_order_id, from_status, to_status, reason, changed_by
    ) values (v_po.id, v_po.status, v_new_po_status,
              'Reception ' || v_receipt.receipt_number, auth.uid());
  end if;

  -- 7) Seal the receipt — a validated receipt is immutable.
  update public.goods_receipts
     set status = 'validated',
         validated_by = auth.uid(),
         validated_at = now(),
         updated_by = auth.uid()
   where id = p_receipt_id;

  insert into public.goods_receipt_status_history (
    establishment_id, goods_receipt_id, from_status, to_status,
    changed_by
  ) values (p_est, p_receipt_id, 'pending_validation', 'validated',
            auth.uid());
end $$;