"use server";

import { revalidatePath } from "next/cache";
import {
  createUnitSchema,
  updateUnitSchema,
  deleteUnitSchema,
  setUnitStatusSchema,
} from "@/validations/units";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createUnit,
  updateUnit,
  deleteUnit,
  setUnitStatus,
} from "@/services/units-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

export async function createUnitAction(input: {
  name: string;
  symbol: string;
  type: string;
  description?: string | null;
  precision?: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createUnitSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("units.create");

    const unit = await createUnit(establishmentId, parsed.data);

    await writeAudit({
      action: "unit.created",
      establishmentId,
      entityType: "unit",
      entityId: unit.id,
      newValues: { name: unit.name, symbol: unit.symbol, type: unit.type },
    });

    revalidatePath("/units");
    revalidatePath("/unit-conversions");
    return ok({ id: unit.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateUnitAction(input: {
  unitId: string;
  name?: string;
  symbol?: string;
  type?: string;
  description?: string | null;
  precision?: number;
  isBase?: boolean;
  isActive?: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateUnitSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("units.update");

    const { unitId, establishmentId: estId, ...patch } = parsed.data;
    await updateUnit(estId, unitId, patch);

    await writeAudit({
      action: "unit.updated",
      establishmentId: estId,
      entityType: "unit",
      entityId: unitId,
      newValues: {
        name: patch.name,
        symbol: patch.symbol,
        precision: patch.precision,
        isActive: patch.isActive,
      },
    });

    revalidatePath("/units");
    revalidatePath("/unit-conversions");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteUnitAction(input: {
  unitId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteUnitSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("units.delete");
    await deleteUnit(establishmentId, parsed.data.unitId);

    await writeAudit({
      action: "unit.deleted",
      establishmentId,
      entityType: "unit",
      entityId: parsed.data.unitId,
    });

    revalidatePath("/units");
    revalidatePath("/unit-conversions");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setUnitStatusAction(input: {
  unitId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setUnitStatusSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("units.update");
    await setUnitStatus(establishmentId, parsed.data.unitId, parsed.data.isActive);

    await writeAudit({
      action: "unit.toggled",
      establishmentId,
      entityType: "unit",
      entityId: parsed.data.unitId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/units");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}