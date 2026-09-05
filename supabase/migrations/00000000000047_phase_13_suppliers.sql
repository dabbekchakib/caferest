-- 047_phase_13_suppliers
-- Phase 13: Suppliers & purchase catalog.
--
-- Legal/evolution rules:
--   * the `suppliers` table (010) is NEVER recreated — this migration only
--     adds columns, constraints and permission-gated RLS (the 023 blanket
--     `suppliers_write` policy is replaced),
--   * new tables: supplier_contacts, ingredient_suppliers,
--     supplier_price_history — all establishment-scoped with RLS,
--   * the grain is: Supplier → Supplier Catalog → Ingredient → Purchase Unit
--     → Purchase Price → Conversion → Base Unit. No purchase orders, no
--     stock, no receiving, no inventory: the catalog only prepares the future
--     costing + procurement pipeline,
--   * a single active preferred supplier per ingredient is enforced by the
--     database (partial unique index), not only by the UI,
--   * price history is append-only: editing a price closes the current open
--     row (valid_until) and opens a new one — nothing is ever overwritten in
--     place.
--
-- New RSA permission slugs (module `suppliers`): suppliers.activate,
-- suppliers.manage_catalog, suppliers.view_prices, suppliers.update_prices
-- (view/create/update/delete already exist since 027/045).

-- ============================================================
-- 1) suppliers table evolution (additive; legacy columns preserved)
-- ============================================================
alter table public.suppliers
  add column if not exists legal_name text,
  add column if not exists registration_number text,
  add column if not exists mobile text,
  add column if not exists website text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists contact_person text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists payment_terms text,
  add column if not exists default_payment_method_id uuid
    references public.payment_methods (id) on delete set null,
  add column if not exists delivery_lead_time_days integer,
  add column if not exists minimum_order_amount numeric,
  add column if not exists is_preferred boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

-- Backfill: legacy flat contact/address fields feed the structured ones
-- when the new columns are empty (keeps the Phase-03 quick-created rows
-- fully readable in the Phase-13 UI).
update public.suppliers
   set contact_person   = coalesce(contact_person, contact_name),
       contact_phone    = coalesce(contact_phone, phone),
       contact_email    = coalesce(contact_email, email),
       address_line_1   = coalesce(address_line_1, address)
 where id is not null;

-- Business checks (never block a quick supplier: everything else optional).
alter table public.suppliers
  add constraint suppliers_delivery_lead_time_check check (
    delivery_lead_time_days is null or delivery_lead_time_days >= 0
  ),
  add constraint suppliers_minimum_order_check check (
    minimum_order_amount is null or minimum_order_amount >= 0
  );

-- Search + listing indexes (§71).
create index if not exists idx_suppliers_city on public.suppliers (city);
create index if not exists idx_suppliers_email on public.suppliers (lower(email));
create index if not exists idx_suppliers_code on public.suppliers (code);
create index if not exists idx_suppliers_preferred on public.suppliers (is_preferred);

-- Stable internal code generator: SUP-0001, SUP-0002… unique per
-- establishment. Uses a transactional advisory lock so two concurrent
-- creations never race to the same number.
create or replace function public.next_supplier_code(p_est uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('supplier_code:' || p_est::text));

  select coalesce(max(
      substring(s.code from 'SUP-([0-9]+)$')::integer
    ), 0)
    into v_max
    from public.suppliers s
   where s.establishment_id = p_est
     and s.code ~ '^SUP-[0-9]+$';

  return 'SUP-' || lpad((v_max + 1)::text, 4, '0');
end $$;

-- ============================================================
-- 2) RLS helpers — forbid cross-establishment references
-- ============================================================
create or replace function public.supplier_references_valid(
  p_establishment_id uuid,
  p_supplier_id uuid,
  p_default_payment_method_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_supplier_id is null or exists (
      select 1 from public.suppliers s
      where s.id = p_supplier_id
        and s.establishment_id = p_establishment_id))
    and (p_default_payment_method_id is null or exists (
      select 1 from public.payment_methods pm
      where pm.id = p_default_payment_method_id
        and pm.establishment_id = p_establishment_id)));
