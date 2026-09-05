"use server";

import { revalidatePath } from "next/cache";
import {
  createRoleSchema,
  updateRoleSchema,
  duplicateRoleSchema,
  setRoleStatusSchema,
  deleteRoleSchema,
  setRolePermissionsSchema,
} from "@/validations/roles";
import { requirePermission, requireCurrentEstablishment } from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createRole,
  updateRole,
  duplicateRole,
  setRoleStatus,
  deleteRole,
  getRole,
  setRolePermissions,
} from "@/services/roles-service";
import { ok, okVoid, fail, type ActionResult } from "@/lib/authorization/action-result";

export async function createRoleAction(input: {
  name: string;
  code: string;
  description?: string | null;
  level?: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createRoleSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.create");

    const created = await createRole(parsed.data);

    await writeAudit({
      action: "role.created",
      establishmentId,
      entityType: "role",
      entityId: created.id,
      newValues: { name: parsed.data.name, code: parsed.data.code },
    });

    revalidatePath("/roles");
    return ok(created);
  } catch (error) {
    return fail(error);
  }
}

export async function updateRoleAction(input: {
  roleId: string;
  name?: string;
  description?: string | null;
  level?: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateRoleSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.update");

    const { roleId, establishmentId: estId, ...patch } = parsed.data;
    await updateRole(estId, roleId, patch);

    const role = await getRole(estId, roleId);
    await writeAudit({
      action: "role.updated",
      establishmentId: estId,
      entityType: "role",
      entityId: roleId,
      newValues: {
        name: role?.name,
        level: parsed.data.level,
        isActive: parsed.data.isActive,
      },
    });

    revalidatePath("/roles");
    revalidatePath("/roles/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateRoleAction(input: {
  sourceRoleId: string;
  name: string;
  code: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = duplicateRoleSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.create");

    const created = await duplicateRole({
      sourceRoleId: parsed.data.sourceRoleId,
      establishmentId,
      name: parsed.data.name,
      code: parsed.data.code,
    });

    await writeAudit({
      action: "role.duplicated",
      establishmentId,
      entityType: "role",
      entityId: created.id,
      newValues: { sourceRoleId: parsed.data.sourceRoleId },
    });

    revalidatePath("/roles");
    return ok(created);
  } catch (error) {
    return fail(error);
  }
}

export async function setRoleStatusAction(input: {
  roleId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setRoleStatusSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.update");
    await setRoleStatus(establishmentId, parsed.data.roleId, parsed.data.isActive);

    await writeAudit({
      action: "role.toggled",
      establishmentId,
      entityType: "role",
      entityId: parsed.data.roleId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/roles");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRoleAction(input: {
  roleId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteRoleSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.delete");
    await deleteRole(establishmentId, parsed.data.roleId);

    await writeAudit({
      action: "role.deleted",
      establishmentId,
      entityType: "role",
      entityId: parsed.data.roleId,
    });

    revalidatePath("/roles");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function saveRolePermissionsAction(input: {
  roleId: string;
  permissionIds: string[];
}): Promise<ActionResult> {
  try {
    const parsed = setRolePermissionsSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("roles.update");
    await setRolePermissions(parsed.data.roleId, parsed.data.permissionIds);

    const establishmentId = (await requireCurrentEstablishment()).toString();
    await writeAudit({
      action: "role.permissions.updated",
      establishmentId,
      entityType: "role",
      entityId: parsed.data.roleId,
      newValues: { permissionCount: parsed.data.permissionIds.length },
    });

    revalidatePath("/roles/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}