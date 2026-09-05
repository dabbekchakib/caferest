/**
 * Authorization domain errors with stable i18n keys.
 *
 * Server actions and pages translate these keys themselves (namespace
 * `authorization`) — this module only decides *which* message applies.
 */

export const AUTHORIZATION_ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_ESTABLISHMENT: "INVALID_ESTABLISHMENT",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  LAST_ADMIN: "LAST_ADMIN",
  SYSTEM_ROLE_PROTECTED: "SYSTEM_ROLE_PROTECTED",
  SELF_MODIFICATION: "SELF_MODIFICATION",
  ROLE_HIERARCHY: "ROLE_HIERARCHY",
  ROLE_SCOPE: "ROLE_SCOPE",
  SYSTEM_UNIT_PROTECTED: "SYSTEM_UNIT_PROTECTED",
  UNIT_SCOPE: "UNIT_SCOPE",
  INCOMPATIBLE_UNITS: "INCOMPATIBLE_UNITS",
  UNIT_IN_USE: "UNIT_IN_USE",
  DUPLICATE_UNIT: "DUPLICATE_UNIT",
  SYSTEM_CATEGORY_PROTECTED: "SYSTEM_CATEGORY_PROTECTED",
  CATEGORY_CYCLE: "CATEGORY_CYCLE",
  CATEGORY_HAS_CHILDREN: "CATEGORY_HAS_CHILDREN",
  CATEGORY_IN_USE: "CATEGORY_IN_USE",
  DUPLICATE_SLUG: "DUPLICATE_SLUG",
  SYSTEM_PRODUCT_PROTECTED: "SYSTEM_PRODUCT_PROTECTED",
  PRODUCT_SLUG_EXISTS: "PRODUCT_SLUG_EXISTS",
  DUPLICATE_SKU: "DUPLICATE_SKU",
  DUPLICATE_BARCODE: "DUPLICATE_BARCODE",
  PRODUCT_IN_USE: "PRODUCT_IN_USE",
  SYSTEM_INGREDIENT_PROTECTED: "SYSTEM_INGREDIENT_PROTECTED",
  INGREDIENT_SLUG_EXISTS: "INGREDIENT_SLUG_EXISTS",
  INGREDIENT_IN_USE: "INGREDIENT_IN_USE",
  SYSTEM_RECIPE_PROTECTED: "SYSTEM_RECIPE_PROTECTED",
  RECIPE_EMPTY: "RECIPE_EMPTY",
  RECIPE_ACTIVE_REQUIRED: "RECIPE_ACTIVE_REQUIRED",
  RECIPE_CYCLE: "RECIPE_CYCLE",
  RECIPE_INVALID_ITEM: "RECIPE_INVALID_ITEM",
  RECIPE_DEFAULT_UNIQUE: "RECIPE_DEFAULT_UNIQUE",
  RECIPE_VERSION_EXISTS: "RECIPE_VERSION_EXISTS",
  RECIPE_YIELD_NOT_FOUND: "RECIPE_YIELD_NOT_FOUND",
  YIELD_INVALID: "YIELD_INVALID",
  YIELD_RANGE_ORDER: "YIELD_RANGE_ORDER",
  YIELD_UNITS_INCOMPATIBLE: "YIELD_UNITS_INCOMPATIBLE",
  YIELD_PERCENTAGE_INVALID: "YIELD_PERCENTAGE_INVALID",
  YIELD_MODEL_INCOMPLETE: "YIELD_MODEL_INCOMPLETE",
  SUPPLIER_NOT_FOUND: "SUPPLIER_NOT_FOUND",
  SUPPLIER_IN_USE: "SUPPLIER_IN_USE",
  SUPPLIER_DUPLICATE_CODE: "SUPPLIER_DUPLICATE_CODE",
  SUPPLIER_NO_CATALOG: "SUPPLIER_NO_CATALOG",
  SUPPLIER_CONTACT_INVALID: "SUPPLIER_CONTACT_INVALID",
  INGREDIENT_SUPPLIER_DUPLICATE: "INGREDIENT_SUPPLIER_DUPLICATE",
  INGREDIENT_SUPPLIER_NOREFS: "INGREDIENT_SUPPLIER_NOREFS",
  CROSS_ESTABLISHMENT_REFERENCE: "CROSS_ESTABLISHMENT_REFERENCE",
  CURRENCY_REQUIRED: "CURRENCY_REQUIRED",
  GENERIC: "GENERIC",
} as const;

