-- 058_phase_20_order_workflow
-- Phase 20 : gestion des commandes (cycle de vie complet) & historique.
--
-- Fait évoluer de façon additive le module créé en 057 :
--   * order_status_history : timeline des statuts (création + transitions),
--     RLS permission-gated (lecture via orders.view / pos.access),
--   * transition_pos_order   : ajoute le cycle confirmé → préparation → prête →
--     servie → terminée ; annulation étendue au statut 'preparing' ; la table
--     est libérée aussi à la terminaison,
--   * create_pos_order       : journalise la création dans l'historique,
--   * merge_pos_order        : fusionne deux commandes ouvertes (draft/open),
--   * split_pos_order        : détache des lignes sélectionnées vers une
--     nouvelle commande (draft/open).
--
-- Principes conservés (miroir 057) : écritures exclusivement via RPC SECURITY
-- DEFINER, clé d'idempotence client_operation_id, totaux recalculés côté
-- serveur, permission unique par transition (orders.cancel pour l'annulation,
-- orders.update pour le reste), occupation des tables gérée par la machine.

-- ============================================================
-- 1) order_status_history
-- ============================================================
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  from_status text,
  user_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order
  on public.order_status_history (order_id, created_at);

alter table public.order_status_history enable row level security;

drop policy if exists order_status_history_read on public.order_status_history;
create policy "order_status_history_read" on public.order_status_history
  for select using (
    is_super_admin()
    or exists (
      select 1
        from public.orders o
       where o.id = order_id
         and (o.user_id = auth.uid()
              or (belongs_to_establishment(o.establishment_id)
                  and (has_permission(o.establishment_id, 'orders.view')
                       or has_permission(o.establishment_id, 'pos.access'))))
    )
  );

-- Insertion défensive via RPC (la voie normale reste SECURITY DEFINER).
drop policy if exists order_status_history_insert on public.order_status_history;
create policy "order_status_history_insert" on public.order_status_history
  for insert with check (
    is_super_admin()
    or exists (
      select 1
        from public.orders o
       where o.id = order_id
         and belongs_to_establishment(o.establishment_id)
         and (has_permission(o.establishment_id, 'orders.update')
              or has_permission(o.establishment_id, 'orders.cancel')
              or has_permission(o.establishment_id, 'pos.access'))
    )
  );

-- Journalisation d'un statut (création ou transition).
create or replace function public.log_order_status(
  p_order_id uuid,
  p_status text,
  p_from_status text default null,
  p_reason text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.order_status_history (order_id, status, from_status, user_id, reason)
  values (p_order_id, p_status, p_from_status, auth.uid(), p_reason)
$$;

-- ============================================================
-- 2) create_pos_order : journalise la création (v_draft / open)
-- ============================================================
create or replace function public.create_pos_order(
  p_est uuid,
  p_order_type text default 'dine_in',
  p_client_operation_id text default null,
  p_table_id uuid default null,
  p_dining_area_id uuid default null,
  p_customer_id uuid default null,
  p_notes text default null,
  p_discount_amount numeric default 0,
  p_discount_allowed boolean default false,
  p_status text default 'draft',
  p_items jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_number text;
  r_item record;
  v_tax_rate numeric := 0;
  v_quantity numeric := 0;
  v_payload jsonb;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'orders.create')
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  if p_order_type not in ('dine_in', 'takeaway', 'delivery', 'counter') then
    raise exception 'order_invalid_type' using errcode = 'P0001';
  end if;
  if p_status not in ('draft', 'open') then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;
  if not p_discount_allowed then
    p_discount_amount := 0;
  end if;
  if p_discount_amount < 0 then
    raise exception 'order_discount_invalid' using errcode = 'P0001';
  end if;
  if p_table_id is not null
     and not public.pos_table_scope_valid(p_est, p_table_id) then
    raise exception 'order_invalid_table' using errcode = 'P0001';
  end if;
  if p_dining_area_id is not null
     and not public.pos_area_scope_valid(p_est, p_dining_area_id) then
    raise exception 'order_invalid_area' using errcode = 'P0001';
  end if;
  if p_customer_id is not null
     and not public.pos_customer_scope_valid(p_est, p_customer_id) then
    raise exception 'order_invalid_customer' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order_empty' using errcode = 'P0001';
  end if;

  -- Idempotence : une clé client réutilisée renvoie la commande existante.
  if p_client_operation_id is not null then
    select id into v_order_id
      from public.orders
     where establishment_id = p_est
       and client_operation_id = p_client_operation_id;
    if v_order_id is not null then
      return public.pos_order_payload(v_order_id);
    end if;
  end if;

  v_number := public.next_pos_order_number(p_est);

  insert into public.orders
    (establishment_id, order_number, order_type, client_operation_id,
     table_id, dining_area_id, customer_id, notes,
     discount_amount, status, user_id, created_by, updated_by)
  values
    (p_est, v_number, p_order_type, p_client_operation_id,
     p_table_id, p_dining_area_id, p_customer_id, p_notes,
     p_discount_amount, p_status, auth.uid(), auth.uid(), auth.uid())
  returning id into v_order_id;

  for r_item in
    select x.product_id::uuid as product_id, x.quantity::numeric as quantity
      from jsonb_to_recordset(p_items)
        as x(product_id text, quantity numeric)
  loop
    if r_item.product_id is null or r_item.quantity is null
       or r_item.quantity <= 0 then
      raise exception 'order_item_invalid' using errcode = 'P0001';
    end if;
    if not public.pos_product_scope_valid(p_est, r_item.product_id) then
      raise exception 'order_item_invalid' using errcode = 'P0001';
    end if;

    select coalesce(t.rate, 0) into v_tax_rate
      from public.products p
      left join public.taxes t on t.id = p.tax_id
     where p.id = r_item.product_id;

    v_quantity := r_item.quantity;

    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price,
       tax_rate, tax_amount, total)
    select v_order_id, p.id, p.name, v_quantity, p.price,
           v_tax_rate,
           round(v_quantity * p.price * coalesce(t.rate, 0) / 100, 3),
           round(v_quantity * p.price, 3)
      from public.products p
      left join public.taxes t on t.id = p.tax_id
     where p.id = r_item.product_id;
  end loop;

  perform public.recompute_pos_order_totals(p_est, v_order_id);
  perform public.log_order_status(v_order_id, p_status, null, null);
  return public.pos_order_payload(v_order_id);
