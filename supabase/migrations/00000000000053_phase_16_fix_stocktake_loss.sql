-- 053_phase_16_fix_stocktake_loss
-- Phase 16 fix: `validate_stocktake` computed the upserted stock quantity only
-- for gains (direction='in'); on a loss (direction='out') the quantity stayed
-- unchanged instead of being decremented by the missing variance. The correct
-- rule is  quantity ± |variance| :  gain → +variance,  loss → −variance.
-- Applied via `create or replace` (single function, no schema change).
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

    -- stock_items upsert — quantity moves WITH the variance (in: +, out: −).
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
        case when v_direction = 'out' then -1 else 1 end
        * v_variance
        + stock_items.quantity, 6),
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