-- 027_seed_permissions
-- Idempotent seed of the permission catalog, system-role metadata (is_system,
-- level) and the default role -> permissions matrix for the built-in roles.
-- No user accounts are ever created from code (bootstrap is done manually).

-- ============================================================
-- Permission catalog (slug is the stable key referenced in the app)
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  -- dashboard
  ('dashboard.view', 'dashboard', 'Voir le tableau de bord', 'Accès au tableau de bord'),
  -- users
  ('users.view', 'users', 'Voir les utilisateurs', 'Lister et consulter les utilisateurs'),
  ('users.create', 'users', 'Créer un utilisateur', 'Créer ou inviter un utilisateur'),
  ('users.update', 'users', 'Modifier un utilisateur', 'Modifier les informations et les rôles'),
  ('users.delete', 'users', 'Supprimer un utilisateur', 'Supprimer un compte utilisateur'),
  ('users.activate', 'users', 'Activer un utilisateur', 'Réactiver un compte désactivé'),
  ('users.deactivate', 'users', 'Désactiver un utilisateur', 'Désactiver un compte'),
  ('users.invite', 'users', 'Inviter un utilisateur', 'Envoyer une invitation par e-mail'),
  -- roles
  ('roles.view', 'roles', 'Voir les rôles', 'Consulter les rôles et leurs permissions'),
  ('roles.create', 'roles', 'Créer un rôle', 'Créer un rôle personnalisé'),
  ('roles.update', 'roles', 'Modifier un rôle', 'Modifier un rôle et sa matrice de permissions'),
  ('roles.delete', 'roles', 'Supprimer un rôle', 'Supprimer un rôle personnalisé'),
  -- settings
  ('settings.view', 'settings', 'Voir la configuration', 'Consulter les paramètres'),
  ('settings.update', 'settings', 'Modifier la configuration', 'Modifier les paramètres'),
  -- products
  ('products.view', 'products', 'Voir les produits', 'Consulter le catalogue'),
  ('products.create', 'products', 'Créer un produit', 'Créer des produits'),
  ('products.update', 'products', 'Modifier un produit', 'Modifier les produits'),
  ('products.delete', 'products', 'Supprimer un produit', 'Supprimer des produits'),
  -- ingredients
  ('ingredients.view', 'ingredients', 'Voir les ingrédients', 'Consulter la fiche technique'),
  ('ingredients.create', 'ingredients', 'Créer un ingrédient', 'Créer des ingrédients'),
  ('ingredients.update', 'ingredients', 'Modifier un ingrédient', 'Modifier les ingrédients'),
  ('ingredients.delete', 'ingredients', 'Supprimer un ingrédient', 'Supprimer des ingrédients'),
  -- recipes
  ('recipes.view', 'recipes', 'Voir les recettes', 'Consulter les recettes'),
  ('recipes.create', 'recipes', 'Créer une recette', 'Créer des recettes'),
  ('recipes.update', 'recipes', 'Modifier une recette', 'Modifier les recettes'),
  ('recipes.delete', 'recipes', 'Supprimer une recette', 'Supprimer des recettes'),
  -- inventory
  ('inventory.view', 'inventory', 'Voir le stock', 'Consulter les niveaux de stock'),
  ('inventory.adjust', 'inventory', 'Ajuster le stock', 'Réaliser des ajustements'),
  ('inventory.transfer', 'inventory', 'Transférer le stock', 'Effectuer des transferts entre emplacements'),
  ('inventory.stocktake', 'inventory', 'Inventaire', 'Réaliser des inventaires'),
  -- suppliers
  ('suppliers.view', 'suppliers', 'Voir les fournisseurs', 'Consulter les fournisseurs'),
  ('suppliers.create', 'suppliers', 'Créer un fournisseur', 'Créer des fournisseurs'),
  ('suppliers.update', 'suppliers', 'Modifier un fournisseur', 'Modifier les fournisseurs'),
  ('suppliers.delete', 'suppliers', 'Supprimer un fournisseur', 'Supprimer des fournisseurs'),
  -- purchases
  ('purchases.view', 'purchases', 'Voir les achats', 'Consulter les demandes et bons de commande'),
  ('purchases.create', 'purchases', 'Créer un achat', 'Créer demandes et commandes'),
  ('purchases.update', 'purchases', 'Modifier un achat', 'Modifier demandes et commandes'),
  ('purchases.delete', 'purchases', 'Supprimer un achat', 'Supprimer demandes et commandes'),
  ('purchases.receive', 'purchases', 'Réceptionner', 'Réceptionner les commandes'),
  -- orders
  ('orders.view', 'orders', 'Voir les commandes', 'Consulter les commandes'),
  ('orders.create', 'orders', 'Créer une commande', 'Créer des commandes'),
  ('orders.update', 'orders', 'Modifier une commande', 'Modifier les commandes'),
  ('orders.cancel', 'orders', 'Annuler une commande', 'Annuler des commandes'),
  -- pos
  ('pos.access', 'pos', 'Accès caisse', 'Accéder au point de vente'),
  -- cash register
  ('cash_register.view', 'cash_register', 'Voir la caisse', 'Consulter l''état des caisses'),
  ('cash_register.open', 'cash_register', 'Ouvrir une caisse', 'Ouvrir des sessions de caisse'),
  ('cash_register.close', 'cash_register', 'Fermer une caisse', 'Fermer des sessions de caisse'),
  ('cash_register.reconcile', 'cash_register', 'Rapprocher la caisse', 'Rapprocher et valider les sessions'),
  -- customers
  ('customers.view', 'customers', 'Voir les clients', 'Consulter le répertoire clients'),
  ('customers.create', 'customers', 'Créer un client', 'Créer des clients'),
  ('customers.update', 'customers', 'Modifier un client', 'Modifier les clients'),
  ('customers.delete', 'customers', 'Supprimer un client', 'Supprimer des clients'),
  -- reports
  ('reports.view', 'reports', 'Voir les rapports', 'Consulter les rapports'),
  ('reports.export', 'reports', 'Exporter les rapports', 'Exporter les rapports (PDF, CSV...)'),
  -- notifications
  ('notifications.view', 'notifications', 'Voir les notifications', 'Consulter les notifications'),
  -- audit
  ('audit_logs.view', 'audit', 'Voir le journal', 'Consulter le journal d''audit')