end $$;

-- ============================================================
-- 3) transition_pos_order — cycle de vie complet
--    draft → open | confirmed
--    open  → confirmed | cancelled
--    confirmed → open (attente) | preparing (envoyé en cuisine) | cancelled
--    preparing → ready | cancelled
--    ready  → served
--    served → completed
--    completed / cancelled : terminaux
--
--    Table : confirmé → occupée ; attente / annulation / terminée → libérée
--    (si elle était 'occupied'). Préparation → prête → servie : inchangée.
-- ============================================================
create or replace function public.transition_pos_order(
  p_est uuid,
  p_order_id uuid,
  p_to_status text,
  p_client_operation_id text default null,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_perm text;
begin
  select case p_to_status
      when 'cancelled' then 'orders.cancel'
      else 'orders.update'
    end into v_perm;

  if not is_super_admin()
     and not has_permission(p_est, v_perm)
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  if p_to_status not in ('draft', 'open', 'confirmed', 'preparing',
                         'ready', 'served', 'completed', 'cancelled') then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  -- Idempotence : confirmations/reprises avec la même clé client = no-op.
  if p_client_operation_id is not null
     and v_order.status = p_to_status
     and p_to_status in ('confirmed', 'open') then
    return public.pos_order_payload(p_order_id);
  end if;

  -- Transitions autorisées (machine d'état stricte côté serveur).
  if not (
    (p_to_status = 'open' and v_order.status in ('draft', 'confirmed'))
    or (p_to_status = 'confirmed' and v_order.status in ('draft', 'open'))
    or (p_to_status = 'preparing' and v_order.status = 'confirmed')
    or (p_to_status = 'ready' and v_order.status = 'preparing')
    or (p_to_status = 'served' and v_order.status = 'ready')
    or (p_to_status = 'completed' and v_order.status = 'served')
    or (p_to_status = 'cancelled' and v_order.status in ('draft', 'open', 'confirmed', 'preparing'))
  ) then
    raise exception 'order_bad_transition' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_to_status,
         client_operation_id = coalesce(p_client_operation_id, client_operation_id),
         confirmed_at = case when p_to_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
         confirmed_by = case when p_to_status = 'confirmed' and confirmed_by is null then auth.uid() else confirmed_by end,
         held_at = case when p_to_status = 'open' then now() else held_at end,
         cancelled_at = case when p_to_status = 'cancelled' then now() else cancelled_at end,
         cancelled_by = case when p_to_status = 'cancelled' then auth.uid() else cancelled_by end,
         cancellation_reason = case when p_to_status = 'cancelled' then p_reason else cancellation_reason end,
         updated_by = auth.uid()
   where id = p_order_id;

  -- Occupation : confirmé → 'occupied' ; attente / annulation / terminée → libère.
  if p_to_status = 'confirmed' and v_order.table_id is not null then
    update public.tables
       set status = 'occupied'
     where id = v_order.table_id and establishment_id = p_est
       and status in ('available', 'reserved');
  elsif p_to_status in ('open', 'cancelled', 'completed') and v_order.table_id is not null then
    update public.tables
       set status = 'available'
     where id = v_order.table_id and establishment_id = p_est
       and status = 'occupied';
  end if;

  perform public.log_order_status(p_order_id, p_to_status, v_order.status, p_reason);
  return public.pos_order_payload(p_order_id);
end $$;

-- ============================================================
-- 4) merge_pos_order — fusionne deux commandes ouvertes (draft/open)
--    Source → cible : lignes déplacées, remise cumulée (bornée au sous-total),
--    source annulée avec motif 'order_merged', table libérée si différente.
-- ============================================================
create or replace function public.merge_pos_orders(
  p_est uuid,
  p_source_order_id uuid,
  p_target_order_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_source public.orders%rowtype;
  v_target public.orders%rowtype;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'orders.update')
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  if p_source_order_id = p_target_order_id then
    raise exception 'order_bad_transition' using errcode = 'P0001';
  end if;

  select * into v_source from public.orders
   where id = p_source_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  select * into v_target from public.orders
   where id = p_target_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_source.status not in ('draft', 'open')
     or v_target.status not in ('draft', 'open') then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;

  -- 1) déplacer les lignes de la source vers la cible
  update public.order_items
     set order_id = p_target_order_id,
         discount_amount = 0
   where order_id = p_source_order_id;

  -- 2) remise cumulée (plafonnée au sous-total recalculé de la cible)
  perform public.recompute_pos_order_totals(p_est, p_target_order_id);

  select coalesce(subtotal, 0) into v_subtotal from public.orders where id = p_target_order_id;
  v_discount := greatest(0, coalesce(v_target.discount_amount, 0) + coalesce(v_source.discount_amount, 0));
  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;

  update public.orders
     set discount_amount = v_discount,
         updated_by = auth.uid()
   where id = p_target_order_id;
  perform public.recompute_pos_order_totals(p_est, p_target_order_id);

  -- 3) annuler la source (motif fusion) + libérer sa table éventuelle
  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = 'order_merged',
         updated_by = auth.uid()
   where id = p_source_order_id;
  if v_source.table_id is not null then
    update public.tables
       set status = 'available'
     where id = v_source.table_id and establishment_id = p_est
       and status = 'occupied';
  end if;
  perform public.log_order_status(p_source_order_id, 'cancelled', v_source.status, 'order_merged');

  return public.pos_order_payload(p_target_order_id);
