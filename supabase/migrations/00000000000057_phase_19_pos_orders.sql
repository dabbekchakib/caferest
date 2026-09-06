-- 057_phase_19_pos_orders
-- Phase 19 : POS, prise de commande & panier de vente.
--
-- Evolves the orders / order_items created in 016 (kept, not recreated):
--   * orders   : + dining_area_id, client_operation_id, created_by, updated_by,
--                confirmed_at/by, held_at, cancelled_at/by, cancellation_reason,
--   * order_items : + product_name (nom figé), tax_rate (taux figé) — le prix
--                unitaire est déjà snapshoté dans unit_price,
--   * statuses : adds `open` (commande enregistrée / mise en attente, modifiable,
--                reprise possible), types de vente : adds `counter`,
--   * idempotence : unique partiel (establishment_id, client_operation_id) pour
--                les confirmations/reprises à clé de frappe unique,
--   * RLS      : policies permission-gated (pos.*, orders.*) remplaçant les
--                legacy "belongs_to_establishment" for all,
--   * écritures atomiques via RPC SECURITY DEFINER : numérotation serveur,
--                snapshots produits, totaux recalculés côté serveur (le client
--                n'est JAMAIS la source de vérité), transitions de statut,
--                occupation de table. Les valeurs de la façade sont toujours
--                re-snapshotées depuis les tables (produit / taxes).
--
-- Guard principle (miroir phases 14/17) : chaque RPC vérifie dans l'ordre
--   (a) la permission (is_super_admin() ou has_permission est <slug>),
--   (b) l'appartenance du document à l'établissement,
--   (c) le statut attendu pour l'opération,
--   (d) la règle métier (type de vente, réduction autorisée, transition).

-- ============================================================
-- 1) orders evolution
-- ============================================================
alter table public.orders
  add column if not exists dining_area_id uuid references public.dining_areas (id) on delete set null,
  add column if not exists client_operation_id text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users (id) on delete set null,
  add column if not exists held_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists cancellation_reason text;

-- backfill d'audit pour les lignes historiques éventuelles
update public.orders
   set created_by = user_id, updated_by = user_id
 where created_by is null and user_id is not null;

-- Statuts : ajoute `open` (les statuts legacy restent lisibles/compatibles).
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check check (
    status in ('draft', 'open', 'confirmed', 'cancelled',
               'pending', 'preparing', 'ready', 'served', 'completed')
  );

-- Types de vente : ajoute `counter` (comptoir/à emporter sur place).
alter table public.orders
  drop constraint if exists orders_type_check;

alter table public.orders
  add constraint orders_type_check check (
    order_type in ('dine_in', 'takeaway', 'delivery', 'counter')
  );

-- Idempotence : une même opération client ne crée jamais deux commandes.
create unique index if not exists uq_orders_establishment_operation
  on public.orders (establishment_id, client_operation_id)
  where client_operation_id is not null;

create index if not exists idx_orders_dining_area on public.orders (dining_area_id);
create index if not exists idx_orders_created_by on public.orders (created_by);
create index if not exists idx_orders_est_status_created on public.orders (establishment_id, status, created_at desc);

-- ============================================================
-- 2) order_items evolution (snapshots)
-- ============================================================
alter table public.order_items
  add column if not exists product_name text,
  add column if not exists tax_rate numeric not null default 0;

-- ============================================================
-- 3) helpers + numérotation serveur (#000001, #000002, ...)
-- ============================================================
create or replace function public.pos_product_scope_valid(p_est uuid, p_product_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products p
     where p.id = p_product_id
       and p.establishment_id = p_est
       and p.is_active
       and p.is_available
       and p.is_pos_enabled
  )
$$;

create or replace function public.pos_table_scope_valid(p_est uuid, p_table_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tables t
     where t.id = p_table_id
       and t.establishment_id = p_est
       and t.status <> 'disabled'
  )
$$;

create or replace function public.pos_area_scope_valid(p_est uuid, p_area_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dining_areas a
     where a.id = p_area_id
       and a.establishment_id = p_est
  )
$$;

create or replace function public.pos_customer_scope_valid(p_est uuid, p_customer_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.customers c
     where c.id = p_customer_id
       and c.establishment_id = p_est
  )
$$;

create or replace function public.next_pos_order_number(p_est uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_max integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('pos_order_number:' || p_est::text));
  select coalesce(max(substring(o.order_number from '^#([0-9]{6})$')::integer), 0)
    into v_max
    from public.orders o
   where o.establishment_id = p_est
     and o.order_number ~ '^#[0-9]{6}$';
  return '#' || lpad((v_max + 1)::text, 6, '0');
end $$;

-- ============================================================
-- 4) recompute serveur des totaux (autorité absolue)
--    subtotal = Σ qty × unit_price ; tax = Σ tax_amount snapshotée ;
--    remise plafonnée au sous-total ; total = subnet + tax − remise.
-- ============================================================
create or replace function public.recompute_pos_order_totals(p_est uuid, p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_discount numeric := 0;
begin
  perform 1 from public.orders
   where id = p_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  update public.order_items
     set discount_amount = 0,
         total = round(quantity * unit_price, 3)
   where order_id = p_order_id;

  select coalesce(sum(quantity * unit_price), 0), coalesce(sum(tax_amount), 0)
    into v_subtotal, v_tax
    from public.order_items
   where order_id = p_order_id;

  select coalesce(discount_amount, 0) into v_discount
    from public.orders where id = p_order_id;
  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;

  update public.orders
     set subtotal = round(v_subtotal, 3),
         discount_amount = round(v_discount, 3),
         tax_amount = round(v_tax, 3),
         total = round(v_subtotal - v_discount + v_tax, 3),
         updated_at = now()
   where id = p_order_id;
end $$;

-- Payload de résultat partagé entre les RPC d'écriture.
create or replace function public.pos_order_payload(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'subtotal', o.subtotal,
    'discount_amount', o.discount_amount,
    'tax_amount', o.tax_amount,
    'total', o.total
  ) from public.orders o where o.id = p_order_id
$$;

-- ============================================================
-- 5) create_pos_order — brouillon (draft) ou enregistrée (open)
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
  return public.pos_order_payload(v_order_id);
