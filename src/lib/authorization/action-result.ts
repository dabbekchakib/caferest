import {
  authorizationErrorKey,
  isAuthorizationError,
} from "./errors";

/**
 * Result shape for server actions that mutate state.
 *
 * On failure we return a stable error code + i18n key (namespace
 * `authorization`) instead of throwing, so client components can show a
 * localized toast/inline error.
 */
export type ActionResult<TData = undefined> =
  | { ok: true; data: TData }
  | { ok: false; code: string; key: string };

export function ok<TData>(data: TData): ActionResult<TData> {
  return { ok: true, data };
}

export function okVoid(): ActionResult<undefined> {
  return { ok: true, data: undefined };
}

export function fail(error: unknown): ActionResult<never> {
  if (isAuthorizationError(error)) {
    return {
      ok: false,
      code: error.code,
      key: authorizationErrorKey(error.code),
    };
  }
  return { ok: false, code: "GENERIC", key: authorizationErrorKey("GENERIC") };
}