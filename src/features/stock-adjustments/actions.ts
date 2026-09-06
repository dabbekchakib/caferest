"use server";

import { revalidatePath } from "next/cache";
import {
  createStockAdjustmentSchema,
  addStockAdjustmentItemSchema,
  updateStockAdjustmentItemSchema,
  removeStockAdjustmentItemSchema,
  stockAdjustmentActionSchema,
} from "@/validations/stock-adjustments";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getSettingsMap } from "@/services/settings";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/services/audit";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  createStockAdjustment,
  addStockAdjustmentItem,
  updateStockAdjustmentItem,
  removeStockAdjustmentItem,
  submitStockAdjustment,
  approveStockAdjustment,
  validateStockAdjustment,
  cancelStockAdjustment,
  deleteStockAdjustment,
  getStockAdjustment,
  listStockAdjustmentReasons,
  listAdjustmentIngredients,
  listInventoryLocations,
  getStockQuantities,
  nextStockAdjustmentNumberPreview,
} from "@/services/stock-adjustments-service";
import { adjustmentThresholdsFromSettings } from "@/lib/stock-adjustments/thresholds";
import {
  STOCK_ADJUSTMENT_TYPES,
  canStockAdjustmentTransition,
  stockAdjustmentTargetStatus,
  type StockAdjustmentAction,
} from "@/lib/stock-adjustments/status";
import type { StockAdjustmentThresholds } from "@/lib/stock-adjustments/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

type StockAdjustmentActionInput = {
  adjustmentId: string;
  reason?: string | null;
};

function toTrimmedOrNull(value?: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Builder data (read-only)
// ---------------------------------------------------------------------------

export async function getStockAdjustmentLocationsAction(): Promise<
  Array<{ id: string; name: string; code: string }>
> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stock_adjustments.create");
  const locations = await listInventoryLocations(establishmentId);
  return locations.map((location) => ({
    id: location.id,
    name: location.name,
    code: location.code,
  }));
}

export async function getStockAdjustmentReasonsAction(input?: {
  type?: (typeof STOCK_ADJUSTMENT_TYPES)[number] | null;
}): Promise<Array<{ id: string; code: string; label: string }>> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stock_adjustments.create");
  const reasons = await listStockAdjustmentReasons(establishmentId, {
    type: input?.type ?? null,
  });
  return reasons.map((reason) => ({
    id: reason.id,
    code: reason.code,
    label: reason.label,
  }));
}

export async function getStockAdjustmentIngredientsAction(): Promise<
  Array<{ id: string; name: string; sku: string; baseUnit: string }>
> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stock_adjustments.create");
  const ingredients = await listAdjustmentIngredients(establishmentId);
  return ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name ?? "",
    sku: ingredient.sku ?? "",
    baseUnit: ingredient.baseUnit ?? "",
  }));
}

export async function getStockQuantitiesAction(input: {
  inventoryLocationId: string;
  ingredientIds: string[];
}): Promise<
  Array<{ ingredientId: string; quantity: number; averageCost: number }>
> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stock_adjustments.create");
  const map = await getStockQuantities(
    establishmentId,
    input.inventoryLocationId,
    input.ingredientIds
  );
  return [...map.entries()].map(([ingredientId, stock]) => ({
    ingredientId,
    quantity: stock.quantity,
    averageCost: stock.averageCost,
  }));
}

export async function nextStockAdjustmentNumberAction(): Promise<string> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stock_adjustments.create");
  return nextStockAdjustmentNumberPreview(establishmentId);
}

// ---------------------------------------------------------------------------
// Thresholds (approval gates forwarded to the RPCs)
// ---------------------------------------------------------------------------

async function resolveThresholds(
  establishmentId: string
): Promise<StockAdjustmentThresholds> {
  const supabase = await createClient();
  const settings = await getSettingsMap(supabase, establishmentId);
  return adjustmentThresholdsFromSettings(settings);
}

// ---------------------------------------------------------------------------
// Create + draft line editing
// ---------------------------------------------------------------------------

