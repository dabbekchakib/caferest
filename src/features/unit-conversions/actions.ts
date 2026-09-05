"use server";

import { revalidatePath } from "next/cache";
import {
  createUnitConversionSchema,
  updateUnitConversionSchema,
  deleteUnitConversionSchema,
  setUnitConversionStatusSchema,
  convertQueueSchema,
} from "@/validations/unit-conversions";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createConversion,
  updateConversion,
  deleteConversion,
  setConversionStatus,
} from "@/services/unit-conversions-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

export async function createUnitConversionAction(input: {
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  offset?: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createUnitConversionSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("unit_conversions.create");

    const created = await createConversion(establishmentId, parsed.data);

    await writeAudit({
      action: "unit_conversion.created",
      establishmentId,
      entityType: "unit_conversion",
      entityId: created.id,
      newValues: {
        from_unit_id: parsed.data.from_unit_id,
        to_unit_id: parsed.data.to_unit_id,
        factor: parsed.data.factor,
      },
    });

    revalidatePath("/unit-conversions");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateUnitConversionAction(input: {
  conversionId: string;
  from_unit_id?: string;
  to_unit_id?: string;
  factor?: number;
  offset?: number;
  is_active?: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateUnitConversionSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("unit_conversions.update");

    const { conversionId, establishmentId: estId, ...patch } = parsed.data;
    await updateConversion(estId, conversionId, patch);

    await writeAudit({
      action: "unit_conversion.updated",
      establishmentId: estId,
      entityType: "unit_conversion",
      entityId: conversionId,
      newValues: {
        from_unit_id: patch.from_unit_id,
        to_unit_id: patch.to_unit_id,
        factor: patch.factor,
        is_active: patch.is_active,
      },
    });

    revalidatePath("/unit-conversions");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteUnitConversionAction(input: {
  conversionId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteUnitConversionSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("unit_conversions.delete");
    await deleteConversion(establishmentId, parsed.data.conversionId);

    await writeAudit({
      action: "unit_conversion.deleted",
      establishmentId,
      entityType: "unit_conversion",
      entityId: parsed.data.conversionId,
    });

    revalidatePath("/unit-conversions");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setUnitConversionStatusAction(input: {
  conversionId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setUnitConversionStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("unit_conversions.update");
    await setConversionStatus(
      establishmentId,
      parsed.data.conversionId,
      parsed.data.isActive
    );

    await writeAudit({
      action: "unit_conversion.toggled",
      establishmentId,
      entityType: "unit_conversion",
      entityId: parsed.data.conversionId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/unit-conversions");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

/**
 * Live conversion preview for the UI widget. Reads the scoped catalog through
 * the cache and runs the pure engine; only view permission is required.
 */
export async function convertPreviewAction(
  input: unknown
): Promise<
  ActionResult<{ value: number; fromSymbol?: string; toSymbol?: string }>
> {
  const establishmentId = await requireCurrentEstablishment();
  const parsed = convertQueueSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);

  try {
    await requirePermission("units.view");
  } catch (error) {
    return fail(error);
  }

  try {
    const { getUnitsCached, getConversionsCached } = await import(
      "@/services/units-cache"
    );
    const { convertUnitValue } = await import("@/lib/units/conversions");

    const [units, conversions] = await Promise.all([
      getUnitsCached(establishmentId),
      getConversionsCached(establishmentId),
    ]);

    const result = convertUnitValue(
      parsed.data.value,
      parsed.data.fromUnitId,
      parsed.data.toUnitId,
      conversions
    );

    const from = units.find((u) => u.id === parsed.data.fromUnitId);
    const to = units.find((u) => u.id === parsed.data.toUnitId);

    return ok({
      value: result.value,
      fromSymbol: from?.symbol,
      toSymbol: to?.symbol,
    });
  } catch (error) {
    return fail(error);
  }
}