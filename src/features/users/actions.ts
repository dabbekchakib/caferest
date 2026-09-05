"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  inviteUserSchema,
  setUserStatusSchema,
  deleteUserSchema,
  addRoleAssignmentSchema,
  removeRoleAssignmentSchema,
} from "@/validations/users";
import {
  requirePermission,
  requireAnyPermission,
  requireCurrentEstablishment,
  assertUserManageable,
  assertManageableLevel,
  assertActiveAdminExists,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  inviteUser,
  updateUserStatus,
  deleteUser,
} from "@/services/users-service";
import { assignRole, removeRole, listRoles } from "@/services/roles-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import type { AdminUserView } from "@/lib/authorization/types";

async function inviteRedirectUrl(): Promise<string> {
  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  return host ? `${proto}://${host}/login` : "/login";
}

export async function inviteUserAction(input: {
  email: string;
  roleId: string;
}): Promise<ActionResult<AdminUserView>> {
  try {
    const parsed = inviteUserSchema
      .omit({ establishmentId: true })
      .safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const establishmentId = await requireCurrentEstablishment();
    await requireAnyPermission(["users.create", "users.invite"]);

    const roles = await listRoles(establishmentId);
    const role = roles.find((r) => r.id === parsed.data.roleId);
    if (!role) throw new Error("Role not found");
    await assertManageableLevel(role.level);

    const user = await inviteUser({
      email: parsed.data.email,
      establishmentId,
      roleId: parsed.data.roleId,
      redirectTo: await inviteRedirectUrl(),
    });

    await writeAudit({
      action: "user.invited",
      establishmentId,
      entityType: "user",
      entityId: user.id,
      newValues: {
        email: user.email,
        roleId: parsed.data.roleId,
      },
    });

    revalidatePath("/users");
    revalidatePath("/roles");
    return ok(user);
  } catch (error) {
    return fail(error);
  }
}

export async function setUserStatusAction(input: {
  userId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const parsed = setUserStatusSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("users.update");
    await assertUserManageable(establishmentId, parsed.data.userId);

    if (!parsed.data.isActive) {
      await assertActiveAdminExists(establishmentId, parsed.data.userId);
    }

    await updateUserStatus(parsed.data.userId, parsed.data.isActive);

    await writeAudit({
      action: parsed.data.isActive ? "user.activated" : "user.deactivated",
      establishmentId,
      entityType: "user",
      entityId: parsed.data.userId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/users");
    revalidatePath("/users/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteUserAction(input: {
  userId: string;
}): Promise<ActionResult> {
  try {
    const parsed = deleteUserSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("users.delete");
    await assertUserManageable(establishmentId, parsed.data.userId);
    await assertActiveAdminExists(establishmentId, parsed.data.userId);

    await deleteUser(parsed.data.userId);

    await writeAudit({
      action: "user.deleted",
      establishmentId,
      entityType: "user",
      entityId: parsed.data.userId,
    });

    revalidatePath("/users");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function assignRoleAction(input: {
  userId: string;
  roleId: string;
}): Promise<ActionResult> {
  try {
    const parsed = addRoleAssignmentSchema
      .omit({ establishmentId: true })
      .safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const establishmentId = await requireCurrentEstablishment();
    await requireAnyPermission(["users.create", "users.invite", "users.update"]);

    await assignRole({
      userId: parsed.data.userId,
      roleId: parsed.data.roleId,
      establishmentId,
    });

    await writeAudit({
      action: "user.role.granted",
      establishmentId,
      entityType: "user",
      entityId: parsed.data.userId,
      newValues: { roleId: parsed.data.roleId },
    });

    revalidatePath("/users/[id]", "page");
    revalidatePath("/users");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function removeRoleAction(input: {
  userId: string;
  roleId: string;
}): Promise<ActionResult> {
  try {
    const parsed = removeRoleAssignmentSchema
      .omit({ establishmentId: true })
      .safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const establishmentId = await requireCurrentEstablishment();
    await requireAnyPermission(["users.create", "users.invite", "users.update"]);

    await removeRole({
      userId: parsed.data.userId,
      roleId: parsed.data.roleId,
      establishmentId,
    });

    await writeAudit({
      action: "user.role.revoked",
      establishmentId,
      entityType: "user",
      entityId: parsed.data.userId,
      newValues: { roleId: parsed.data.roleId },
    });

    revalidatePath("/users/[id]", "page");
    revalidatePath("/users");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}