on conflict (slug) do nothing;

-- ============================================================
-- System role metadata (is_system, level, active)
-- ============================================================
update public.roles
set is_system = true,
    is_active = true,
    level = case code
      when 'super_admin'   then 100
      when 'admin'         then 80
      when 'manager'       then 60
      when 'stock_manager' then 55
      when 'accountant'    then 50
      when 'purchasing'    then 45
      when 'cashier'       then 40
      when 'waiter'        then 40
      when 'kitchen'       then 40
      when 'bar'           then 40
      else level
    end
where code in ('super_admin', 'admin', 'manager', 'cashier', 'waiter',
               'kitchen', 'bar', 'stock_manager', 'purchasing', 'accountant');

-- ============================================================
-- Default role -> permission matrix
-- ============================================================
do $$
declare
  v_super_admin uuid;
  v_admin uuid;
  v_manager uuid;
  v_cashier uuid;
  v_waiter uuid;
  v_kitchen uuid;
  v_bar uuid;
  v_stock uuid;
  v_purchasing uuid;
  v_accountant uuid;
begin
  select id into v_super_admin from public.roles where code = 'super_admin';
  select id into v_admin        from public.roles where code = 'admin';
  select id into v_manager      from public.roles where code = 'manager';
  select id into v_cashier      from public.roles where code = 'cashier';
  select id into v_waiter       from public.roles where code = 'waiter';
  select id into v_kitchen      from public.roles where code = 'kitchen';
  select id into v_bar          from public.roles where code = 'bar';
  select id into v_stock        from public.roles where code = 'stock_manager';
  select id into v_purchasing   from public.roles where code = 'purchasing';
  select id into v_accountant   from public.roles where code = 'accountant';

  -- Super Admin + Admin: full catalog (hierarchy/RLS still protect system roles).
  insert into public.role_permissions (role_id, permission_id)
  select v_super_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  -- Manager: operational management (no user/role administration).
  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
  where p.slug in (
    'dashboard.view', 'users.view',
    'settings.view', 'settings.update',
    'products.view', 'products.create', 'products.update', 'products.delete',
    'ingredients.view', 'ingredients.create', 'ingredients.update', 'ingredients.delete',
    'recipes.view', 'recipes.create', 'recipes.update', 'recipes.delete',
    'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.stocktake',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete', 'purchases.receive',
    'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
    'pos.access',
    'cash_register.view', 'cash_register.open', 'cash_register.close', 'cash_register.reconcile',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'reports.view', 'reports.export', 'notifications.view', 'audit_logs.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Cashier: sale / caisse, own visibility.
  insert into public.role_permissions (role_id, permission_id)
  select v_cashier, p.id from public.permissions p
  where p.slug in (
    'dashboard.view', 'pos.access',
    'orders.view', 'orders.create', 'orders.update',
    'customers.view', 'customers.create',
    'cash_register.view', 'cash_register.open', 'cash_register.close',
    'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Waiter: order-taking.
  insert into public.role_permissions (role_id, permission_id)
  select v_waiter, p.id from public.permissions p
  where p.slug in (
    'dashboard.view', 'pos.access',
    'orders.view', 'orders.create', 'orders.update',
    'customers.view', 'customers.create',
    'products.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Kitchen: preparation / KDS.
  insert into public.role_permissions (role_id, permission_id)
  select v_kitchen, p.id from public.permissions p
  where p.slug in (
    'dashboard.view', 'orders.view', 'orders.update',
    'products.view', 'recipes.view', 'ingredients.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Bar: preparation bar.
  insert into public.role_permissions (role_id, permission_id)
  select v_bar, p.id from public.permissions p
  where p.slug in (
    'dashboard.view', 'orders.view', 'orders.update',
    'products.view', 'recipes.view', 'ingredients.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Stock manager.
  insert into public.role_permissions (role_id, permission_id)
  select v_stock, p.id from public.permissions p
  where p.slug in (
    'dashboard.view',
    'products.view', 'products.create', 'products.update', 'products.delete',
    'ingredients.view', 'ingredients.create', 'ingredients.update', 'ingredients.delete',
    'recipes.view',
    'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.stocktake',
    'suppliers.view',
    'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete', 'purchases.receive',
    'reports.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Purchasing.
  insert into public.role_permissions (role_id, permission_id)
  select v_purchasing, p.id from public.permissions p
  where p.slug in (
    'dashboard.view',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete', 'purchases.receive',
    'ingredients.view', 'products.view',
    'reports.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Accountant.
  insert into public.role_permissions (role_id, permission_id)
  select v_accountant, p.id from public.permissions p
  where p.slug in (
    'dashboard.view',
    'reports.view', 'reports.export',
    'orders.view', 'cash_register.view',
    'customers.view', 'suppliers.view', 'purchases.view',
    'settings.view', 'audit_logs.view', 'notifications.view'
  )
  on conflict (role_id, permission_id) do nothing;
end $$;