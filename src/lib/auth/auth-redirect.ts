/**
 * Route constants + open-redirect safe guards for the authentication flow.
 *
 * All client- and server-side redirects must route through the helpers here to
 * guarantee we never bounce users to external or protocol-relative URLs.
 */

export const LOGIN_ROUTE = "/login";
export const FORGOT_PASSWORD_ROUTE = "/forgot-password";
export const RESET_PASSWORD_ROUTE = "/reset-password";
export const ACCOUNT_DISABLED_ROUTE = "/account-disabled";
export const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";

/** Pages that belong to the unauthenticated auth flow. */
export const AUTH_ROUTES: ReadonlySet<string> = new Set([
  LOGIN_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  RESET_PASSWORD_ROUTE,
]);

/** Pages reachable without a session (auth flow + account-disabled). */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  ...AUTH_ROUTES,
  ACCOUNT_DISABLED_ROUTE,
]);

const MAX_REDIRECT_LENGTH = 2048;

/**
 * Accept only safe, same-origin redirect targets.
 * A target must be a relative path starting with a single `/`: this rejects
 * protocol-relative (`//host`), scheme (`https://`, `javascript:`) and other
 * malformed values.
 */
export function isSafeRedirectPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.length > MAX_REDIRECT_LENGTH) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  // Open-redirect + javascript: protections.
  if (value.includes(":") || value.includes("\\")) return false;
  return true;
}

/** Normalize a possibly-malformed redirect target to a safe value. */
export function getSafeRedirect(
  value: string | string[] | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_ROUTE
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isSafeRedirectPath(candidate) ? candidate : fallback;
}

/** Build a login URL carrying an optional safe post-login target. */
export function getSignInUrl(redirect?: string): string {
  if (!isSafeRedirectPath(redirect)) return LOGIN_ROUTE;
  return `${LOGIN_ROUTE}?redirect=${encodeURIComponent(redirect)}`;
}

/** Returns true for paths that should never be treated as private pages. */
export function isPublicPathname(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return pathname.startsWith("/api/");
}
