-- 023_rls
-- Enable Row Level Security + policies on all business tables.
-- Central rule: a user may access a row iff they are a member of the row's
-- establishment (or a global super_admin). Never USING (true) on business data.

alter table public.establishments enable row level security;
alter table public.establishment_members enable row level security;
alter table public.settings enable row level security;
alter table public.locales enable row level security;
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.categories enable row level security;
alter table public.taxes enable row level security;
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.recipe_yields enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.dining_areas enable row level security;
alter table public.tables enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- establishments
-- Super admins manage all; members can read their own establishment.
-- ============================================================
create policy "establishments_public_read" on public.establishments
  for select using (true); -- only metadata, read is safe (id/name)
create policy "establishments_admin_write" on public.establishments
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- establishment_members
-- Users can read/manage their own membership; conflicts managed server-side.
-- ============================================================
create policy "establishment_members_self_read" on public.establishment_members
  for select using (user_id = auth.uid() or is_super_admin());
create policy "establishment_members_admin_write" on public.establishment_members
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- settings
-- Members manage settings of their establishment; public settings readable.
-- ============================================================
create policy "settings_read" on public.settings
  for select using (is_public or belongs_to_establishment(establishment_id));
create policy "settings_write" on public.settings
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- locales (global reference, read-only for all authenticated)
-- ============================================================
create policy "locales_read" on public.locales
  for select using (is_active or is_super_admin());
create policy "locales_admin_write" on public.locales
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- units / unit_conversions
-- ============================================================
create policy "units_read" on public.units
  for select using (belongs_to_establishment(establishment_id));
create policy "units_write" on public.units
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "unit_conversions_read" on public.unit_conversions
  for select using (
    exists (
      select 1 from public.units u
      where u.id in (from_unit_id, to_unit_id)
        and belongs_to_establishment(u.establishment_id)
    )
  );
create policy "unit_conversions_write" on public.unit_conversions
  for all using (
    exists (
      select 1 from public.units u
      where (u.id = from_unit_id or u.id = to_unit_id)
        and belongs_to_establishment(u.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- categories / taxes / products / ingredients (per establishment)
-- ============================================================
create policy "categories_read" on public.categories
  for select using (belongs_to_establishment(establishment_id));
create policy "categories_write" on public.categories
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "taxes_read" on public.taxes
  for select using (belongs_to_establishment(establishment_id));
create policy "taxes_write" on public.taxes
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "products_read" on public.products
  for select using (belongs_to_establishment(establishment_id));
create policy "products_write" on public.products
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "ingredients_read" on public.ingredients
  for select using (belongs_to_establishment(establishment_id));
create policy "ingredients_write" on public.ingredients
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- recipes / recipe_items / recipe_yields
-- ============================================================
create policy "recipes_read" on public.recipes
  for select using (belongs_to_establishment(establishment_id));
create policy "recipes_write" on public.recipes
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "recipe_items_read" on public.recipe_items
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and belongs_to_establishment(r.establishment_id)
    )
  );
create policy "recipe_items_write" on public.recipe_items
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and belongs_to_establishment(r.establishment_id)
    )
  ) with check (true);

create policy "recipe_yields_read" on public.recipe_yields
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and belongs_to_establishment(r.establishment_id)
    )
  );
create policy "recipe_yields_write" on public.recipe_yields
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and belongs_to_establishment(r.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- suppliers / purchase_orders / purchase_order_items
-- ============================================================
create policy "suppliers_read" on public.suppliers
  for select using (belongs_to_establishment(establishment_id));
create policy "suppliers_write" on public.suppliers
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "purchase_orders_read" on public.purchase_orders
  for select using (belongs_to_establishment(establishment_id));
create policy "purchase_orders_write" on public.purchase_orders
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "purchase_order_items_read" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id and belongs_to_establishment(po.establishment_id)
    )
  );
