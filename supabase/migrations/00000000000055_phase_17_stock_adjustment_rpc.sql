-- 055_phase_17_stock_adjustment_rpc
-- Phase 17: ajustements de stock — RPC atomiques (SECURITY DEFINER).
--
-- Stock movement rules:
--   * the ONLY function that ever moves stock is `validate_stock_adjustment`,
--   * an adjustment is OUT-only: each line is a positive quantity (in the
--     ingredient BASE unit) written with `movement_type = adjustment_type`,
--     `direction = 'out'` and full traceability via `stock_adjustment_id` +
--     `stock_adjustment_item_id` (UNIQUE partial index ⇒ idempotent retries),
--   * the unit cost is FROZEN at submission (live `stock_items.average_cost`)
--     and the header totals are always recomputed server-side (`recompute`);
--     the frontend is never trusted for values,
--   * `validate_stock_adjustment` checks availability AFTER taking the
--     row-locks on the touched `stock_items` (stable order by ingredient ⇒ no
--     deadlocks against concurrent receipts / stocktakes / adjustments),
--   * approval push-down gate: what needs approval is decided at SUBMIT from
--     the establishment settings (`require_adjustment_approval` OR
--     `total_value > approval_threshold_value`), passed as parameters when a
--     purely automatic flow (no approval) lands directly in `approved`.
--
-- Guard principle: every function checks, in order and if applicable:
--   (a) RLS-level permission (has_permission on establishment),
--   (b) the adjustment / item / location belongs to the caller establishment,
--   (c) the expected status for the operation.

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- Ingredient/unit: belongs to the establishment, stock-tracked, coherent unit.
create or replace function public.stock_adjustment_scope_valid(
  p_est uuid, p_ingredient_id uuid, p_unit_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.ingredients i
     where i.id = p_ingredient_id
       and i.establishment_id = p_est
       and i.is_stock_tracked
       and (p_unit_id is null
            or p_unit_id = i.base_unit_id
            or exists (
              select 1 from public.unit_conversions c
               where c.establishment_id = p_est
                 and c.from_unit_id = p_unit_id
                 and c.to_unit_id = i.base_unit_id
            ))
  )
$$;

-- The location must exist, belong to the establishment and stay active.
create or replace function public.stock_adjustment_location_valid(
  p_est uuid, p_location_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inventory_locations il
     where il.id = p_location_id
       and il.establishment_id = p_est
       and il.is_active
  )
$$;

-- A reason must be active and coherent with the adjustment type: system
-- reasons (NULL establishment) or reasons of the caller establishment.
create or replace function public.stock_adjustment_reason_valid(
  p_est uuid, p_reason_id uuid, p_adjustment_type text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stock_adjustment_reasons r
     where r.id = p_reason_id
       and r.is_active
       and (r.adjustment_type is null or r.adjustment_type = p_adjustment_type)
       and (r.establishment_id is null or r.establishment_id = p_est)
  )
$$;

