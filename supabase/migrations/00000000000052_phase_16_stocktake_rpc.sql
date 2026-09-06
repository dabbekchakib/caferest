-- 052_phase_16_stocktake_rpc
-- Phase 16: inventaire physique — RPC atomiques (SECURITY DEFINER).
--
-- Stock movement rules:
--   * the ONLY function that ever moves stock is `validate_stocktake`,
--   * expected = snapshot_quantity + Σ(movements since started_at) for the
--     same (ingredient, location), EXCLUDING this stocktake's own adjustments
--     — so a retried validation can never inflate the theoretical line,
--   * all quantities live in the ingredient BASE unit: count entries in any
--     compatible unit are converted server-side via `convert_unit_value`,
--   * successful validation creates one stock_movements row per non-zero line
--     (type adjustment_in/adjustment_out, direction in/out) tagged with
--     `stocktake_id` + `stocktake_item_id`; the UNIQUE partial index
--     (`uq_stock_movements_stocktake_item`, defined in 051) makes validation
--     idempotent, and the row-lock on stock_items serialises it against
--     concurrent receipt validation (FOR UPDATE, ordered by ingredient),
--   * variance value is computed with the LIVE stock cost during the review/
--     validation flow (stock_items.average_cost) — never client-supplied.
--
-- Guard principle: every function checks, in order and if applicable:
--   (a) RLS-level permission (has_permission on establishment),
--   (b) the stocktake / item / location belongs to the caller establishment,
--   (c) the expected status for the operation.

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- Ingredient/unit: item of a stocktake of this establishment? Serves both
-- update_stocktake_item_count and defensive checks in start/validate.
create or replace function public.stocktake_scope_valid(
  p_est uuid, p_stocktake_id uuid, p_ingredient_id uuid, p_unit_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.stocktakes st
      join public.stocktake_items si on si.stocktake_id = st.id
      join public.ingredients i on i.id = si.ingredient_id
     where st.id = p_stocktake_id
       and st.establishment_id = p_est
       and si.ingredient_id = p_ingredient_id
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
create or replace function public.stocktake_location_valid(
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

-- Recompute theoretical quantity, live unit cost, variance, percentage and
-- value for every item of a stocktake.
--   movements = Σ(signed base_quantity of every movement of that ingredient
--                on the location observed since started_at, EXCLUDING this
--                stocktake's own adjustments)
--   expected  = snapshot_quantity + movements        (floored at 0)
--   variance  = counted_quantity − expected          (NULL while uncounted)
--   pct       = variance / expected × 100            (0 / 0 → 0, x / 0 → 100)
--   value     = variance × unit_cost                 (live stock average cost)
-- Reconcile NEVER touches stock — the frontend is never trusted for these.
create or replace function public.reconcile_stocktake(
  p_est uuid, p_stocktake_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
  r_item record;
  v_moves numeric := 0;
  v_unit_cost numeric := 0;
begin
  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;

  for r_item in (
    select si.* from public.stocktake_items si
     where si.stocktake_id = p_stocktake_id
     order by si.id
  )
  loop
    select coalesce(sum(
        case when m.direction = 'out' then -1 else 1 end * m.base_quantity
      ), 0)
      into v_moves
      from public.stock_movements m
     where m.ingredient_id = r_item.ingredient_id
       and m.location_id = v_take.inventory_location_id
       and m.created_at >= v_take.started_at
       and m.base_quantity is not null
       and (m.stocktake_id is null or m.stocktake_id <> p_stocktake_id);

    select coalesce(si.average_cost, 0)
      into v_unit_cost
      from public.stock_items si
     where si.ingredient_id = r_item.ingredient_id
       and si.location_id = v_take.inventory_location_id;

    update public.stocktake_items sit
       set movements_quantity = round(v_moves, 6),
           expected_quantity = greatest(round(r_item.snapshot_quantity + v_moves, 6), 0),
           unit_cost = round(coalesce(v_unit_cost, 0), 6)
     where sit.id = r_item.id;
  end loop;

  update public.stocktake_items sit
     set variance_quantity =
           case when sit.counted_quantity is null then null
                else round(sit.counted_quantity - sit.expected_quantity, 6)
           end,
         variance_percentage =
           case
             when sit.counted_quantity is null then null
             when sit.expected_quantity = 0 and sit.counted_quantity = 0 then 0
             when sit.expected_quantity = 0 then 100
             else round((sit.counted_quantity - sit.expected_quantity)
                        / sit.expected_quantity * 100, 6)
           end,
         variance_value =
           case when sit.counted_quantity is null then null
                else round((sit.counted_quantity - sit.expected_quantity)
                          * sit.unit_cost, 6)
           end
   where sit.stocktake_id = p_stocktake_id;
end $$;

-- True when any counted line breaches the approval threshold:
-- |variance_percentage| > p_pct, or |variance_value| > p_value when p_value > 0.
create or replace function public.stocktake_high_variance(
  p_stocktake_id uuid, p_pct numeric default 5, p_value numeric default 0
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stocktake_items si
     where si.stocktake_id = p_stocktake_id
       and si.counted_quantity is not null
       and (
         abs(coalesce(si.variance_percentage, 0)) > p_pct
         or (p_value > 0 and abs(coalesce(si.variance_value, 0)) > p_value)
       )
  )
$$;

-- ------------------------------------------------------------
-- create: draft header, server-generated number INV-YYYY-NNNNNN
-- ------------------------------------------------------------
create or replace function public.create_stocktake(
  p_est uuid, p_inventory_location_id uuid, p_mode text default 'standard',
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_take_id uuid;
  v_number text;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.create') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  if p_mode not in ('standard', 'blind') then
    raise exception 'stocktake_invalid_mode' using errcode = 'P0001';
  end if;
  if not public.stocktake_location_valid(p_est, p_inventory_location_id) then
    raise exception 'stocktake_invalid_location' using errcode = 'P0001';
  end if;

  select public.next_stocktake_number(p_est) into v_number;

  insert into public.stocktakes
    (establishment_id, inventory_location_id, stocktake_number, mode,
     notes, created_by)
  values (p_est, p_inventory_location_id, v_number, p_mode,
          p_notes, auth.uid())
  returning id into v_take_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id, from_status, to_status, changed_by)
  values (p_est, v_take_id, null, 'draft', auth.uid());

  return v_take_id;
end $$;

-- ------------------------------------------------------------
-- start: generates the item lines and FREEZES the snapshot
-- ------------------------------------------------------------
create or replace function public.start_stocktake(
  p_est uuid, p_stocktake_id uuid, p_scope text default 'stocked',
  p_include_zero_stock boolean default false,
  p_ingredient_ids uuid[] default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
  v_ingredient_id uuid;
  v_base_unit uuid;
  v_stock_qty numeric := 0;
  v_cost numeric := 0;
  v_count integer := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.start') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'draft' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;
  if p_scope not in ('all', 'stocked', 'selected') then
    raise exception 'stocktake_invalid_scope' using errcode = 'P0001';
  end if;

  -- Explicit ingredient selection wins over p_scope (used by the create form
  -- when the user pinpoints lines rather than the whole location).
  if cardinality(p_ingredient_ids) > 0 then
    for v_ingredient_id in select unnest(p_ingredient_ids)
    loop
      begin
        select i.base_unit_id into v_base_unit
          from public.ingredients i
         where i.id = v_ingredient_id
           and i.establishment_id = p_est
           and i.is_stock_tracked;
        if not found then
          continue;
        end if;

        select coalesce(si.quantity, 0), coalesce(si.average_cost, 0)
          into v_stock_qty, v_cost
          from public.stock_items si
         where si.ingredient_id = v_ingredient_id
           and si.location_id = v_take.inventory_location_id;

        if p_include_zero_stock or v_stock_qty > 0 then
          insert into public.stocktake_items
            (stocktake_id, ingredient_id, unit_id, base_unit_id,
             snapshot_quantity, unit_cost)
          values (p_stocktake_id, v_ingredient_id, null, v_base_unit,
                  round(v_stock_qty, 6), round(v_cost, 6));
          v_count := v_count + 1;
        end if;
      end;
    end loop;
  elsif p_scope = 'all' then
    insert into public.stocktake_items
      (stocktake_id, ingredient_id, unit_id, base_unit_id,
       snapshot_quantity, unit_cost)
    select p_stocktake_id, i.id, null, i.base_unit_id,
           round(coalesce(si.quantity, 0), 6),
           round(coalesce(si.average_cost, 0), 6)
      from public.ingredients i
      left join public.stock_items si
             on si.ingredient_id = i.id
            and si.location_id = v_take.inventory_location_id
     where i.establishment_id = p_est and i.is_stock_tracked
       and (p_include_zero_stock or coalesce(si.quantity, 0) > 0);
    get diagnostics v_count = row_count;
  else -- 'stocked'
    insert into public.stocktake_items
      (stocktake_id, ingredient_id, unit_id, base_unit_id,
       snapshot_quantity, unit_cost)
    select p_stocktake_id, i.id, null, i.base_unit_id,
           round(si.quantity, 6), round(coalesce(si.average_cost, 0), 6)
      from public.stock_items si
      join public.ingredients i on i.id = si.ingredient_id
     where si.location_id = v_take.inventory_location_id
       and i.establishment_id = p_est and i.is_stock_tracked
       and (p_include_zero_stock or si.quantity > 0);
    get diagnostics v_count = row_count;
  end if;

  if exists (
    select 1 from public.stocktake_items where stocktake_id = p_stocktake_id
  ) is false then
    raise exception 'stocktake_empty' using errcode = 'P0001';
  end if;

  update public.stocktakes
     set status = 'counting',
         started_at = now(),
         started_by = auth.uid()
   where id = p_stocktake_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id, from_status, to_status, changed_by)
  values (p_est, p_stocktake_id, 'draft', 'counting', auth.uid());
end $$;

-- ------------------------------------------------------------
-- update_stocktake_item_count: capture / clear a physical count
--   p_amount is expressed in the unit p_unit_id (compatible with the
--   ingredient base unit via convert_unit_value); the stored counted_quantity
--   is always normalized in the BASE unit. p_amount = NULL clears the line so
--   a (blind) recount can restart it.
-- ------------------------------------------------------------
create or replace function public.update_stocktake_item_count(
  p_est uuid, p_stocktake_id uuid, p_item_id uuid,
  p_amount numeric, p_unit_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
  v_item public.stocktake_items%rowtype;
  v_base numeric;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.count') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'counting' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  select * into v_item from public.stocktake_items
   where id = p_item_id and stocktake_id = p_stocktake_id
   for update;
  if not found then
    raise exception 'stocktake_item_not_found' using errcode = 'P0001';
  end if;

  if p_amount is null then
    update public.stocktake_items
       set counted_quantity = null, unit_id = null, counted_by = null,
           counted_at = null, count_status = 'pending', notes = null
     where id = p_item_id;
  else
    if p_unit_id is null then
      select i.base_unit_id into p_unit_id
        from public.ingredients i where i.id = v_item.ingredient_id;
    end if;

    select public.convert_unit_value(p_unit_id, v_item.base_unit_id, p_amount)
      into v_base;
    if v_base is null or v_base < 0 then
      raise exception 'stock_unit_incompatible' using errcode = 'P0001';
    end if;

    update public.stocktake_items
       set counted_quantity = round(v_base, 6),
           unit_id = p_unit_id,
           counted_by = auth.uid(),
           counted_at = now(),
           count_status = 'counted'
     where id = p_item_id;
  end if;
end $$;

-- ------------------------------------------------------------
-- complete: counting → pending_review (reconciles the theoretical first)
-- ------------------------------------------------------------
create or replace function public.complete_stocktake(
  p_est uuid, p_stocktake_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.review') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'counting' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  perform public.reconcile_stocktake(p_est, p_stocktake_id);

  update public.stocktakes
     set status = 'pending_review',
         completed_at = now(),
         completed_by = auth.uid()
   where id = p_stocktake_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id, from_status, to_status, changed_by)
  values (p_est, p_stocktake_id, 'counting', 'pending_review', auth.uid());
end $$;

-- ------------------------------------------------------------
-- approve: pending_review → approved (+ high-variance gate)
-- Thresholds come from the settings map (server-side), default 5% — the RPC
-- itself never hardcodes the business threshold.
-- ------------------------------------------------------------
create or replace function public.approve_stocktake(
  p_est uuid, p_stocktake_id uuid,
  p_approval_percent numeric default 5, p_approval_value numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.approve') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'pending_review' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  -- Recompute against the freshest movements before deciding.
  perform public.reconcile_stocktake(p_est, p_stocktake_id);

  if public.stocktake_high_variance(
       p_stocktake_id, p_approval_percent, p_approval_value)
     and not is_super_admin()
     and not has_permission(p_est, 'stocktakes.approve_high_variance') then
    raise exception 'stocktake_high_variance_approval' using errcode = 'P0001';
  end if;

  update public.stocktakes
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_stocktake_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id, from_status, to_status, changed_by)
  values (p_est, p_stocktake_id, 'pending_review', 'approved', auth.uid());
end $$;

-- ------------------------------------------------------------
-- validate: approved → validated — THE stock-writing point.
-- Atomicity & idempotence strategy (mirrors validate_goods_receipt):
--   1. lock the stocktake header,
--   2. pre-lock the stock_items rows of the location (ordered, FOR UPDATE)
--      so a concurrent receipt validation can neither interleave a movement
--      after the theoretical is frozen, nor update the stock rows behind us,
--   3. reconcile (expected/variance/value vs the freshest movements),
--   4. guards: all lines counted, high-variance gate,
--   5. one stock_movements row per non-zero line, tagged with stocktake_id +
--      stocktake_item_id (UNIQUE partial index ⇒ a retry is a no-op),
--   6. stock_items upsert: weighted-average on gain, cost unchanged on loss,
--      zeroed cost when the line is driven to 0,
--   7. seal to validated.
-- ------------------------------------------------------------
create or replace function public.validate_stocktake(
  p_est uuid, p_stocktake_id uuid,
  p_approval_percent numeric default 5, p_approval_value numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
  v_item record;
  v_variance numeric := 0;
  v_movement_type text;
  v_direction text;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.validate') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  -- (1) header lock (a validated stocktake can never be re-validated)
  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'approved' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  -- (2) pre-lock the stock rows (ordered ⇒ no deadlock between stocktakes)
  for v_item in (
    select si.ingredient_id
      from public.stocktake_items si
     where si.stocktake_id = p_stocktake_id
     order by si.ingredient_id
  )
  loop
    perform 1 from public.stock_items si
     where si.ingredient_id = v_item.ingredient_id
       and si.location_id = v_take.inventory_location_id
       for update;
  end loop;

  -- (3) recompute vs the freshest committed movements
  perform public.reconcile_stocktake(p_est, p_stocktake_id);

  -- (4) guards
  if exists (
    select 1 from public.stocktake_items si
     where si.stocktake_id = p_stocktake_id and si.counted_quantity is null
  ) then
    raise exception 'stocktake_incomplete' using errcode = 'P0001';
  end if;

  if public.stocktake_high_variance(
       p_stocktake_id, p_approval_percent, p_approval_value)
     and not is_super_admin()
     and not has_permission(p_est, 'stocktakes.approve_high_variance') then
    raise exception 'stocktake_high_variance_approval' using errcode = 'P0001';
  end if;

  -- (5)+(6) movements + stock upsert
  for v_item in (
    select si.id as item_id, si.ingredient_id, si.base_unit_id,
           si.unit_cost, si.counted_quantity, si.expected_quantity
      from public.stocktake_items si
     where si.stocktake_id = p_stocktake_id
     order by si.ingredient_id
  )
  loop
    v_variance := round(v_item.counted_quantity - v_item.expected_quantity, 6);
    if v_variance = 0 then
      continue;
    end if;

    if v_variance > 0 then
      v_movement_type := 'adjustment_in';
      v_direction := 'in';
    else
      v_movement_type := 'adjustment_out';
      v_direction := 'out';
      v_variance := abs(v_variance);
    end if;

    insert into public.stock_movements (
      establishment_id, ingredient_id, location_id,
      movement_type, direction, quantity,
      base_quantity, base_unit_id, unit_id,
      unit_cost, total_cost,
      reference_type, reference_id,
      stocktake_id, stocktake_item_id,
      reason, created_by
    ) values (
      p_est, v_item.ingredient_id, v_take.inventory_location_id,
      v_movement_type, v_direction, v_variance,
      v_variance, v_item.base_unit_id, v_item.base_unit_id,
      v_item.unit_cost, round(v_variance * v_item.unit_cost, 6),
      'stocktake', p_stocktake_id,
      p_stocktake_id, v_item.item_id,
      'Stocktake ' || v_take.stocktake_number, auth.uid()
    )
    on conflict (stocktake_item_id) where stocktake_item_id is not null
    do nothing;

    -- stock_items upsert
    insert into public.stock_items (
      establishment_id, ingredient_id, location_id,
      quantity, reserved_quantity, average_cost, last_cost
    ) values (
      p_est, v_item.ingredient_id, v_take.inventory_location_id,
      v_variance, 0,
      case when v_direction = 'in' then v_item.unit_cost else 0 end,
      case when v_direction = 'in' then v_item.unit_cost else null end
    )
    on conflict (establishment_id, ingredient_id, location_id)
    do update set
      quantity = round(
        case when v_direction = 'out' then 0 else 1 end
        * v_variance
        + case when v_direction = 'out' then -0 else 1 end
          * 0 + stock_items.quantity, 6),
      average_cost = case
        when v_direction = 'out' then
          case when stock_items.quantity - v_variance <= 0 then 0
               else stock_items.average_cost end
        else
          round(
            (stock_items.quantity * stock_items.average_cost
             + v_variance * v_item.unit_cost)
            / greatest(stock_items.quantity + v_variance, 0.000001), 6)
      end,
      last_cost = case
        when v_direction = 'out' then stock_items.last_cost
        else v_item.unit_cost
      end;
  end loop;

  -- (7) seal
  update public.stocktakes
     set status = 'validated',
         validated_at = now(),
         validated_by = auth.uid()
   where id = p_stocktake_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id, from_status, to_status, changed_by)
  values (p_est, p_stocktake_id, 'approved', 'validated', auth.uid());
end $$;

-- ------------------------------------------------------------
-- cancel: any non-terminal state → cancelled (never a validated stocktake)
-- ------------------------------------------------------------
create or replace function public.cancel_stocktake(
  p_est uuid, p_stocktake_id uuid, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.cancel') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status not in ('draft', 'counting', 'pending_review', 'approved') then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  update public.stocktakes
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = p_reason
   where id = p_stocktake_id;

  insert into public.stocktake_status_history
    (establishment_id, stocktake_id,
     from_status, to_status, reason, changed_by)
  values (p_est, p_stocktake_id,
          v_take.status, 'cancelled', p_reason, auth.uid());
end $$;

-- ------------------------------------------------------------
-- delete: hard delete of a DRAFT only
-- ------------------------------------------------------------
create or replace function public.delete_stocktake(
  p_est uuid, p_stocktake_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_take public.stocktakes%rowtype;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'stocktakes.delete') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_take from public.stocktakes
   where id = p_stocktake_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'stocktake_not_found' using errcode = 'P0001';
  end if;
  if v_take.status <> 'draft' then
    raise exception 'stocktake_wrong_status' using errcode = 'P0001';
  end if;

  delete from public.stocktake_status_history
   where stocktake_id = p_stocktake_id;
  delete from public.stocktake_items
   where stocktake_id = p_stocktake_id;
  delete from public.stocktakes
   where id = p_stocktake_id;
end $$;