export type AuthorizationErrorCode =
  (typeof AUTHORIZATION_ERROR_CODES)[keyof typeof AUTHORIZATION_ERROR_CODES];

export const AUTHORIZATION_ERROR_KEYS: Record<AuthorizationErrorCode, string> =
  {
    UNAUTHENTICATED: "authorization.errors.unauthorized",
    UNAUTHORIZED: "authorization.errors.unauthorized",
    FORBIDDEN: "authorization.errors.forbidden",
    INVALID_ESTABLISHMENT: "authorization.errors.invalidEstablishment",
    ACCOUNT_DISABLED: "authorization.errors.accountDisabled",
    RESOURCE_NOT_FOUND: "authorization.errors.notFound",
    LAST_ADMIN: "authorization.errors.lastAdmin",
    SYSTEM_ROLE_PROTECTED: "authorization.errors.systemRole",
    SELF_MODIFICATION: "authorization.errors.selfModification",
    ROLE_HIERARCHY: "authorization.errors.roleHierarchy",
    ROLE_SCOPE: "authorization.errors.roleScope",
    SYSTEM_UNIT_PROTECTED: "authorization.errors.systemUnit",
    UNIT_SCOPE: "authorization.errors.unitScope",
    INCOMPATIBLE_UNITS: "authorization.errors.unitConversion",
    UNIT_IN_USE: "authorization.errors.unitInUse",
    DUPLICATE_UNIT: "authorization.errors.duplicateUnit",
    SYSTEM_CATEGORY_PROTECTED: "authorization.errors.systemCategory",
    CATEGORY_CYCLE: "authorization.errors.categoryCycle",
    CATEGORY_HAS_CHILDREN: "authorization.errors.categoryHasChildren",
    CATEGORY_IN_USE: "authorization.errors.categoryInUse",
    DUPLICATE_SLUG: "authorization.errors.categorySlugExists",
    SYSTEM_PRODUCT_PROTECTED: "authorization.errors.systemProduct",
    PRODUCT_SLUG_EXISTS: "authorization.errors.productSlugExists",
    DUPLICATE_SKU: "authorization.errors.duplicateSku",
    DUPLICATE_BARCODE: "authorization.errors.duplicateBarcode",
    PRODUCT_IN_USE: "authorization.errors.productInUse",
    SYSTEM_INGREDIENT_PROTECTED: "authorization.errors.systemIngredient",
    INGREDIENT_SLUG_EXISTS: "authorization.errors.ingredientSlugExists",
    INGREDIENT_IN_USE: "authorization.errors.ingredientInUse",
    SYSTEM_RECIPE_PROTECTED: "authorization.errors.systemRecipe",
    RECIPE_EMPTY: "authorization.errors.recipeEmpty",
    RECIPE_ACTIVE_REQUIRED: "authorization.errors.recipeActiveRequired",
    RECIPE_CYCLE: "authorization.errors.recipeCycle",
    RECIPE_INVALID_ITEM: "authorization.errors.recipeInvalidItem",
    RECIPE_DEFAULT_UNIQUE: "authorization.errors.recipeDefaultUnique",
    RECIPE_VERSION_EXISTS: "authorization.errors.recipeVersionExists",
    RECIPE_YIELD_NOT_FOUND: "authorization.errors.recipeYieldNotFound",
    YIELD_INVALID: "authorization.errors.yieldInvalid",
    YIELD_RANGE_ORDER: "authorization.errors.yieldRangeOrder",
    YIELD_UNITS_INCOMPATIBLE: "authorization.errors.yieldUnitsIncompatible",
    YIELD_PERCENTAGE_INVALID: "authorization.errors.yieldPercentageInvalid",
    YIELD_MODEL_INCOMPLETE: "authorization.errors.yieldModelIncomplete",
    SUPPLIER_NOT_FOUND: "authorization.errors.supplierNotFound",
    SUPPLIER_IN_USE: "authorization.errors.supplierInUse",
    SUPPLIER_DUPLICATE_CODE: "authorization.errors.supplierDuplicateCode",
    SUPPLIER_NO_CATALOG: "authorization.errors.supplierNoCatalog",
    SUPPLIER_CONTACT_INVALID: "authorization.errors.supplierContactInvalid",
    INGREDIENT_SUPPLIER_DUPLICATE:
      "authorization.errors.ingredientSupplierDuplicate",
    INGREDIENT_SUPPLIER_NOREFS: "authorization.errors.ingredientSupplierNoRefs",
    CROSS_ESTABLISHMENT_REFERENCE: "authorization.errors.crossEstablishment",
    CURRENCY_REQUIRED: "authorization.errors.currencyRequired",
    GENERIC: "authorization.errors.generic",
  };