$$;

create or replace function public.supplier_catalog_references_valid(
  p_establishment_id uuid,
  p_supplier_id uuid,
  p_ingredient_id uuid,
  p_purchase_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_supplier_id is null or exists (
      select 1 from public.suppliers s
      where s.id = p_supplier_id
        and belongs_to_establishment(s.establishment_id)
        and s.establishment_id = p_establishment_id))
    and (p_ingredient_id is null or exists (
      select 1 from public.ingredients i
      where i.id = p_ingredient_id
        and i.establishment_id = p_establishment_id))
    and (p_purchase_unit_id is null or exists (
      select 1 from public.units u
      where u.id = p_purchase_unit_id
        and (u.establishment_id = p_establishment_id or u.establishment_id is null)));
$$;

-- ============================================================
-- 3) suppliers RLS — permission-gated (replaces 023 blanket policies)
-- ============================================================
drop policy if exists suppliers_read on public.suppliers;
drop policy if exists suppliers_write on public.suppliers;

create policy "suppliers_read" on public.suppliers
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin() or has_permission(establishment_id, 'suppliers.view'))
  );

create policy "suppliers_member_insert" on public.suppliers
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.create')
    and supplier_references_valid(
          establishment_id, id::uuid, default_payment_method_id)
  );

create policy "suppliers_member_update" on public.suppliers
  for update using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.update')
  ) with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.update')
    and supplier_references_valid(
          establishment_id, id::uuid, default_payment_method_id)
  );

create policy "suppliers_member_delete" on public.suppliers
  for delete using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.delete')
  );

-- ============================================================
-- 4) supplier_contacts
-- ============================================================
create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  mobile text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most ONE active primary contact per supplier — enforced by the DB.
create unique index if not exists uq_supplier_contacts_active_primary
  on public.supplier_contacts (supplier_id)
  where is_primary and is_active;

create index if not exists idx_supplier_contacts_supplier
  on public.supplier_contacts (supplier_id);
create index if not exists idx_supplier_contacts_active
  on public.supplier_contacts (supplier_id, is_active);

create trigger trg_supplier_contacts_updated_at
  before update on public.supplier_contacts
  for each row
  execute function public.set_updated_at();

alter table public.supplier_contacts enable row level security;

create policy "supplier_contacts_read" on public.supplier_contacts
  for select using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id
        and belongs_to_establishment(s.establishment_id)
        and (is_super_admin() or has_permission(s.establishment_id, 'suppliers.view'))
    )
  );

create policy "supplier_contacts_member_write" on public.supplier_contacts
  for all using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id
        and belongs_to_establishment(s.establishment_id)
        and has_permission(s.establishment_id, 'suppliers.update')
    )
  ) with check (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id
        and belongs_to_establishment(s.establishment_id)
        and has_permission(s.establishment_id, 'suppliers.update')
    )
  );

-- ============================================================
-- 5) ingredient_suppliers (the supplier catalog)
-- ============================================================
create table if not exists public.ingredient_suppliers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  supplier_sku text,
  supplier_barcode text,
  purchase_unit_id uuid references public.units (id) on delete restrict,
  purchase_quantity numeric not null default 1,
  purchase_price numeric not null default 0,
  currency_code text not null default 'TND',
  minimum_order_quantity numeric,
  lead_time_days integer,
  is_preferred boolean not null default false,
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A supplier is listed once per ingredient.
create unique index if not exists uq_ingredient_suppliers_item
  on public.ingredient_suppliers (ingredient_id, supplier_id);

-- ONE active preferred supplier per ingredient — DB-enforced (not just UI).
create unique index if not exists uq_ingredient_suppliers_preferred
  on public.ingredient_suppliers (ingredient_id)
  where is_preferred and is_active;

create index if not exists idx_ingredient_suppliers_establishment
  on public.ingredient_suppliers (establishment_id);
create index if not exists idx_ingredient_suppliers_ingredient
  on public.ingredient_suppliers (ingredient_id);
create index if not exists idx_ingredient_suppliers_supplier
  on public.ingredient_suppliers (supplier_id);