-- Recompute every line (unit_cost from the LIVE stock average cost, total_cost
-- = quantity × cost) and the header totals (quantity/value). Server-side
-- authority; called on every draft edit AND frozen at submission.
create or replace function public.recompute_stock_adjustment(
  p_est uuid, p_adjustment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r_item record;
  v_unit_cost numeric := 0;
  v_total_qty numeric := 0;
  v_total_value numeric := 0;
begin
  perform 1 from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;

  for r_item in (
    select sai.id, sai.ingredient_id, sai.base_quantity,
           sai.total_cost
      from public.stock_adjustment_items sai
     where sai.stock_adjustment_id = p_adjustment_id
     order by sai.sort_order, sai.id
  )
  loop
    select coalesce(si.average_cost, 0) into v_unit_cost
      from public.stock_items si
      join public.stock_adjustments sa on sa.inventory_location_id = si.location_id
     where si.ingredient_id = r_item.ingredient_id
       and sa.id = p_adjustment_id
     limit 1;

    update public.stock_adjustment_items sai
       set unit_cost = round(v_unit_cost, 6),
           total_cost = round(sai.base_quantity * v_unit_cost, 6)
     where sai.id = r_item.id;
  end loop;

  select coalesce(sum(base_quantity), 0), coalesce(sum(total_cost), 0)
    into v_total_qty, v_total_value
    from public.stock_adjustment_items
   where stock_adjustment_id = p_adjustment_id;

  update public.stock_adjustments
     set total_quantity = round(v_total_qty, 3),
         total_value = round(v_total_value, 3)
   where id = p_adjustment_id;
end $$;

-- ------------------------------------------------------------
-- create: header + optional first lines (jsonb) in ONE transaction.
--   p_items: [{"ingredient_id": uuid, "quantity": numeric, "unit_id": uuid|null}]
-- ------------------------------------------------------------
create or replace function public.create_stock_adjustment(
  p_est uuid,
  p_inventory_location_id uuid,
  p_adjustment_type text,
  p_adjustment_date date default current_date,
  p_reason_id uuid default null,
  p_notes text default null,
  p_internal_reference text default null,
  p_items jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_number text;
  r_item record;
  v_base_unit uuid;
  v_base numeric;
  v_cost numeric := 0;
  v_sort integer := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.create') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  if p_adjustment_type not in (
       'loss', 'breakage', 'waste', 'expired', 'damaged',
       'internal_consumption', 'sample', 'staff_consumption',
       'cleaning', 'other') then
    raise exception 'stock_adjustment_invalid_type' using errcode = 'P0001';
  end if;
  if p_adjustment_date < '2000-01-01' then
    raise exception 'stock_adjustment_invalid_date' using errcode = 'P0001';
  end if;
  if not public.stock_adjustment_location_valid(p_est, p_inventory_location_id) then
    raise exception 'stock_adjustment_invalid_location' using errcode = 'P0001';
  end if;
  if p_reason_id is not null
     and not public.stock_adjustment_reason_valid(
       p_est, p_reason_id, p_adjustment_type) then
    raise exception 'stock_adjustment_invalid_reason' using errcode = 'P0001';
  end if;

  select public.next_stock_adjustment_number(p_est) into v_number;

  insert into public.stock_adjustments
    (establishment_id, inventory_location_id, adjustment_number,
     adjustment_type, adjustment_date, reason_id, notes,
     internal_reference, created_by)
  values (p_est, p_inventory_location_id, v_number,
          p_adjustment_type, p_adjustment_date, p_reason_id, p_notes,
          p_internal_reference, auth.uid())
  returning id into v_id;

  insert into public.stock_adjustment_status_history
    (establishment_id, stock_adjustment_id, from_status, to_status, changed_by)
  values (p_est, v_id, null, 'draft', auth.uid());

  -- First lines, atomically with the header (if any).
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for r_item in
      select x.ingredient_id, x.quantity, x.unit_id
        from jsonb_to_recordset(p_items)
          as x(ingredient_id uuid, quantity numeric, unit_id uuid)
    loop
      if r_item.ingredient_id is null or r_item.quantity is null
         or r_item.quantity <= 0 then
        raise exception 'stock_adjustment_quantity_invalid' using errcode = 'P0001';
      end if;
      if not public.stock_adjustment_scope_valid(
           p_est, r_item.ingredient_id, r_item.unit_id) then
        raise exception 'stock_adjustment_item_invalid' using errcode = 'P0001';
      end if;
      if exists (
        select 1 from public.stock_adjustment_items sai
         where sai.stock_adjustment_id = v_id
           and sai.ingredient_id = r_item.ingredient_id
      ) then
        raise exception 'stock_adjustment_duplicate_item' using errcode = 'P0001';
      end if;

      select i.base_unit_id into v_base_unit
        from public.ingredients i
       where i.id = r_item.ingredient_id and i.establishment_id = p_est;

      select public.convert_unit_value(
               coalesce(r_item.unit_id, v_base_unit), v_base_unit, r_item.quantity)
        into v_base;
      if v_base is null then
        raise exception 'stock_unit_incompatible' using errcode = 'P0001';
      end if;
      if v_base <= 0 then
        raise exception 'stock_adjustment_quantity_invalid' using errcode = 'P0001';
      end if;

      select coalesce(si.average_cost, 0) into v_cost
        from public.stock_items si
        join public.inventory_locations il on il.id = si.location_id
       where si.ingredient_id = r_item.ingredient_id
         and il.id = p_inventory_location_id
       limit 1;

      v_sort := v_sort + 1;
      insert into public.stock_adjustment_items
        (stock_adjustment_id, ingredient_id, unit_id, base_unit_id,
         base_quantity, unit_cost, total_cost, sort_order)
      values (v_id, r_item.ingredient_id,
              coalesce(r_item.unit_id, v_base_unit), v_base_unit,
              round(v_base, 6), round(coalesce(v_cost, 0), 6),
              round(v_base * coalesce(v_cost, 0), 6), v_sort);
    end loop;
  end if;

  if v_sort > 0 then
    perform public.recompute_stock_adjustment(p_est, v_id);
  end if;

  return v_id;
end $$;

-- ------------------------------------------------------------
-- post-draft line editing (draft only)
-- ------------------------------------------------------------
create or replace function public.add_stock_adjustment_item(
  p_est uuid, p_adjustment_id uuid,
  p_ingredient_id uuid, p_quantity numeric, p_unit_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
  v_base_unit uuid;
  v_base numeric;
  v_cost numeric := 0;
  v_sort integer := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.update') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'stock_adjustment_quantity_invalid' using errcode = 'P0001';
  end if;
  if not public.stock_adjustment_scope_valid(p_est, p_ingredient_id, p_unit_id) then
    raise exception 'stock_adjustment_item_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.stock_adjustment_items sai
     where sai.stock_adjustment_id = p_adjustment_id
       and sai.ingredient_id = p_ingredient_id
  ) then
    raise exception 'stock_adjustment_duplicate_item' using errcode = 'P0001';
  end if;

  select i.base_unit_id into v_base_unit
    from public.ingredients i
   where i.id = p_ingredient_id and i.establishment_id = p_est;

  select public.convert_unit_value(
           coalesce(p_unit_id, v_base_unit), v_base_unit, p_quantity)
    into v_base;
  if v_base is null then
    raise exception 'stock_unit_incompatible' using errcode = 'P0001';
  end if;

  select coalesce(si.average_cost, 0) into v_cost
    from public.stock_items si
   where si.ingredient_id = p_ingredient_id
     and si.location_id = v_adj.inventory_location_id
   limit 1;

  select coalesce(max(sort_order), 0) into v_sort
    from public.stock_adjustment_items
   where stock_adjustment_id = p_adjustment_id;

  insert into public.stock_adjustment_items
    (stock_adjustment_id, ingredient_id, unit_id, base_unit_id,
     base_quantity, unit_cost, total_cost, sort_order)
  values (p_adjustment_id, p_ingredient_id,
          coalesce(p_unit_id, v_base_unit), v_base_unit,
          round(v_base, 6), round(coalesce(v_cost, 0), 6),
          round(v_base * coalesce(v_cost, 0), 6), v_sort + 1);

  perform public.recompute_stock_adjustment(p_est, p_adjustment_id);
end $$;

create or replace function public.update_stock_adjustment_item(
  p_est uuid, p_adjustment_id uuid, p_item_id uuid,
  p_quantity numeric, p_unit_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
  v_item public.stock_adjustment_items%rowtype;
  v_base_unit uuid;
  v_base numeric;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.update') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;

  select * into v_item from public.stock_adjustment_items
   where id = p_item_id and stock_adjustment_id = p_adjustment_id
   for update;
  if not found then
    raise exception 'stock_adjustment_item_not_found' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'stock_adjustment_quantity_invalid' using errcode = 'P0001';
  end if;
  if not public.stock_adjustment_scope_valid(p_est, v_item.ingredient_id, p_unit_id) then
    raise exception 'stock_adjustment_item_invalid' using errcode = 'P0001';
  end if;

  select i.base_unit_id into v_base_unit
    from public.ingredients i where i.id = v_item.ingredient_id;

  select public.convert_unit_value(
           coalesce(p_unit_id, v_base_unit), v_base_unit, p_quantity)
    into v_base;
  if v_base is null then
    raise exception 'stock_unit_incompatible' using errcode = 'P0001';
  end if;

  update public.stock_adjustment_items
     set base_quantity = round(v_base, 6),
         unit_id = coalesce(p_unit_id, v_base_unit),
         total_cost = round(v_base * unit_cost, 6)
   where id = p_item_id;

  perform public.recompute_stock_adjustment(p_est, p_adjustment_id);
end $$;

create or replace function public.remove_stock_adjustment_item(
  p_est uuid, p_adjustment_id uuid, p_item_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.update') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.stock_adjustment_items
     where id = p_item_id and stock_adjustment_id = p_adjustment_id
  ) then
    raise exception 'stock_adjustment_item_not_found' using errcode = 'P0001';
  end if;

  delete from public.stock_adjustment_items
   where id = p_item_id and stock_adjustment_id = p_adjustment_id;

  perform public.recompute_stock_adjustment(p_est, p_adjustment_id);
end $$;

-- ------------------------------------------------------------
-- submit: draft → (pending_approval | approved)
-- Freezes the costs/totals. Approval gate is decided HERE from the settings
-- passed by the service layer (never hardcoded in the RPC):
--   requires_approval = p_require_approval OR total_value > p_threshold_value.
-- The automatic (no approval) path lands directly in `approved`.
-- ------------------------------------------------------------
create or replace function public.submit_stock_adjustment(
  p_est uuid, p_adjustment_id uuid,
  p_require_approval boolean default false,
  p_threshold_value numeric default 1000
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
  v_requires boolean;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.submit') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.stock_adjustment_items
     where stock_adjustment_id = p_adjustment_id
  ) then
    raise exception 'stock_adjustment_empty' using errcode = 'P0001';
  end if;

  -- Freeze unit costs + recompute totals BEFORE deciding the gate.
  perform public.recompute_stock_adjustment(p_est, p_adjustment_id);

  select total_value into v_adj.total_value from public.stock_adjustments
   where id = p_adjustment_id;

  v_requires := coalesce(p_require_approval, false)
                or (coalesce(p_threshold_value, 0) > 0
                    and v_adj.total_value > p_threshold_value);

  update public.stock_adjustments
     set requires_approval = v_requires,
         status = case when v_requires then 'pending_approval' else 'approved' end,
         submitted_by = auth.uid(),
         submitted_at = now(),
         approved_by = case when v_requires then null else auth.uid() end,
         approved_at = case when v_requires then null else now() end
   where id = p_adjustment_id;

  insert into public.stock_adjustment_status_history
    (establishment_id, stock_adjustment_id, from_status, to_status, changed_by)
  values (p_est, p_adjustment_id, 'draft',
          case when v_requires then 'pending_approval' else 'approved' end,
          auth.uid());
end $$;

-- ------------------------------------------------------------
-- approve: pending_approval → approved (+ high-value + separation gates)
-- ------------------------------------------------------------
create or replace function public.approve_stock_adjustment(
  p_est uuid, p_adjustment_id uuid,
  p_threshold_value numeric default 0,
  p_require_separation boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.approve') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'pending_approval' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;

  -- Separation of duties: the creator cannot approve his own adjustment.
  if coalesce(p_require_separation, false)
     and v_adj.created_by = auth.uid()
     and not is_super_admin() then
    raise exception 'stock_adjustment_self_approval' using errcode = 'P0001';
  end if;

  -- High-value gate: any line value above the threshold needs the dedicated
  -- permission (mirrors stocktake_high_variance_approval).
  if coalesce(p_threshold_value, 0) > 0
     and v_adj.total_value > p_threshold_value
     and not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.approve_high_value') then
    raise exception 'stock_adjustment_high_value_approval' using errcode = 'P0001';
  end if;

  update public.stock_adjustments
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_adjustment_id;

  insert into public.stock_adjustment_status_history
    (establishment_id, stock_adjustment_id, from_status, to_status, changed_by)
  values (p_est, p_adjustment_id, 'pending_approval', 'approved', auth.uid());
end $$;

-- ------------------------------------------------------------
-- validate: approved → validated — THE stock-writing point.
-- Atomicity & idempotence strategy (mirrors validate_goods_receipt):
--   1. lock the adjustment header,
--   2. pre-lock the stock_items rows of the location (ordered, FOR UPDATE)
--      so a concurrent validation can neither interleave a movement after the
--      availability check, nor update the stock rows behind us,
--   3. availability guard: stock quantity >= line base quantity (aborts),
--   4. one stock_movements row per line, tagged with stock_adjustment_id +
--      stock_adjustment_item_id (UNIQUE partial index ⇒ a retry is a no-op),
--   5. stock_items upsert: quantity −= base, average_cost kept UNLESS the
--      line drives the stock to 0 (then the cost resets),
--   6. seal to validated.
-- ------------------------------------------------------------
create or replace function public.validate_stock_adjustment(
  p_est uuid, p_adjustment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
  v_item record;
  v_available numeric := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.validate') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  -- (1) header lock (a validated adjustment can never be re-validated)
  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'approved' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;

  -- (2) pre-lock the stock rows (ordered ⇒ no deadlock)
  for v_item in (
    select sai.ingredient_id
      from public.stock_adjustment_items sai
     where sai.stock_adjustment_id = p_adjustment_id
     order by sai.ingredient_id
  )
  loop
    perform 1 from public.stock_items si
     where si.ingredient_id = v_item.ingredient_id
       and si.location_id = v_adj.inventory_location_id
       for update;
  end loop;

  -- (3) availability guard (AFTER the locks: no race with a concurrent write)
  for v_item in (
    select sai.id as item_id, sai.ingredient_id, sai.base_quantity
      from public.stock_adjustment_items sai
     where sai.stock_adjustment_id = p_adjustment_id
     order by sai.ingredient_id
  )
  loop
    select coalesce(si.quantity, 0) into v_available
      from public.stock_items si
     where si.ingredient_id = v_item.ingredient_id
       and si.location_id = v_adj.inventory_location_id;
    if v_available < v_item.base_quantity then
      raise exception 'stock_adjustment_insufficient_stock' using errcode = 'P0001';
    end if;
  end loop;

  -- (4)+(5) movements + stock upsert
  for v_item in (
    select sai.id as item_id, sai.ingredient_id, sai.base_unit_id,
           sai.unit_id, sai.unit_cost, sai.total_cost, sai.base_quantity
      from public.stock_adjustment_items sai
     where sai.stock_adjustment_id = p_adjustment_id
     order by sai.ingredient_id
  )
  loop
    insert into public.stock_movements (
      establishment_id, ingredient_id, location_id,
      movement_type, direction, quantity,
      base_quantity, base_unit_id, unit_id,
      unit_cost, total_cost,
      reference_type, reference_id,
      stock_adjustment_id, stock_adjustment_item_id,
      reason, created_by
    ) values (
      p_est, v_item.ingredient_id, v_adj.inventory_location_id,
      v_adj.adjustment_type, 'out', v_item.base_quantity,
      v_item.base_quantity, v_item.base_unit_id, v_item.unit_id,
      v_item.unit_cost, v_item.total_cost,
      'stock_adjustment', p_adjustment_id,
      p_adjustment_id, v_item.item_id,
      'Ajustement ' || v_adj.adjustment_number, auth.uid()
    )
    on conflict (stock_adjustment_item_id)
      where stock_adjustment_item_id is not null
    do nothing;

    -- stock_items: the row ALWAYS exists (availability guard above) so the
    -- conflict path is the only one taken; insert values are a no-op for it.
    insert into public.stock_items (
      establishment_id, ingredient_id, location_id,
      quantity, reserved_quantity, average_cost, last_cost
    ) values (
      p_est, v_item.ingredient_id, v_adj.inventory_location_id,
      v_item.base_quantity, 0, v_item.unit_cost, null
    )
    on conflict (establishment_id, ingredient_id, location_id)
    do update set
      quantity = round(stock_items.quantity - excluded.quantity, 6),
      average_cost = case
        when stock_items.quantity - excluded.quantity <= 0 then 0
        else stock_items.average_cost
      end,
      last_cost = stock_items.last_cost;
  end loop;

  -- (6) seal
  update public.stock_adjustments
     set status = 'validated',
         validated_at = now(),
         validated_by = auth.uid()
   where id = p_adjustment_id;

  insert into public.stock_adjustment_status_history
    (establishment_id, stock_adjustment_id, from_status, to_status, changed_by)
  values (p_est, p_adjustment_id, 'approved', 'validated', auth.uid());
end $$;

-- ------------------------------------------------------------
-- cancel: draft / pending_approval / approved → cancelled (never validated)
-- ------------------------------------------------------------
create or replace function public.cancel_stock_adjustment(
  p_est uuid, p_adjustment_id uuid, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.cancel') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status not in ('draft', 'pending_approval', 'approved') then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;

  update public.stock_adjustments
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = p_reason
   where id = p_adjustment_id;

  insert into public.stock_adjustment_status_history
    (establishment_id, stock_adjustment_id,
     from_status, to_status, reason, changed_by)
  values (p_est, p_adjustment_id,
          v_adj.status, 'cancelled', p_reason, auth.uid());
end $$;

-- ------------------------------------------------------------
-- delete: hard delete of a DRAFT only
-- ------------------------------------------------------------
create or replace function public.delete_stock_adjustment(
  p_est uuid, p_adjustment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.stock_adjustments%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stock_adjustments.delete') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_adj from public.stock_adjustments
   where id = p_adjustment_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stock_adjustment_not_found' using errcode = 'P0001';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'stock_adjustment_wrong_status' using errcode = 'P0001';
  end if;

  delete from public.stock_adjustment_status_history
   where stock_adjustment_id = p_adjustment_id;
  delete from public.stock_adjustment_items
   where stock_adjustment_id = p_adjustment_id;
  delete from public.stock_adjustments
   where id = p_adjustment_id;
end $$;