end $$;

-- ============================================================
-- 6) update_pos_order_items — remplacement atomique des lignes
--    (draft / open uniquement)
-- ============================================================
create or replace function public.update_pos_order_items(
  p_est uuid,
  p_order_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  r_item record;
  v_tax_rate numeric := 0;
  v_quantity numeric := 0;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'orders.update')
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status not in ('draft', 'open') then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order_empty' using errcode = 'P0001';
  end if;

  delete from public.order_items where order_id = p_order_id;

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

    v_quantity := r_item.quantity;

    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price,
       tax_rate, tax_amount, total)
    select p_order_id, p.id, p.name, v_quantity, p.price,
           coalesce(t.rate, 0),
           round(v_quantity * p.price * coalesce(t.rate, 0) / 100, 3),
           round(v_quantity * p.price, 3)
      from public.products p
      left join public.taxes t on t.id = p.tax_id
     where p.id = r_item.product_id;
  end loop;

  update public.orders set updated_by = auth.uid() where id = p_order_id;
  perform public.recompute_pos_order_totals(p_est, p_order_id);
  return public.pos_order_payload(p_order_id);
end $$;

-- ============================================================
-- 7) update_pos_order_details — métadonnées + remise (draft/open/confirmed)
--    p_updates: {"order_type"?, "table_id"?, "dining_area_id"?,
--                "customer_id"?, "notes"?, "discount_amount"?}
--    (présence = appliquer, y compris un "null" pour dé-assigner)
-- ============================================================
create or replace function public.update_pos_order_details(
  p_est uuid,
  p_order_id uuid,
  p_updates jsonb,
  p_discount_allowed boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_discount numeric;
begin
  if not is_super_admin()
     and not has_permission(p_est, 'orders.update')
     and not has_permission(p_est, 'pos.access') then
    raise exception 'missing_permission' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and establishment_id = p_est
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'order_wrong_status' using errcode = 'P0001';
  end if;

  if p_updates ? 'order_type' then
    if not p_updates->>'order_type' in ('dine_in', 'takeaway', 'delivery', 'counter') then
      raise exception 'order_invalid_type' using errcode = 'P0001';
    end if;
  end if;
  if p_updates ? 'table_id'
     and not (p_updates->>'table_id' is null
              or public.pos_table_scope_valid(p_est, nullif(p_updates->>'table_id', '')::uuid)) then
    raise exception 'order_invalid_table' using errcode = 'P0001';
  end if;
  if p_updates ? 'dining_area_id'
     and not (p_updates->>'dining_area_id' is null
              or public.pos_area_scope_valid(p_est, nullif(p_updates->>'dining_area_id', '')::uuid)) then
    raise exception 'order_invalid_area' using errcode = 'P0001';
  end if;
  if p_updates ? 'customer_id'
     and not (p_updates->>'customer_id' is null
              or public.pos_customer_scope_valid(p_est, nullif(p_updates->>'customer_id', '')::uuid)) then
    raise exception 'order_invalid_customer' using errcode = 'P0001';
  end if;
  if p_updates ? 'discount_amount' then
    if not p_discount_allowed then
      raise exception 'order_discount_forbidden' using errcode = 'P0001';
    end if;
    v_discount := ((p_updates->>'discount_amount')::numeric);
    if v_discount < 0 then
      raise exception 'order_discount_invalid' using errcode = 'P0001';
    end if;
  end if;

  update public.orders
     set order_type = coalesce(p_updates->>'order_type', v_order.order_type),
         table_id = case when p_updates ? 'table_id'
                         then (p_updates->>'table_id')::uuid
                         else v_order.table_id end,
         dining_area_id = case when p_updates ? 'dining_area_id'
                               then (p_updates->>'dining_area_id')::uuid
                               else v_order.dining_area_id end,
         customer_id = case when p_updates ? 'customer_id'
                            then (p_updates->>'customer_id')::uuid
                            else v_order.customer_id end,
         notes = case when p_updates ? 'notes' then p_updates->>'notes'
                      else v_order.notes end,
         discount_amount = case when p_updates ? 'discount_amount'
                                then v_discount
                                else v_order.discount_amount end,
         updated_by = auth.uid()
   where id = p_order_id;

  perform public.recompute_pos_order_totals(p_est, p_order_id);
  return public.pos_order_payload(p_order_id);
end $$;

-- ============================================================
-- 8) transition_pos_order — le SEUL point de changement de statut
--    draft → confirmed (confirmer)
--    open  → confirmed (reprendre / re-confirmer)
--    confirmed → open (mettre en attente)
--    draft | open | confirmed → cancelled (annuler, table libérée)
--
--    Occupation de table : la table passe à 'occupied' à la confirmation et
--    revient à 'available' (si elle était 'occupied') en attente / annulation.
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

  if p_to_status not in ('draft', 'open', 'confirmed', 'cancelled') then
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

  -- Transitions autorisées.
  if not (
    (p_to_status = 'confirmed' and v_order.status in ('draft', 'open'))
    or (p_to_status = 'open' and v_order.status = 'confirmed')
    or (p_to_status = 'cancelled' and v_order.status in ('draft', 'open', 'confirmed'))
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

  -- Occupation : confirmé → 'occupied' ; attente/annulation → libère si la
  -- table portait 'occupied' (jamais la forcer depuis un autre état).
  if p_to_status = 'confirmed' and v_order.table_id is not null then
    update public.tables
       set status = 'occupied'
     where id = v_order.table_id and establishment_id = p_est
       and status in ('available', 'reserved');
  elsif p_to_status in ('open', 'cancelled') and v_order.table_id is not null then
    update public.tables
       set status = 'available'
     where id = v_order.table_id and establishment_id = p_est
       and status = 'occupied';
  end if;

  return public.pos_order_payload(p_order_id);
end $$;

-- ============================================================
-- 9) RLS — policies permission-gated (remplacent les legacy)
--    Voir 056 pour le motif ; le POS n'offre aucune suppression.
-- ============================================================
drop policy if exists orders_read on public.orders;
create policy "orders_read" on public.orders
  for select using (
    is_super_admin()
    or user_id = auth.uid()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'orders.view')
             or has_permission(establishment_id, 'pos.access')))
  );

