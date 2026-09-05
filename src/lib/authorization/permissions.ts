/**
 * Static permission catalog + default role matrix.
 *
 * The catalog MUST stay in sync with `supabase/migrations/...27_seed_permissions.sql`
 * (slug is the stable key referenced by RLS, code and UI). Keeping a copy in
 * code gives us compile-time safety, testable invariants and enables
 * PermissionGate / matrix UIs without an extra call.
 *
 * Slugs follow `<module>.<action>` and are always snake_case.
 */

export const PERMISSION_MODULES = [
  "dashboard",
  "users",
  "roles",
  "settings",
  "products",
  "categories",
  "ingredients",
  "recipes",
  "inventory",
  "suppliers",
  "purchases",
  "orders",
  "pos",
  "cash_register",
  "customers",
  "reports",
  "notifications",
  "audit",
  "units",
  "unit_conversions",
  "recipe_yields",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_SLUGS = [
  "dashboard.view",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "users.activate",
  "users.deactivate",
  "users.invite",
  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",
  "settings.view",
  "settings.update",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "products.update-price",
  "products.update-status",
  "products.reorder",
  "categories.view",
  "categories.create",
  "categories.update",
  "categories.delete",
  "categories.reorder",
  "ingredients.view",
  "ingredients.create",
  "ingredients.update",
  "ingredients.delete",
  "ingredients.update-cost",
  "ingredients.update-status",
  "ingredients.reorder",
  "recipes.view",
  "recipes.create",
  "recipes.update",
  "recipes.delete",
  "recipes.activate",
  "recipes.archive",
  "recipes.cost-view",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.stocktake",
  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
  "suppliers.delete",
  "purchases.view",
  "purchases.create",
  "purchases.update",
  "purchases.delete",
  "purchases.receive",
  "orders.view",
  "orders.create",
  "orders.update",
  "orders.cancel",
  "pos.access",
  "cash_register.view",
  "cash_register.open",
  "cash_register.close",
  "cash_register.reconcile",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",
  "reports.view",
  "reports.export",
  "notifications.view",
  "audit_logs.view",
  "units.view",
  "units.create",
  "units.update",
  "units.delete",
  "unit_conversions.view",
  "unit_conversions.create",
  "unit_conversions.update",
  "unit_conversions.delete",
  "recipe_yields.view",
  "recipe_yields.create",
  "recipe_yields.update",
  "recipe_yields.delete",
] as const;

export type PermissionSlug = (typeof PERMISSION_SLUGS)[number];

export const ALL_PERMISSION_SLUGS: readonly PermissionSlug[] =
  PERMISSION_SLUGS;

const MODULE_SET = new Set<string>(PERMISSION_MODULES);

export function isPermissionModule(value: string): value is PermissionModule {
  return (MODULE_SET as Set<string>).has(value);
}

export function isPermissionSlug(value: string): value is PermissionSlug {
  return (PERMISSION_SLUGS as readonly string[]).includes(value);
}

/** System role codes seeded by migration 024 (never created from code). */
export const SYSTEM_ROLE_CODES = [
  "super_admin",
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "bar",
  "stock_manager",
  "purchasing",
  "accountant",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

/** Hierarchy level of every seeded role (higher wins; custom roles default 10). */
export const SYSTEM_ROLE_LEVELS: Record<SystemRoleCode, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  stock_manager: 55,
  accountant: 50,
  purchasing: 45,
  cashier: 40,
  waiter: 40,
  kitchen: 40,
  bar: 40,
};

export const DEFAULT_CUSTOM_ROLE_LEVEL = 10;
export const SUPER_ADMIN_CODE = "super_admin";

/**
 * Default permission matrix of the built-in roles (mirrors migration 027).
 * Custom roles have no defaults — the admin grants permissions explicitly.
 */
export const SYSTEM_ROLE_DEFAULT_PERMISSIONS: Record<
  SystemRoleCode,
  readonly PermissionSlug[]
> = {
  super_admin: PERMISSION_SLUGS,
  admin: PERMISSION_SLUGS,
  manager: [
    "dashboard.view",
    "users.view",
    "settings.view",
    "settings.update",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "products.update-price",
    "products.update-status",
    "products.reorder",
    "categories.view",
    "categories.create",
    "categories.update",
    "categories.delete",
    "categories.reorder",
    "ingredients.view",
    "ingredients.create",
    "ingredients.update",
    "ingredients.delete",
    "ingredients.update-cost",
    "ingredients.update-status",
    "ingredients.reorder",
    "recipes.view",
    "recipes.create",
    "recipes.update",
    "recipes.delete",
    "recipes.activate",
    "recipes.archive",
    "recipes.cost-view",
    "inventory.view",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.stocktake",
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "suppliers.delete",
    "purchases.view",
    "purchases.create",
    "purchases.update",
    "purchases.delete",
    "purchases.receive",
    "orders.view",
    "orders.create",
    "orders.update",
    "orders.cancel",
    "pos.access",
    "cash_register.view",
    "cash_register.open",
    "cash_register.close",
    "cash_register.reconcile",
    "customers.view",
    "customers.create",
    "customers.update",
    "customers.delete",
    "reports.view",
    "reports.export",
    "notifications.view",
    "audit_logs.view",
    "units.view",
    "units.create",
    "units.update",
    "units.delete",
    "unit_conversions.view",
    "unit_conversions.create",
    "unit_conversions.update",
    "unit_conversions.delete",
    "recipe_yields.view",
    "recipe_yields.create",
    "recipe_yields.update",
    "recipe_yields.delete",
  ],
  cashier: [
    "dashboard.view",
    "pos.access",
    "orders.view",
    "orders.create",
    "orders.update",
    "customers.view",
    "customers.create",
    "cash_register.view",
    "cash_register.open",
    "cash_register.close",
    "products.view",
    "ingredients.view",
    "notifications.view",
  ],
  waiter: [
    "dashboard.view",
    "pos.access",
    "orders.view",
    "orders.create",
    "orders.update",
    "customers.view",
    "customers.create",
    "products.view",
    "notifications.view",
  ],
  kitchen: [
    "dashboard.view",
    "orders.view",
    "orders.update",
    "products.view",
    "recipes.view",
    "ingredients.view",
    "recipe_yields.view",
    "notifications.view",
  ],
  bar: [
    "dashboard.view",
    "orders.view",
    "orders.update",
    "products.view",
    "recipes.view",
    "ingredients.view",
    "recipe_yields.view",
    "notifications.view",
  ],
  stock_manager: [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "categories.view",
    "ingredients.view",
    "ingredients.create",
    "ingredients.update",
    "ingredients.delete",
    "ingredients.update-cost",
    "ingredients.update-status",
    "ingredients.reorder",
    "recipes.view",
    "recipes.cost-view",
    "inventory.view",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.stocktake",
    "suppliers.view",
    "purchases.view",
    "purchases.create",
    "purchases.update",
    "purchases.delete",
    "purchases.receive",
    "reports.view",
    "notifications.view",
    "units.view",
    "unit_conversions.view",
    "recipe_yields.view",
  ],
  purchasing: [
    "dashboard.view",
    "categories.view",
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "suppliers.delete",
    "purchases.view",
    "purchases.create",
    "purchases.update",
    "purchases.delete",
    "purchases.receive",
    "ingredients.view",
    "products.view",
    "recipes.view",
    "recipes.cost-view",
    "reports.view",
    "notifications.view",
    "units.view",
    "unit_conversions.view",
    "recipe_yields.view",
  ],
  accountant: [
    "dashboard.view",
    "reports.view",
    "reports.export",
    "orders.view",
    "cash_register.view",
    "customers.view",
    "suppliers.view",
    "purchases.view",
    "settings.view",
    "audit_logs.view",
    "products.view",
    "ingredients.view",
    "ingredients.update-cost",
    "recipes.view",
    "recipes.cost-view",
    "recipe_yields.view",
    "notifications.view",
  ],
};

/** Roles that count as "administrator" for the last-admin protection. */
export const ADMIN_ROLE_CODES: readonly string[] = [
  SUPER_ADMIN_CODE,
  "admin",
];

/** Compile-time assertion that every matrix entry references a valid slug. */
export function getPermissionsByModule(): Record<
  PermissionModule,
  readonly PermissionSlug[]
> {
  const byModule: Record<PermissionModule, PermissionSlug[]> =
    Object.fromEntries(
      PERMISSION_MODULES.map((m) => [m, [] as PermissionSlug[]])
    ) as Record<PermissionModule, PermissionSlug[]>;
  for (const slug of PERMISSION_SLUGS) {
    const moduleName = slug.split(".")[0] as PermissionModule;
    if (isPermissionModule(moduleName)) byModule[moduleName].push(slug);
  }
  return byModule;
}

export const PERMISSIONS_BY_MODULE = getPermissionsByModule();