/** Maps a database constraint message to a stable domain code. */
export const DB_CONSTRAINT_TO_CODE: Record<string, AuthorizationErrorCode> = {
  cannot_change_own_profile_status: "SELF_MODIFICATION",
  system_role_protected: "SYSTEM_ROLE_PROTECTED",
  system_role_modification_protected: "SYSTEM_ROLE_PROTECTED",
  user_roles_role_scope_mismatch: "ROLE_SCOPE",
  system_unit_protected: "SYSTEM_UNIT_PROTECTED",
  unit_conversion_scope_mismatch: "UNIT_SCOPE",
  category_cycle: "CATEGORY_CYCLE",
  system_category_protected: "SYSTEM_CATEGORY_PROTECTED",
  system_product_protected: "SYSTEM_PRODUCT_PROTECTED",
  products_establishment_sku_key: "DUPLICATE_SKU",
  products_establishment_barcode_key: "DUPLICATE_BARCODE",
  products_establishment_slug_key: "PRODUCT_SLUG_EXISTS",
  uq_ingredients_establishment_sku: "DUPLICATE_SKU",
  ingredients_establishment_sku_key: "DUPLICATE_SKU",
  uq_ingredients_establishment_barcode: "DUPLICATE_BARCODE",
  ingredients_establishment_barcode_key: "DUPLICATE_BARCODE",
  uq_ingredients_establishment_slug: "INGREDIENT_SLUG_EXISTS",
  ingredients_establishment_slug_key: "INGREDIENT_SLUG_EXISTS",
  system_ingredient_protected: "SYSTEM_INGREDIENT_PROTECTED",
  system_recipe_protected: "SYSTEM_RECIPE_PROTECTED",
  recipe_items_reference_xor: "RECIPE_INVALID_ITEM",
  recipe_items_quantity_check: "RECIPE_INVALID_ITEM",
  recipe_items_waste_check: "RECIPE_INVALID_ITEM",
  uq_recipes_default_per_product: "RECIPE_DEFAULT_UNIQUE",
  uq_recipes_establishment_product_version: "RECIPE_VERSION_EXISTS",
  recipe_yields_recipe_id_key: "RECIPE_YIELD_NOT_FOUND",
  recipe_yields_unique_recipe: "RECIPE_YIELD_NOT_FOUND",
  recipe_yields_yield_type_check: "YIELD_INVALID",
  recipe_yields_input_check: "YIELD_INVALID",
  recipe_yields_output_check: "YIELD_INVALID",
  recipe_yields_standard_check: "YIELD_MODEL_INCOMPLETE",
  recipe_yields_percentage_check: "YIELD_PERCENTAGE_INVALID",
  recipe_yields_order_check: "YIELD_RANGE_ORDER",
  recipe_yields_standard_range_check: "YIELD_RANGE_ORDER",
  uq_suppliers_establishment_code: "SUPPLIER_DUPLICATE_CODE",
  uq_supplier_contacts_active_primary: "SUPPLIER_CONTACT_INVALID",
  uq_ingredient_suppliers_item: "INGREDIENT_SUPPLIER_DUPLICATE",
  uq_ingredient_suppliers_preferred: "SUPPLIER_CONTACT_INVALID",
  ingredient_suppliers_quantity_check: "INGREDIENT_SUPPLIER_NOREFS",
  ingredient_suppliers_price_check: "INGREDIENT_SUPPLIER_NOREFS",
  supplier_price_history_price_check: "INGREDIENT_SUPPLIER_NOREFS",
  supplier_price_history_quantity_check: "INGREDIENT_SUPPLIER_NOREFS",
};

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(
    code: AuthorizationErrorCode,
    message?: string,
    options?: ErrorOptions
  ) {
    super(message ?? code, options);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function isAuthorizationError(
  error: unknown
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function toAuthorizationError(error: unknown): AuthorizationError {
  if (error instanceof AuthorizationError) return error;

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (message) {
    const code =
      DB_CONSTRAINT_TO_CODE[message] ?? DB_CONSTRAINT_TO_CODE[message.trim()];
    if (code) return new AuthorizationError(code, message);
  }

  return new AuthorizationError("GENERIC");
}

/** Stable i18n message key for an error code. */
export function authorizationErrorKey(
  code: AuthorizationErrorCode
): string {
  return AUTHORIZATION_ERROR_KEYS[code];
}