drop policy if exists orders_write on public.orders;
create policy "orders_member_insert" on public.orders
  for insert with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'orders.create')
             or has_permission(establishment_id, 'pos.access')))
  );

create policy "orders_member_update" on public.orders
  for update using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'orders.update')
             or has_permission(establishment_id, 'orders.cancel')
             or has_permission(establishment_id, 'pos.access')))
  ) with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'orders.update')
             or has_permission(establishment_id, 'orders.cancel')
             or has_permission(establishment_id, 'pos.access')))
  );

drop policy if exists order_items_read on public.order_items;
create policy "order_items_read" on public.order_items
  for select using (
    is_super_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_id
         and (o.user_id = auth.uid()
              or (belongs_to_establishment(o.establishment_id)
                  and (has_permission(o.establishment_id, 'orders.view')
                       or has_permission(o.establishment_id, 'pos.access'))))
    )
  );

drop policy if exists order_items_write on public.order_items;
create policy "order_items_member_insert" on public.order_items
  for insert with check (
    is_super_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_id
         and belongs_to_establishment(o.establishment_id)
         and (has_permission(o.establishment_id, 'orders.create')
              or has_permission(o.establishment_id, 'pos.access'))
    )
  );

create policy "order_items_member_update" on public.order_items
  for update using (
    is_super_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_id
         and belongs_to_establishment(o.establishment_id)
         and (has_permission(o.establishment_id, 'orders.update')
              or has_permission(o.establishment_id, 'pos.access'))
    )
  ) with check (
    is_super_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_id
         and belongs_to_establishment(o.establishment_id)
         and (has_permission(o.establishment_id, 'orders.update')
              or has_permission(o.establishment_id, 'pos.access'))
    )
  );

-- ============================================================
-- 10) Notes de permissions — POS/ordres réutilisent les slugs existants :
--     pos.access, orders.view, orders.create, orders.update, orders.cancel
--     (déjà semés en 027 + matrice rôles ; rien à ajouter ici).
-- ============================================================