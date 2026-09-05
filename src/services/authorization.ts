import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/auth-utils";
import { DEFAULT_AUTHENTICATED_ROUTE, LOGIN_ROUTE } from "@/lib/auth/auth-redirect";
import { AuthorizationError, isAuthorizationError } from "@/lib/authorization/errors";
import {
  ALL_PERMISSION_SLUGS,
  SUPER_ADMIN_CODE,
} from "@/lib/authorization/permissions";
import {
  canAccess,
  canAccessAll,
  canAccessAny,
  canManageLevel,
  buildPermissionSet,
  maxRoleLevel,
} from "@/lib/authorization/compute";
import type {
  AuthorizationContext,
  AuthorizationEstablishment,
  AuthorizationRole,
} from "@/lib/authorization/types";

/** Cookie holding the user-selected establishment. */
export const CURRENT_ESTABLISHMENT_COOKIE = "NEXT_ESTABLISHMENT";

const SUPER_ADMIN_MAX_LEVEL = 999;

/**
 * Per-request authorization snapshot. Cached with React `cache()` so every
 * server call in the request (layout guards, actions, services) reuses one
 * value.
 *
 * Throws AuthorizationError("UNAUTHORIZED") when there is no session.
 */
export const getAuthorizationContext = cache(
  async (): Promise<AuthorizationContext> => {
    const supabase = await createClient();
    const user = await getServerUser();
    if (!user) throw new AuthorizationError("UNAUTHORIZED");

    const profile = user.user_metadata;
    const { data: memberRows } = await supabase
      .from("establishment_members")
      .select(
        "establishment_id, is_active, establishments(id, name, is_active)"
      )
      .eq("user_id", user.id)
      .eq("is_active", true);

    const memberships: AuthorizationEstablishment[] = [];
    for (const row of memberRows ?? []) {
      const est = Array.isArray(row.establishments)
        ? row.establishments[0]
        : row.establishments;
      if (!est?.is_active) continue;
      memberships.push({
        id: est.id,
        name: est.name,
        isActive: est.is_active,
      });
    }

    const cookieStore = await cookies();
    const preferred = cookieStore.get(CURRENT_ESTABLISHMENT_COOKIE)?.value;
    const current =
      (preferred && memberships.find((m) => m.id === preferred)) ||
      memberships[0] ||
      null;

    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
    const superAdmin = Boolean(isSuperAdmin);

    let roles: AuthorizationRole[] = [];
    let permissionSlugs: string[] = [];
    let level = 0;

    if (current) {
      roles = await resolveRoles(supabase, user.id, current.id);
      if (superAdmin) {
        permissionSlugs = [...ALL_PERMISSION_SLUGS];
        level = SUPER_ADMIN_MAX_LEVEL;
      } else {
        const { data: permissions } = await supabase.rpc(
          "user_get_permissions",
          { p_user_id: user.id, p_est_id: current.id }
        );
        permissionSlugs = permissions ?? [];
        level = maxRoleLevel(roles);
      }
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      fullName:
        typeof profile?.full_name === "string" ? profile.full_name : null,
      isSuperAdmin: superAdmin,
      memberships,
      currentEstablishmentId: current?.id ?? null,
      roles,
      permissionSlugs,
      maxRoleLevel: level,
    };
  }
);

async function resolveRoles(
  supabase: SupabaseClient,
  userId: string,
  establishmentId: string
): Promise<AuthorizationRole[]> {
  const { data: rows } = await supabase
    .from("user_roles")
    .select(
      "role_id, roles(id, code, name, level, is_system, is_active, establishment_id)"
    )
    .eq("user_id", userId)
    .eq("establishment_id", establishmentId);

  const roles: AuthorizationRole[] = [];
  for (const row of rows ?? []) {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    if (!role) continue;
    const next: AuthorizationRole = {
      id: role.id,
      code: role.code,
      name: role.name,
      level: role.level,
      isSystem: role.is_system,
      isActive: role.is_active,
      establishmentId: role.establishment_id,
    };
    roles.push(next);
  }
  return roles;
}

/** Roles held by any user in an establishment (RLS-scoped to the actor). */
export async function getUserRolesInEstablishment(
  userId: string,
  establishmentId: string
): Promise<AuthorizationRole[]> {
  const supabase = await createClient();
  return resolveRoles(supabase, userId, establishmentId);
}

/** Authenticated + active-profile only (mirrors requireAuth without redirects). */
export async function requireAuthenticated(): Promise<AuthorizationContext> {
  return getAuthorizationContext();
}

