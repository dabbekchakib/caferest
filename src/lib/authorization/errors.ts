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