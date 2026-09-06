"use server";

import { revalidatePath } from "next/cache";
import {
  createTableSchema,
  updateTableSchema,
  deleteTableSchema,
  setTableStatusSchema,
  duplicateTableSchema,
  updateTableFloorPlanSchema,
} from "@/validations/tables";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createTable,
  updateTable,
  deleteTable,
  setTableStatus,
  duplicateTable,
  applyTableFloorPatches,
  getTable,
} from "@/services/tables-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import { AuthorizationError } from "@/lib/authorization/errors";

export async function createTableAction(input: {
  name: string;
  slug: string;
  tableNumber?: string | null;
  areaId?: string | null;
  capacity?: number;
  shape?: "round" | "square" | "rectangle";
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number;
  color?: string | null;
  sortOrder?: number;
  status?: "available" | "occupied" | "reserved" | "cleaning" | "disabled" | "blocked";
  isActive?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createTableSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.create");

    const { establishmentId: estId, ...rest } = parsed.data;
    const created = await createTable(estId, rest);

    await writeAudit({
      action: "table.created",
      establishmentId: estId,
      entityType: "table",
      entityId: created.id,
      newValues: { name: created.name, tableNumber: created.table_number },
    });

    revalidatePath("/tables");
    revalidatePath("/floor-plan");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateTableAction(input: {
  tableId: string;
  name?: string;
  slug?: string;
  tableNumber?: string | null;
  areaId?: string | null;
  capacity?: number;
  shape?: "round" | "square" | "rectangle";
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number;
  color?: string | null;
  sortOrder?: number;
  status?: "available" | "occupied" | "reserved" | "cleaning" | "disabled" | "blocked";
  isActive?: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateTableSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.update");

    const { tableId, establishmentId: estId, ...rest } = parsed.data;
    const existing = await getTable(estId, tableId);
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    await updateTable(estId, tableId, rest);

    await writeAudit({
      action: "table.updated",
      establishmentId: estId,
      entityType: "table",
      entityId: tableId,
      newValues: {
        name: rest.name,
        tableNumber: rest.tableNumber,
        areaId: rest.areaId,
        capacity: rest.capacity,
        shape: rest.shape,
      },
    });

    revalidatePath("/tables");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTableAction(input: {
  tableId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteTableSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.delete");
    await deleteTable(establishmentId, parsed.data.tableId);

    await writeAudit({
      action: "table.deleted",
      establishmentId,
      entityType: "table",
      entityId: parsed.data.tableId,
    });

    revalidatePath("/tables");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setTableStatusAction(input: {
  tableId: string;
  status: "available" | "occupied" | "reserved" | "cleaning" | "disabled" | "blocked";
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setTableStatusSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.status");
    await setTableStatus(establishmentId, parsed.data.tableId, parsed.data.status);

    await writeAudit({
      action: "table.status_changed",
      establishmentId,
      entityType: "table",
      entityId: parsed.data.tableId,
      newValues: { status: parsed.data.status },
    });

    revalidatePath("/tables");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateTableAction(input: {
  tableId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = duplicateTableSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.create");
    const cloned = await duplicateTable(establishmentId, parsed.data.tableId);

    await writeAudit({
      action: "table.duplicated",
      establishmentId,
      entityType: "table",
      entityId: cloned.id,
      newValues: { from: parsed.data.tableId, name: cloned.name },
    });

    revalidatePath("/tables");
    revalidatePath("/floor-plan");
    return ok({ id: cloned.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateTableFloorPlanAction(input: {
  patches: {
    tableId: string;
    areaId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    width?: number | null;
    height?: number | null;
    rotation?: number;
  }[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateTableFloorPlanSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("tables.floor_plan");
    await applyTableFloorPatches(establishmentId, parsed.data.patches);

    await writeAudit({
      action: "table.floor_updated",
      establishmentId,
      entityType: "table",
      newValues: { patchCount: parsed.data.patches.length },
    });

    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}