/** Authorize the current user for a single permission (throws, no redirect). */
export async function requirePermission(
  permission: string
): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (!canAccess(buildPermissionSet(context.permissionSlugs), permission)) {
    throw new AuthorizationError("FORBIDDEN");
  }
  return context;
}

/** Authorize when ANY of the permissions is held. */
export async function requireAnyPermission(
  permissions: readonly string[]
): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (!canAccessAny(buildPermissionSet(context.permissionSlugs), permissions)) {
    throw new AuthorizationError("FORBIDDEN");
  }
  return context;
}

/** Authorize when ALL the permissions are held. */
export async function requireAllPermissions(
  permissions: readonly string[]
): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (
    !canAccessAll(buildPermissionSet(context.permissionSlugs), permissions)
  ) {
    throw new AuthorizationError("FORBIDDEN");
  }
  return context;
}

/** Page-oriented guard: redirects to /login or /dashboard on failure. */
export async function requirePagePermission(
  permission: string
): Promise<AuthorizationContext> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (isAuthorizationError(error)) {
      if (error.code === "UNAUTHORIZED") redirect(LOGIN_ROUTE);
      if (error.code === "FORBIDDEN") redirect(DEFAULT_AUTHENTICATED_ROUTE);
    }
    throw error;
  }
}

/** Boolean variants (false on unauthenticated/disabled, never throw). */
export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const context = await getAuthorizationContext();
    return canAccess(buildPermissionSet(context.permissionSlugs), permission);
  } catch (error) {
    if (isAuthorizationError(error)) return false;
    throw error;
  }
}

export async function hasAnyPermission(
  permissions: readonly string[]
): Promise<boolean> {
  try {
    const context = await getAuthorizationContext();
    return canAccessAny(
      buildPermissionSet(context.permissionSlugs),
      permissions
    );
  } catch (error) {
    if (isAuthorizationError(error)) return false;
    throw error;
  }
}

export async function hasAllPermissions(
  permissions: readonly string[]
): Promise<boolean> {
  try {
    const context = await getAuthorizationContext();
    return canAccessAll(
      buildPermissionSet(context.permissionSlugs),
      permissions
    );
  } catch (error) {
    if (isAuthorizationError(error)) return false;
    throw error;
  }
}

/** The establishment the user operates in (or INVALID_ESTABLISHMENT). */
export async function requireCurrentEstablishment(): Promise<string> {
  const context = await getAuthorizationContext();
  if (!context.currentEstablishmentId) {
    throw new AuthorizationError("INVALID_ESTABLISHMENT");
  }
  return context.currentEstablishmentId;
}

/** True when the user may manage a target role (level strictly lower). */
export async function userCanManageRole(
  targetLevel: number
): Promise<boolean> {
  const context = await getAuthorizationContext();
  return context.isSuperAdmin || canManageLevel(context.maxRoleLevel, targetLevel);
}

/** Guard for role-level operations (throws ROLE_HIERARCHY). */
export async function assertManageableLevel(
  targetLevel: number
): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (!context.isSuperAdmin && !canManageLevel(context.maxRoleLevel, targetLevel)) {
    throw new AuthorizationError("ROLE_HIERARCHY");
  }
  return context;
}

/**
 * Last-admin protection: fails when removing/editing the (only) active
 * administrator of an establishment.
 */
export async function assertActiveAdminExists(
  establishmentId: string,
  excludeUserId: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("user_count_active_admins", {
    p_est_id: establishmentId,
    p_exclude_user_id: excludeUserId,
  });
  if (error || Number(data ?? 0) <= 0) {
    throw new AuthorizationError("LAST_ADMIN", undefined, { cause: error });
  }
}

/**
 * Guard for user-level operations (status changes, deletion, role edits): the
 * actor must not operate on themselves and must outrank every role the target
 * holds in the establishment.
 */
export async function assertUserManageable(
  establishmentId: string,
  targetUserId: string
): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (context.isSuperAdmin) return context;
  if (targetUserId === context.userId) {
    throw new AuthorizationError("SELF_MODIFICATION");
  }
  const targetRoles = await getUserRolesInEstablishment(
    targetUserId,
    establishmentId
  );
  const targetMax = maxRoleLevel(targetRoles);
  if (!canManageLevel(context.maxRoleLevel, targetMax)) {
    throw new AuthorizationError("ROLE_HIERARCHY");
  }
  return context;
}

export type { AuthorizationContext };
export { SUPER_ADMIN_CODE };