export async function createStockAdjustmentAction(input: {
  inventoryLocationId: string;
  adjustmentType: (typeof STOCK_ADJUSTMENT_TYPES)[number];
  adjustmentDate: string;
  reasonId?: string | null;
  notes?: string | null;
  internalReference?: string | null;
  items: Array<{ ingredientId: string; quantity: number; unitId?: string | null }>;
}): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createStockAdjustmentSchema.safeParse({
      ...input,
      establishmentId,
      inventoryLocationId: input.inventoryLocationId,
      adjustmentType: input.adjustmentType,
      adjustmentDate: input.adjustmentDate,
      reasonId: input.reasonId ?? null,
      notes: input.notes ?? null,
      internalReference: input.internalReference ?? null,
      items: input.items,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stock_adjustments.create");

    const id = await createStockAdjustment(establishmentId, {
      inventoryLocationId: parsed.data.inventoryLocationId,
      adjustmentType: parsed.data.adjustmentType,
      adjustmentDate: parsed.data.adjustmentDate,
      reasonId: parsed.data.reasonId ?? null,
      notes: toTrimmedOrNull(parsed.data.notes),
      internalReference: toTrimmedOrNull(parsed.data.internalReference),
      items: parsed.data.items.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitId: item.unitId ?? null,
      })),
    });

    const created = await getStockAdjustment(establishmentId, id);

    await writeAudit({
      action: "stock_adjustment.created",
      establishmentId,
      entityType: "stock_adjustment",
      entityId: id,
      newValues: {
        number: created?.adjustment_number ?? null,
        type: parsed.data.adjustmentType,
        locationId: parsed.data.inventoryLocationId,
        lines: parsed.data.items.length,
      },
    });

    revalidatePath("/stock-adjustments");
    return ok({ id, number: created?.adjustment_number ?? "" });
  } catch (error) {
    return fail(error);
  }
}