create policy "purchase_order_items_write" on public.purchase_order_items
  for all using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id and belongs_to_establishment(po.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- inventory
-- ============================================================
create policy "inventory_locations_read" on public.inventory_locations
  for select using (belongs_to_establishment(establishment_id));
create policy "inventory_locations_write" on public.inventory_locations
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "stock_items_read" on public.stock_items
  for select using (belongs_to_establishment(establishment_id));
create policy "stock_items_write" on public.stock_items
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "stock_movements_read" on public.stock_movements
  for select using (belongs_to_establishment(establishment_id));
create policy "stock_movements_write" on public.stock_movements
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- profiles (own profile only) + roles + user_roles
-- ============================================================
create policy "profiles_own_read" on public.profiles
  for select using (id = auth.uid() or is_super_admin());
create policy "profiles_own_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "roles_read" on public.roles
  for select using (true); -- global reference, non-sensitive
create policy "roles_admin_write" on public.roles
  for all using (is_super_admin()) with check (is_super_admin());

create policy "user_roles_read" on public.user_roles
  for select using (user_id = auth.uid() or is_super_admin()
    or is_establishment_member(establishment_id));
create policy "user_roles_admin_write" on public.user_roles
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- dining_areas / tables
-- ============================================================
create policy "dining_areas_read" on public.dining_areas
  for select using (belongs_to_establishment(establishment_id));
create policy "dining_areas_write" on public.dining_areas
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "tables_read" on public.tables
  for select using (belongs_to_establishment(establishment_id));
create policy "tables_write" on public.tables
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- customers
-- ============================================================
create policy "customers_read" on public.customers
  for select using (belongs_to_establishment(establishment_id));
create policy "customers_write" on public.customers
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- orders / order_items
-- ============================================================
create policy "orders_read" on public.orders
  for select using (belongs_to_establishment(establishment_id)
    or user_id = auth.uid());
create policy "orders_write" on public.orders
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "order_items_read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (belongs_to_establishment(o.establishment_id) or o.user_id = auth.uid())
    )
  );
create policy "order_items_write" on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and belongs_to_establishment(o.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- payment_methods / payments
-- ============================================================
create policy "payment_methods_read" on public.payment_methods
  for select using (belongs_to_establishment(establishment_id));
create policy "payment_methods_write" on public.payment_methods
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "payments_read" on public.payments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (belongs_to_establishment(o.establishment_id) or o.user_id = auth.uid())
    )
  );
create policy "payments_write" on public.payments
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and belongs_to_establishment(o.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- cash_registers / cash_sessions
-- ============================================================
create policy "cash_registers_read" on public.cash_registers
  for select using (belongs_to_establishment(establishment_id));
create policy "cash_registers_write" on public.cash_registers
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

create policy "cash_sessions_read" on public.cash_sessions
  for select using (
    exists (
      select 1 from public.cash_registers cr
      where cr.id = cash_register_id and (belongs_to_establishment(cr.establishment_id) or user_id = auth.uid())
    )
  );
create policy "cash_sessions_write" on public.cash_sessions
  for all using (
    exists (
      select 1 from public.cash_registers cr
      where cr.id = cash_register_id and belongs_to_establishment(cr.establishment_id)
    )
  ) with check (true);

-- ============================================================
-- expenses
-- ============================================================
create policy "expenses_read" on public.expenses
  for select using (belongs_to_establishment(establishment_id));
create policy "expenses_write" on public.expenses
  for all using (belongs_to_establishment(establishment_id))
  with check (belongs_to_establishment(establishment_id));

-- ============================================================
-- notifications (own notifications only)
-- ============================================================
create policy "notifications_read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert with check (user_id = auth.uid());

-- ============================================================
-- audit_logs (members can read own establishment logs; only service/super-admin writes)
-- ============================================================
create policy "audit_logs_read" on public.audit_logs
  for select using (belongs_to_establishment(establishment_id) or is_super_admin());
create policy "audit_logs_superadmin_write" on public.audit_logs
  for insert with check (is_super_admin());