end $$;

-- ============================================================
-- 5) split_pos_order — détache des lignes vers une nouvelle commande
--    p_items : [id, ...] des order_items à déplacer (le reste reste sur la
--    commande source). La nouvelle commande hérite du statut source
--    (draft/open) et reçoit un numéro serveur.
-- ============================================================
create or replace function public.split_pos_order(
  p_est uuid,
  p_source_order_id uuid,
  p_order_type text default 'dine_in',
  p_client_operation_id text default null,
  p_table_id uuid default null,
  p_dining_area_id uuid default null,
  p_customer_id uuid default null,
  p_notes text default null,
  p_items jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_source public.orders%rowtype;
  v_target_id uuid;
  v_number text;
  v_status text;
  v_count integer := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'orders.update')
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_source from public.orders
   where id = p_source_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_source.status not in ('draft', 'open') then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order_empty' using errcode = 'P0001';
  end if;
  if p_order_type not in ('dine_in', 'takeaway', 'delivery', 'counter') then
    raise exception 'order_invalid_type' using errcode = 'P0001';
  end if;
  if p_table_id is not null
     and not public.pos_table_scope_valid(p_est, p_table_id) then
    raise exception 'order_invalid_table' using errcode = 'P0001';
  end if;
  if p_dining_area_id is not null
     and not public.pos_area_scope_valid(p_est, p_dining_area_id) then
    raise exception 'order_invalid_area' using errcode = 'P0001';
  end if;
  if p_customer_id is not null
     and not public.pos_customer_scope_valid(p_est, p_customer_id) then
    raise exception 'order_invalid_customer' using errcode = 'P0001';
  end if;

  -- Idempotence de la bijuration (réutilisation d'une clé client).
  if p_client_operation_id is not null then
    select id into v_target_id
      from public.orders
     where establishment_id = p_est
       and client_operation_id = p_client_operation_id;
    if v_target_id is not null then
      return public.pos_order_payload(v_target_id);
    end if;
  end if;

  v_status := v_source.status;
  v_number := public.next_pos_order_number(p_est);

  insert into public.orders
    (establishment_id, order_number, order_type, client_operation_id,
     table_id, dining_area_id, customer_id, notes,
     discount_amount, status, user_id, created_by, updated_by)
  values
    (p_est, v_number, p_order_type, p_client_operation_id,
     p_table_id, p_dining_area_id, p_customer_id, p_notes,
     0, v_status, auth.uid(), auth.uid(), auth.uid())
  returning id into v_target_id;

  -- Déplace uniquement les lignes appartenant à la source.
  update public.order_items
     set order_id = v_target_id,
         discount_amount = 0
   where order_id = p_source_order_id
     and id = any (array(select (x.id)::uuid
                            from jsonb_array_elements(p_items) as x(id text)));

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'order_item_invalid' using errcode = 'P0001';
  end if;

  perform public.recompute_pos_order_totals(p_est, p_source_order_id);
  perform public.recompute_pos_order_totals(p_est, v_target_id);
  perform public.log_order_status(v_target_id, v_status, null, null);

  return public.pos_order_payload(v_target_id);
end $$;