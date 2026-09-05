import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import { SYSTEM_ROLE_CODES } from "@/lib/authorization/permissions";
import type {
  RoleCard,
  UserRoleAssignment,
} from "@/lib/authorization/types";
import {
  requirePermission,
  requireAnyPermission,
  assertManageableLevel,
  assertActiveAdminExists,
} from "./authorization";
import {
  ADMIN_ROLE_CODES,
} from "@/lib/authorization/permissions";

export interface RoleInput {
  name: string;
  code: string;
  description?: string | null;
  level?: number;
  establishmentId: string;
}

export interface RoleUpdateInput {
  name?: string;
  description?: string | null;
  level?: number;
  isActive?: boolean;
}

interface RoleWithCounts {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  level: number;
  establishment_id: string | null;
  role_permissions: { id: string }[];
  user_roles: { user_id: string }[];
}

/** Roles visible in an establishment (system + custom, RLS-scoped read). */
export async function listRoles(
  establishmentId: string
): Promise<RoleCard[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("roles")
    .select(
      `id, name, code, description, is_system, is_active, level, establishment_id,
       role_permissions(id),
       user_roles(user_id)`
    )
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`);

  if (error) {
    throw new AuthorizationError("GENERIC", error.message);
  }

  const rows = (data ?? []) as unknown as RoleWithCounts[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    isSystem: r.is_system,
    isActive: r.is_active,
    level: r.level,
    establishmentId: r.establishment_id,
    permissionCount: r.role_permissions?.length ?? 0,
    userCount: new Set((r.user_roles ?? []).map((u) => u.user_id)).size,
  }));
}

export async function getRole(
  establishmentId: string,
  roleId: string
): Promise<RoleCard | null> {
  const roles = await listRoles(establishmentId);
  return roles.find((r) => r.id === roleId) ?? null;
}

/** Create a custom (establishment-scoped) role. */
export async function createRole(input: RoleInput): Promise<{ id: string }> {
  await requirePermission("roles.create");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("roles")
    .insert({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      level: input.level ?? 10,
      is_system: false,
      is_active: true,
      establishment_id: input.establishmentId,
    })
    .select("id")
    .single();

  if (error) {
    throw new AuthorizationError("GENERIC", error.message);
  }
  return { id: data.id };
}

/** Update a custom role (system roles are immutable except via super admin SQL). */
export async function updateRole(
  establishmentId: string,
  roleId: string,
  input: RoleUpdateInput
): Promise<void> {
  await requirePermission("roles.update");
  const existing = await getRole(establishmentId, roleId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.isSystem) throw new AuthorizationError("SYSTEM_ROLE_PROTECTED");

  const targetLevel = input.level ?? existing.level;
  await assertManageableLevel(Math.max(existing.level, targetLevel));

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq("id", roleId)
    .eq("establishment_id", establishmentId);

  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Duplicate a role (copy name/code/level + full permission set). */
export async function duplicateRole(input: {
  sourceRoleId: string;
  establishmentId: string;
  name: string;
  code: string;
}): Promise<{ id: string }> {
  await requirePermission("roles.create");
  const existing = await getRole(input.establishmentId, input.sourceRoleId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  await assertManageableLevel(existing.level);

  const supabase = await createClient();
  const { data: created, error: createError } = await supabase
    .from("roles")
    .insert({
      name: input.name,
      code: input.code,
      description: existing.description,
      level: existing.level,
      is_system: false,
      is_active: true,
      establishment_id: input.establishmentId,
    })
    .select("id")
    .single();
  if (createError) throw new AuthorizationError("GENERIC", createError.message);

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", input.sourceRoleId);
  if (perms && perms.length > 0) {
    const { error: insertError } = await supabase.from("role_permissions").insert(
      perms.map((p) => ({
        role_id: created.id,
        permission_id: p.permission_id,
      }))
    );
    if (insertError) throw new AuthorizationError("GENERIC", insertError.message);
  }

  return { id: created.id };
}

/** Toggle a custom role's active flag. */
export async function setRoleStatus(
  establishmentId: string,
  roleId: string,
  isActive: boolean
): Promise<void> {
  await requirePermission("roles.update");
  const existing = await getRole(establishmentId, roleId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.isSystem) throw new AuthorizationError("SYSTEM_ROLE_PROTECTED");
  await assertManageableLevel(existing.level);

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ is_active: isActive })
    .eq("id", roleId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Delete a custom role (assignment rows cascade). */
export async function deleteRole(
  establishmentId: string,
  roleId: string
): Promise<void> {
  await requirePermission("roles.delete");
  const existing = await getRole(establishmentId, roleId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.isSystem) throw new AuthorizationError("SYSTEM_ROLE_PROTECTED");
  await assertManageableLevel(existing.level);

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Current permission ids of a role (requires users.view/roles.view anywhere). */
export async function getRolePermissionIds(roleId: string): Promise<string[]> {
  await requireAnyPermission(["roles.view", "roles.update", "users.view"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []).map((d) => d.permission_id);
}

/** Replace the permission set of a role. */
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  await requirePermission("roles.update");
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("role_permissions")
    .select("id, permission_id")
    .eq("role_id", roleId);
  if (readError) throw new AuthorizationError("GENERIC", readError.message);

  const existingIds = new Set((existing ?? []).map((e) => e.permission_id));
  const requested = new Set(permissionIds);

  const toRemove = (existing ?? []).filter((e) => !requested.has(e.permission_id));
  const toAdd = permissionIds.filter((id) => !existingIds.has(id));

  if (toRemove.length > 0) {
    const ids = toRemove.map((e) => e.id);
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .in("id", ids);
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from("role_permissions").insert(
      toAdd.map((permission_id) => ({ role_id: roleId, permission_id }))
    );
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

/** Assign an establishment role to a user (RLS + hierarchy gated). */
export async function assignRole(input: {
  userId: string;
  roleId: string;
  establishmentId: string;
}): Promise<void> {
  await requireAnyPermission(["users.create", "users.invite", "users.update"]);

  const roles = await listRoles(input.establishmentId);
  const role = roles.find((r) => r.id === input.roleId);
  if (!role) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (!role.isActive) throw new AuthorizationError("ROLE_SCOPE");
  await assertManageableLevel(role.level);

  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").insert({
    user_id: input.userId,
    role_id: input.roleId,
    establishment_id: input.establishmentId,
  });
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Remove an establishment role (last-admin protected for admin roles). */
export async function removeRole(input: {
  userId: string;
  roleId: string;
  establishmentId: string;
}): Promise<void> {
  await requireAnyPermission(["users.create", "users.invite", "users.update"]);

  const roles = await listRoles(input.establishmentId);
  const role = roles.find((r) => r.id === input.roleId);
  if (!role) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  await assertManageableLevel(role.level);

  if (ADMIN_ROLE_CODES.includes(role.code)) {
    await assertActiveAdminExists(input.establishmentId, input.userId);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", input.userId)
    .eq("role_id", input.roleId)
    .eq("establishment_id", input.establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Role assignments of a user (service-role read, permission-gated by caller). */
export async function getUserRoleAssignments(
  userId: string
): Promise<UserRoleAssignment[]> {
  // Read actions go through the user's session so members only see their own
  // establishment data (RLS user_roles_read). Assignments are aggregated
  // per-establishment on top of the memberships.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select(
      `user_id, establishment_id, role_id, created_at,
       roles(id, code, name, level),
       establishments(id, name)`
    )
    .eq("user_id", userId);

  if (error) throw new AuthorizationError("GENERIC", error.message);

  return (data ?? []).flatMap((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    const est = Array.isArray(row.establishments)
      ? row.establishments[0]
      : row.establishments;
    if (!role) return [];
    return [
      {
        userId: row.user_id,
        roleId: row.role_id,
        establishmentId: row.establishment_id,
        roleCode: role.code,
        roleName: role.name,
        roleLevel: role.level,
        establishmentName: est?.name ?? null,
        createdAt: row.created_at,
      },
    ];
  });
}

export { SYSTEM_ROLE_CODES };