create index if not exists idx_ingredient_suppliers_active
  on public.ingredient_suppliers (ingredient_id, is_active);
create index if not exists idx_ingredient_suppliers_sku
  on public.ingredient_suppliers (supplier_sku);

-- Checks: prices/quantities sane.
alter table public.ingredient_suppliers
  add constraint ingredient_suppliers_quantity_check check (
    purchase_quantity > 0
  ),
  add constraint ingredient_suppliers_price_check check (
    purchase_price >= 0
  ),
  add constraint ingredient_suppliers_min_order_check check (
    minimum_order_quantity is null or minimum_order_quantity >= 0
  ),
  add constraint ingredient_suppliers_lead_time_check check (
    lead_time_days is null or lead_time_days >= 0
  ),
  add constraint ingredient_suppliers_validity_check check (
    valid_until is null or valid_from <= valid_until
  );

create trigger trg_ingredient_suppliers_updated_at
  before update on public.ingredient_suppliers
  for each row
  execute function public.set_updated_at();

alter table public.ingredient_suppliers enable row level security;

-- Reads: any `suppliers.view` holder sees the catalog rows (prices are
-- surfaced through the service layer which additionally checks
-- `suppliers.view_prices`; mirrors the ingredients.purchase_cost pattern).
create policy "ingredient_suppliers_read" on public.ingredient_suppliers
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin() or has_permission(establishment_id, 'suppliers.view'))
  );

create policy "ingredient_suppliers_member_insert" on public.ingredient_suppliers
  for insert with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.manage_catalog')
    and supplier_catalog_references_valid(
          establishment_id, supplier_id, ingredient_id, purchase_unit_id)
  );

create policy "ingredient_suppliers_member_update" on public.ingredient_suppliers
  for update using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.manage_catalog')
  ) with check (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.manage_catalog')
    and supplier_catalog_references_valid(
          establishment_id, supplier_id, ingredient_id, purchase_unit_id)
  );

create policy "ingredient_suppliers_member_delete" on public.ingredient_suppliers
  for delete using (
    belongs_to_establishment(establishment_id)
    and has_permission(establishment_id, 'suppliers.manage_catalog')
  );

-- ============================================================
-- 6) supplier_price_history (append-only price ledger)
-- ============================================================
create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  ingredient_supplier_id uuid not null
    references public.ingredient_suppliers (id) on delete cascade,
  purchase_price numeric not null,
  currency_code text not null,
  purchase_unit_id uuid references public.units (id) on delete set null,
  purchase_quantity numeric not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_price_history_item
  on public.supplier_price_history (ingredient_supplier_id);
create index if not exists idx_supplier_price_history_valid_from
  on public.supplier_price_history (ingredient_supplier_id, valid_from);
create index if not exists idx_supplier_price_history_establishment
  on public.supplier_price_history (establishment_id);

alter table public.supplier_price_history
  add constraint supplier_price_history_quantity_check check (
    purchase_quantity > 0
  ),
  add constraint supplier_price_history_price_check check (
    purchase_price >= 0
  ),
  add constraint supplier_price_history_validity_check check (
    valid_until is null or valid_from <= valid_until
  );

alter table public.supplier_price_history enable row level security;

-- The table contains ONLY prices: reads are gated by `suppliers.view_prices`
-- so a catalog-only user never sees the ledger (UI + API + RLS align).
create policy "supplier_price_history_read" on public.supplier_price_history
  for select using (
    belongs_to_establishment(establishment_id)
    and (is_super_admin() or has_permission(establishment_id, 'suppliers.view_prices'))
  );

-- Writes are append-only, done through the service layer which requires
-- `suppliers.update_prices` to close/open price rows. `suppliers.manage_catalog`
-- holders may APPEND (they add items with an initial price) but can never
-- UPDATE or DELETE ledger rows.
create policy "supplier_price_history_member_write" on public.supplier_price_history
  for insert with check (
    belongs_to_establishment(establishment_id)
    and (
      has_permission(establishment_id, 'suppliers.update_prices')
      or has_permission(establishment_id, 'suppliers.manage_catalog')
    )
    and exists (
      select 1 from public.ingredient_suppliers ins
      where ins.id = ingredient_supplier_id
        and ins.establishment_id = establishment_id
    )
  );

