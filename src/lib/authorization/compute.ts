/**
 * Pure permission-set helpers (no I/O).
 *
 * The service layer builds one "effective" set per request — the user's
 * granted slugs, extended to the full catalog when they are a super admin —
 * and every page/action decision funnels through these functions. Keeping them
 * pure makes the matrix logic unit-testable without Supabase.
 *
 * Deny-by-default: an unknown slug or an empty set means "no access".
 */
import type { PermissionSlug } from "./permissions";

export type PermissionSet = ReadonlySet<string>;

export function buildPermissionSet(
  granted: readonly string[],
  options?: { extra?: readonly string[] }
): PermissionSet {
  const set = new Set(granted);
  for (const slug of options?.extra ?? []) set.add(slug);
  return set;
}

export function canAccess(
  permissions: PermissionSet,
  permission: string
): boolean {
  if (!permission) return false;
  return permissions.has(permission);
}

export function canAccessAny(
  permissions: PermissionSet,
  permissionSlugs: readonly string[]
): boolean {
  return permissionSlugs.some((slug) => canAccess(permissions, slug));
}

export function canAccessAll(
  permissions: PermissionSet,
  permissionSlugs: readonly string[]
): boolean {
  return permissionSlugs.every((slug) => canAccess(permissions, slug));
}

/** Merge several role matrices into one effective set. */
export function mergeRoles(
  matrices: ReadonlyArray<readonly PermissionSlug[] | readonly string[]>
): PermissionSet {
  const set = new Set<string>();
  for (const matrix of matrices) for (const slug of matrix) set.add(slug);
  return set;
}

/** Highest role hierarchy level in a list of roles (0 when none). */
export function maxRoleLevel(
  roles: ReadonlyArray<{ level: number }>
): number {
  return roles.reduce((max, role) => Math.max(max, role.level), 0);
}

/** A user may act on a role only when their level is strictly higher. */
export function canManageLevel(actorLevel: number, targetLevel: number): boolean {
  return actorLevel > targetLevel;
}