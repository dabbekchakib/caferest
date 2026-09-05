import type { AuthErrorLike } from "./auth-types";

/**
 * i18n keys (relative to the `auth` namespace) for the failures the auth
 * layer understands. Forms translate these keys themselves — this module only
 * decides *which* message applies, mapping Supabase errors to stable keys.
 */
export const AUTH_ERROR_KEYS = {
  generic: "error.generic",
  invalidCredentials: "error.invalidCredentials",
  emailNotConfirmed: "error.emailNotConfirmed",
  tooManyRequests: "error.tooManyRequests",
  network: "error.network",
  unknown: "error.unknown",
  invalidCode: "error.invalidCode",
} as const;

export type AuthErrorKey =
  (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS];

const SUPABASE_CODE_TO_KEY: Record<string, AuthErrorKey | undefined> = {
  invalid_credentials: AUTH_ERROR_KEYS.invalidCredentials,
  email_not_confirmed: AUTH_ERROR_KEYS.emailNotConfirmed,
  over_request_rate_limit: AUTH_ERROR_KEYS.tooManyRequests,
  weak_password: AUTH_ERROR_KEYS.generic,
  user_already_exists: AUTH_ERROR_KEYS.generic,
  user_not_found: AUTH_ERROR_KEYS.generic,
  session_not_found: AUTH_ERROR_KEYS.generic,
  bad_json: AUTH_ERROR_KEYS.unknown,
  "JWT expired": AUTH_ERROR_KEYS.invalidCode,
  invalid_jwt: AUTH_ERROR_KEYS.invalidCode,
  OTP: AUTH_ERROR_KEYS.invalidCode,
  otp_expired: AUTH_ERROR_KEYS.invalidCode,
  validation_failed: AUTH_ERROR_KEYS.generic,
  provider_flow_disabled: AUTH_ERROR_KEYS.generic,
};

const NETWORK_HTTP_CODES = new Set([429, 502, 503, 504]);

/**
 * Map a Supabase auth error to a stable i18n key.
 *
 * Order matters:
 *  1. HTTP/network-flavoured statuses (429/5xx → rate limit / network)
 *  2. Known error codes
 *  3. Generic 4xx validation errors
 *  4. Fallbacks
 */
export function resolveAuthFaultKey(
  error: AuthErrorLike | null | undefined
): AuthErrorKey {
  if (!error) return AUTH_ERROR_KEYS.unknown;

  const status = typeof error.status === "number" ? error.status : 0;

  if (status === 429 || error.code === "over_request_rate_limit") {
    return AUTH_ERROR_KEYS.tooManyRequests;
  }
  if (status === 502 || status === 503 || status === 504) {
    return AUTH_ERROR_KEYS.network;
  }

  const code = error.code?.trim();
  if (code) {
    const byCode = SUPABASE_CODE_TO_KEY[code];
    if (byCode) return byCode;
  }

  if (status >= 400 && status < 500) {
    return AUTH_ERROR_KEYS.invalidCredentials;
  }

  const message = error.message?.toLowerCase() ?? "";
  if (
    message.includes("over_request_rate_limit") ||
    message.includes("rate limit")
  ) {
    return AUTH_ERROR_KEYS.tooManyRequests;
  }
  if (message.includes("invalid login credentials")) {
    return AUTH_ERROR_KEYS.invalidCredentials;
  }
  if (
    message.includes("email not confirmed") ||
    message.includes("confirm your email")
  ) {
    return AUTH_ERROR_KEYS.emailNotConfirmed;
  }

  return AUTH_ERROR_KEYS.generic;
}

/** Return true when the error should be treated as a resumable network issue. */
export function isResumableNetworkError(error: AuthErrorLike | null): boolean {
  if (!error) return false;
  const status = typeof error.status === "number" ? error.status : 0;
  return status === 0 || NETWORK_HTTP_CODES.has(status);
}