create policy "supplier_price_history_no_update" on public.supplier_price_history
  for update using (false) with check (false);

create policy "supplier_price_history_no_delete" on public.supplier_price_history
  for delete using (false);

-- ============================================================
-- 7) Atomic catalog RPCs
--    The service layer keeps values validated with Zod; these functions only
--    guarantee DB atomicity (catalog row + price ledger in ONE transaction)
--    and run with RLS (security invoker) so every statement is still
--    permission-checked for the calling user.
-- ============================================================

-- Create a catalog entry and its INITIAL price-history row atomically.
-- Returns the new ingredient_suppliers id.
create or replace function public.add_ingredient_supplier_with_history(
  p_est uuid,
  p_ingredient_id uuid,
  p_supplier_id uuid,
  p_unit_id uuid,
  p_qty numeric,
  p_price numeric,
  p_currency text,
  p_min_order numeric,
  p_lead_time_days integer,
  p_is_preferred boolean,
  p_notes text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_item uuid;
begin
  if not has_permission(p_est, 'suppliers.manage_catalog') then
    raise exception using errcode='P0001', message='forbidden';
  end if;

  -- A single active preferred supplier per ingredient (DB-enforced): clear the
  -- previous one BEFORE the insert so the partial unique index never sees two
  -- rows with is_preferred = true in the same transaction.
  if coalesce(p_is_preferred, false) then
    update public.ingredient_suppliers
       set is_preferred = false
     where establishment_id = p_est
       and ingredient_id = p_ingredient_id
       and is_active;
  end if;

  insert into public.ingredient_suppliers (
    establishment_id, ingredient_id, supplier_id, purchase_unit_id,
    purchase_quantity, purchase_price, currency_code, minimum_order_quantity,
    lead_time_days, is_preferred, is_active, notes
  ) values (
    p_est, p_ingredient_id, p_supplier_id, p_unit_id,
    p_qty, p_price, p_currency, p_min_order, p_lead_time_days,
    coalesce(p_is_preferred, false), true, p_notes
  )
  returning id into v_item;

  insert into public.supplier_price_history (
    establishment_id, ingredient_supplier_id, purchase_price, currency_code,
    purchase_unit_id, purchase_quantity, valid_from, source
  ) values (
    p_est, v_item, p_price, p_currency, p_unit_id, p_qty, now(), 'initial'
  );

  return v_item;
end $$;

-- Swap the current open price of a catalog entry: close the open ledger row,
-- update the catalog row, open a fresh ledger row. All in one transaction.
create or replace function public.record_supplier_price_change(
  p_est uuid,
  p_item_id uuid,
  p_price numeric,
  p_currency text,
  p_unit_id uuid,
  p_qty numeric
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not has_permission(p_est, 'suppliers.update_prices') then
    raise exception using errcode='P0001', message='forbidden';
  end if;

  update public.supplier_price_history
     set valid_until = now()
   where ingredient_supplier_id = p_item_id
     and establishment_id = p_est
     and valid_until is null;

  update public.ingredient_suppliers
     set purchase_price = p_price,
         currency_code = p_currency,
         purchase_unit_id = p_unit_id,
         purchase_quantity = p_qty
   where id = p_item_id
     and establishment_id = p_est;

  insert into public.supplier_price_history (
    establishment_id, ingredient_supplier_id, purchase_price, currency_code,
    purchase_unit_id, purchase_quantity, valid_from, source
  ) values (
    p_est, p_item_id, p_price, p_currency, p_unit_id, p_qty, now(), 'updated'
  );
end $$;

-- Set the single active preferred supplier for an ingredient (DB-atomic).
create or replace function public.set_preferred_supplier(
  p_est uuid,
  p_item_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare v_ingredient uuid;
begin
  if not has_permission(p_est, 'suppliers.manage_catalog') then
    raise exception using errcode='P0001', message='forbidden';
  end if;

  select ingredient_id into v_ingredient
    from public.ingredient_suppliers
   where id = p_item_id
     and establishment_id = p_est
     and is_active;

  if v_ingredient is null then
    raise exception using errcode='P0001', message='ingredient_supplier_not_found';
  end if;

  update public.ingredient_suppliers
     set is_preferred = (id = p_item_id)
   where establishment_id = p_est
     and ingredient_id = v_ingredient
     and is_active;
end $$;

-- ============================================================
-- 8) Permission catalog — module `suppliers` additions
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('suppliers.activate',       'suppliers', 'Activer/désactiver un fournisseur', 'Activer ou désactiver un fournisseur'),
  ('suppliers.manage_catalog', 'suppliers', 'Gérer le catalogue fournisseur',     'Ajouter/retirer des articles au catalogue fournisseur'),
  ('suppliers.view_prices',    'suppliers', 'Voir les prix fournisseur',          'Consulter les prix d''achat et l''historique'),
  ('suppliers.update_prices',  'suppliers', 'Mettre à jour les prix',             'Modifier les prix d''achat et clore les périodes de validité')
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

  -- Super Admin + Admin: full module (contract of migrations 027/045).
  insert into public.role_permissions (role_id, permission_id)
  select v_super_admin, p.id from public.permissions p
   where p.slug in ('suppliers.activate', 'suppliers.manage_catalog',
                    'suppliers.view_prices', 'suppliers.update_prices')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_admin, p.id from public.permissions p
   where p.slug in ('suppliers.activate', 'suppliers.manage_catalog',
                    'suppliers.view_prices', 'suppliers.update_prices')
  on conflict (role_id, permission_id) do nothing;

  -- Manager: full supplier workflow (activate, catalog, prices).
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
   where p.slug in ('suppliers.activate', 'suppliers.manage_catalog',
                    'suppliers.view_prices', 'suppliers.update_prices')
  on conflict (role_id, permission_id) do nothing;

  -- Purchasing: manages suppliers + catalog + prices.
  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id from public.permissions p
   where p.slug in ('suppliers.activate', 'suppliers.manage_catalog',
                    'suppliers.view_prices', 'suppliers.update_prices')
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager: manages the catalog, reads prices (does not edit them).
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id from public.permissions p
   where p.slug in ('suppliers.manage_catalog', 'suppliers.view_prices')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: price visibility for costing/reconciliation only.
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id from public.permissions p
   where p.slug = 'suppliers.view_prices'
  on conflict (role_id, permission_id) do nothing;
end $$;

-- ============================================================
-- 10) Demo data — "Café Fournisseur Tunis" + catalog (spec section 78)
-- ============================================================
do $$
declare
  v_est     uuid := '00000000-0000-0000-0000-000000000001';
  v_sup     uuid;
  v_cafe    uuid;
  v_lait    uuid;
  v_sucre   uuid;
  v_kg      uuid;
  v_l       uuid;
  v_card    uuid;
  v_piece   uuid;
begin
  select id into v_kg    from public.units where establishment_id is null and slug = 'kg';
  select id into v_l     from public.units where establishment_id is null and slug = 'l';
  select id into v_piece from public.units where establishment_id is null and slug = 'pc';

  select id into v_cafe  from public.ingredients where establishment_id = v_est and slug = 'cafe-en-grains';
  select id into v_lait  from public.ingredients where establishment_id = v_est and slug = 'lait';
  select id into v_sucre from public.ingredients where establishment_id = v_est and slug = 'sucre';

  -- "Sucre" carton unit: a 24-bag carton (spec §18 example).
  insert into public.units (establishment_id, name, symbol, slug, type, description, precision, is_base, is_system)
  select v_est, 'Carton de sucre', 'carton', 'carton-sucre', 'piece',
         'Carton de 24 paquets', 0, false, false
    where not exists (
      select 1 from public.units where establishment_id = v_est and slug = 'carton-sucre'
    );

  select id into v_card from public.units where establishment_id = v_est and slug = 'carton-sucre';

  -- 1 carton = 24 pieces (pair stored B = A * factor B := A * 24).
  insert into public.unit_conversions (establishment_id, from_unit_id, to_unit_id, factor, offset_value, description)
  select v_est, v_card, v_piece, 24, 0, '1 carton de sucre = 24 paquets'
    where v_card is not null and v_piece is not null
      and not exists (
        select 1 from public.unit_conversions
         where from_unit_id = v_card and to_unit_id = v_piece
      );

  -- Supplier (code SUP-0001, unique per establishment).
  insert into public.suppliers (
    establishment_id, code, name, legal_name, tax_identifier, registration_number,
    email, phone, mobile, website,
    address_line_1, postal_code, city, country,
    contact_person, contact_email, contact_phone,
    payment_terms, delivery_lead_time_days, minimum_order_amount,
    notes, is_active, is_preferred
  )
  select v_est, 'SUP-0001', 'Café Fournisseur Tunis', 'Café Fournisseur Tunis SARL',
         '0000000/A/A/000/0000', 'MATRICE-0000000',
         'contact@cafetunis.com', '+21670123456', '+21690123456',
         'https://cafetunis.com',
         'Zone industrielle', '1000', 'Tunis', 'Tunisie',
         'Sami Ben Ali', 'sami@cafetunis.com', '+21690123456',
         '30 jours', 2, 0,
         'Fournisseur de référence pour le café.', true, true
    where not exists (
      select 1 from public.suppliers where establishment_id = v_est and code = 'SUP-0001'
    );

  select id into v_sup from public.suppliers where establishment_id = v_est and code = 'SUP-0001';

  -- Catalog + initial price history (spec §78: 70 TND / kg → 0.07 TND/g).
  insert into public.ingredient_suppliers (
    establishment_id, ingredient_id, supplier_id, supplier_sku, purchase_unit_id,
    purchase_quantity, purchase_price, currency_code, minimum_order_quantity,
    lead_time_days, is_preferred, is_active, notes
  )
  select v_est, v_cafe, v_sup, 'SUP-ARABICA-001', v_kg, 1, 70.000, 'TND', 5, 2, true, true,
         'Café arabica en grains torréfiés.'
    where v_sup is not null and v_cafe is not null and v_kg is not null
  on conflict (ingredient_id, supplier_id) do nothing;

  insert into public.ingredient_suppliers (
    establishment_id, ingredient_id, supplier_id, supplier_sku, purchase_unit_id,
    purchase_quantity, purchase_price, currency_code, minimum_order_quantity,
    lead_time_days, is_preferred, is_active, notes
  )
  select v_est, v_lait, v_sup, 'SUP-LAIT-001', v_l, 1, 2.800, 'TND', 10, 1, false, true,
         'Lait entier UHT.'
    where v_sup is not null and v_lait is not null and v_l is not null
  on conflict (ingredient_id, supplier_id) do nothing;

  insert into public.ingredient_suppliers (
    establishment_id, ingredient_id, supplier_id, supplier_sku, purchase_unit_id,
    purchase_quantity, purchase_price, currency_code, minimum_order_quantity,
    lead_time_days, is_preferred, is_active, notes
  )
  select v_est, v_sucre, v_sup, 'SUP-SUCRE-001', v_card, 1, 120.000, 'TND', 1, 3, false, true,
         'Carton de 24 paquets de sucre blanc (120 TND / carton).'
    where v_sup is not null and v_sucre is not null and v_card is not null
  on conflict (ingredient_id, supplier_id) do nothing;

  -- Append-only price history: initial entry for each catalog row.
  insert into public.supplier_price_history (
    establishment_id, ingredient_supplier_id, purchase_price, currency_code,
    purchase_unit_id, purchase_quantity, valid_from, source
  )
  select establishment_id, id, purchase_price, currency_code,
         purchase_unit_id, purchase_quantity, valid_from, 'initial'
    from public.ingredient_suppliers
   where supplier_id = v_sup
     and not exists (
       select 1 from public.supplier_price_history h
       where h.ingredient_supplier_id = ingredient_suppliers.id
     );
end $$;