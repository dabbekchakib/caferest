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
    GENERIC: "authorization.errors.generic",
  };

/** Maps a database constraint message to a stable domain code. */
export const DB_CONSTRAINT_TO_CODE: Record<string, AuthorizationErrorCode> = {
  cannot_change_own_profile_status: "SELF_MODIFICATION",
  system_role_protected: "SYSTEM_ROLE_PROTECTED",
  system_role_modification_protected: "SYSTEM_ROLE_PROTECTED",
  user_roles_role_scope_mismatch: "ROLE_SCOPE",
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