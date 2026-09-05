"use client";

import { useContext } from "react";
import { AuthorizationContext } from "@/components/providers/authorization-context";
import {
  canAccess,
  canAccessAll,
  canAccessAny,
  buildPermissionSet,
} from "@/lib/authorization/compute";
import type { AuthorizationContext as AuthorizationContextType } from "@/lib/authorization/types";

/**
 * Client-side authorization helper. One snapshot is shared for the whole
 * request; use `can`/`canAny`/`canAll` only to decide UI affordances. The
 * server still enforces every write via `requirePermission`.
 */
export function useAuthorization() {
  const context = useContext(AuthorizationContext);
  const permissions = buildPermissionSet(context.permissionSlugs);

  return {
    context,
    can: (permission: string): boolean => canAccess(permissions, permission),
    canAny: (permissionSlugs: readonly string[]): boolean =>
      canAccessAny(permissions, permissionSlugs),
    canAll: (permissionSlugs: readonly string[]): boolean =>
      canAccessAll(permissions, permissionSlugs),
    isSuperAdmin: context.isSuperAdmin,
    currentEstablishmentId: context.currentEstablishmentId,
    memberships: context.memberships,
  };
}

export type UseAuthorizationResult = ReturnType<typeof useAuthorization>;

export type { AuthorizationContextType };