export async function addStockAdjustmentItemAction(input: {
  adjustmentId: string;
  ingredientId: string;
  quantity: number;
  unitId?: string | null;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = addStockAdjustmentItemSchema.safeParse({
      ...input,
      establishmentId,
      adjustmentId: input.adjustmentId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unitId: input.unitId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stock_adjustments.update");

    const adjustment = await getStockAdjustment(
      establishmentId,
      parsed.data.adjustmentId
    );
    if (!adjustment) throw new AuthorizationError("STOCK_ADJUSTMENT_NOT_FOUND");
    if (!canStockAdjustmentTransition(adjustment.status, "submit") && adjustment.status !== "draft") {
      throw new AuthorizationError("STOCK_ADJUSTMENT_WRONG_STATUS");
    }

    await addStockAdjustmentItem(establishmentId, {
      adjustmentId: parsed.data.adjustmentId,
      ingredientId: parsed.data.ingredientId,
      quantity: parsed.data.quantity,
      unitId: parsed.data.unitId ?? null,
    });

    await writeAudit({
      action: "stock_adjustment.item_added",
      establishmentId,
      entityType: "stock_adjustment",
      entityId: parsed.data.adjustmentId,
      newValues: {
        number: adjustment.adjustment_number,
        ingredientId: parsed.data.ingredientId,
        quantity: parsed.data.quantity,
      },
    });

    revalidatePath(`/stock-adjustments/${parsed.data.adjustmentId}`);
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function updateStockAdjustmentItemAction(input: {
  adjustmentId: string;
  itemId: string;
  quantity: number;
  unitId?: string | null;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateStockAdjustmentItemSchema.safeParse({
      ...input,
      establishmentId,
      adjustmentId: input.adjustmentId,
      itemId: input.itemId,
      quantity: input.quantity,
      unitId: input.unitId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stock_adjustments.update");

    const adjustment = await getStockAdjustment(
      establishmentId,
      parsed.data.adjustmentId
    );
    if (!adjustment) throw new AuthorizationError("STOCK_ADJUSTMENT_NOT_FOUND");
    if (adjustment.status !== "draft") {
      throw new AuthorizationError("STOCK_ADJUSTMENT_WRONG_STATUS");
    }

    await updateStockAdjustmentItem(establishmentId, {
      adjustmentId: parsed.data.adjustmentId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      unitId: parsed.data.unitId ?? null,
    });

    await writeAudit({
      action: "stock_adjustment.item_updated",
      establishmentId,
      entityType: "stock_adjustment",
      entityId: parsed.data.adjustmentId,
      newValues: {
        itemId: parsed.data.itemId,
        quantity: parsed.data.quantity,
      },
    });

    revalidatePath(`/stock-adjustments/${parsed.data.adjustmentId}`);
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function removeStockAdjustmentItemAction(input: {
  adjustmentId: string;
  itemId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = removeStockAdjustmentItemSchema.safeParse({
      ...input,
      establishmentId,
      adjustmentId: input.adjustmentId,
      itemId: input.itemId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stock_adjustments.update");

    const adjustment = await getStockAdjustment(
      establishmentId,
      parsed.data.adjustmentId
    );
    if (!adjustment) throw new AuthorizationError("STOCK_ADJUSTMENT_NOT_FOUND");
    if (adjustment.status !== "draft") {
      throw new AuthorizationError("STOCK_ADJUSTMENT_WRONG_STATUS");
    }

    await removeStockAdjustmentItem(establishmentId, {
      adjustmentId: parsed.data.adjustmentId,
      itemId: parsed.data.itemId,
    });

    await writeAudit({
      action: "stock_adjustment.item_removed",
      establishmentId,
      entityType: "stock_adjustment",
      entityId: parsed.data.adjustmentId,
      newValues: {
        number: adjustment.adjustment_number,
        itemId: parsed.data.itemId,
      },
    });

    revalidatePath(`/stock-adjustments/${parsed.data.adjustmentId}`);
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Header workflow transitions
// ---------------------------------------------------------------------------

async function transition(
  input: StockAdjustmentActionInput,
  permission: string,
  action: StockAdjustmentAction
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = stockAdjustmentActionSchema.safeParse({
      adjustmentId: input.adjustmentId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(permission);

    const adjustment = await getStockAdjustment(
      establishmentId,
      parsed.data.adjustmentId
    );
    if (!adjustment) throw new AuthorizationError("STOCK_ADJUSTMENT_NOT_FOUND");
    if (!canStockAdjustmentTransition(adjustment.status, action)) {
      throw new AuthorizationError("STOCK_ADJUSTMENT_WRONG_STATUS");
    }

    const reason = toTrimmedOrNull(parsed.data.reason);
    const thresholds = await resolveThresholds(establishmentId);

    switch (action) {
      case "submit":
        await submitStockAdjustment(establishmentId, parsed.data.adjustmentId, thresholds);
        break;
      case "approve":
        await approveStockAdjustment(establishmentId, parsed.data.adjustmentId, thresholds);
        break;
      case "validate":
        await validateStockAdjustment(establishmentId, parsed.data.adjustmentId);
        break;
      case "cancel":
        await cancelStockAdjustment(establishmentId, parsed.data.adjustmentId, reason);
        break;
      case "delete":
        await deleteStockAdjustment(establishmentId, parsed.data.adjustmentId);
        break;
    }

    // `submit` has a dynamic target (pending_approval | approved): re-read the
    // header to capture the real status for the audit trail.
    const after = await getStockAdjustment(establishmentId, parsed.data.adjustmentId);
    const target =
      after?.status ?? stockAdjustmentTargetStatus(adjustment.status, action);

    const actionVerb =
      action === "delete"
        ? "deleted"
        : action === "submit"
          ? "submitted"
          : action === "cancel"
            ? "cancelled"
            : action === "approve"
              ? "approved"
              : "validated";

    await writeAudit({
      action: `stock_adjustment.${actionVerb}`,
      establishmentId,
      entityType: "stock_adjustment",
      entityId: parsed.data.adjustmentId,
      oldValues: {
        status: adjustment.status,
        number: adjustment.adjustment_number,
      },
      newValues: {
        status: target,
        reason,
      },
    });

    if (action === "validate") {
      await writeAudit({
        action: "stock.adjusted",
        establishmentId,
        entityType: "stock_adjustment",
        entityId: parsed.data.adjustmentId,
        newValues: {
          number: adjustment.adjustment_number,
          lines: adjustment.summary.itemCount,
        },
      });
    }

    if (action === "delete") {
      revalidatePath("/stock-adjustments");
    } else {
      revalidatePath(`/stock-adjustments/${parsed.data.adjustmentId}`);
      revalidatePath("/stock-adjustments");
    }
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function submitStockAdjustmentAction(
  input: StockAdjustmentActionInput
): Promise<ActionResult> {
  return transition(input, "stock_adjustments.submit", "submit");
}

export async function approveStockAdjustmentAction(
  input: StockAdjustmentActionInput
): Promise<ActionResult> {
  return transition(input, "stock_adjustments.approve", "approve");
}

export async function validateStockAdjustmentAction(
  input: StockAdjustmentActionInput
): Promise<ActionResult> {
  return transition(input, "stock_adjustments.validate", "validate");
}

export async function cancelStockAdjustmentAction(
  input: StockAdjustmentActionInput
): Promise<ActionResult> {
  return transition(input, "stock_adjustments.cancel", "cancel");
}

export async function deleteStockAdjustmentAction(
  input: StockAdjustmentActionInput
): Promise<ActionResult> {
  return transition(input, "stock_adjustments.delete", "delete");
}