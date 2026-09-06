"use server";

import { revalidatePath } from "next/cache";
import {
  createStocktakeSchema,
  startStocktakeSchema,
  stocktakeCountSchema,
  stocktakeActionSchema,
} from "@/validations/stocktakes";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getSettingsMap } from "@/services/settings";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/services/audit";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  createStocktake,
  startStocktake,
  updateStocktakeItemCount,
  completeStocktake,
  approveStocktake,
  validateStocktake,
  cancelStocktake,
  deleteStocktake,
  getStocktake,
  listInventoryLocations,
  listStocktakeIngredients,
  nextStocktakeNumberPreview,
} from "@/services/stocktakes-service";
import { stocktakeThresholdsFromSettings } from "@/lib/stocktakes/thresholds";
import type { StocktakeThresholds } from "@/lib/stocktakes/types";
import {
  canStocktakeTransition,
  stocktakeTargetStatus,
} from "@/lib/stocktakes/status";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

type StocktakeActionInput = {
  stocktakeId: string;
  reason?: string | null;
};

function toTrimmedOrNull(value?: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Builder data (read-only)
// ---------------------------------------------------------------------------

export interface StocktakeLocationLite {
  id: string;
  name: string;
  code: string;
}

export async function getStocktakeLocationsAction(): Promise<
  StocktakeLocationLite[]
> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stocktakes.create");
  const locations = await listInventoryLocations(establishmentId);
  return locations.map((location) => ({
    id: location.id,
    name: location.name,
    code: location.code,
  }));
}

export async function getStocktakeIngredientsAction(): Promise<
  Array<{ id: string; name: string | null; sku: string | null }>
> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stocktakes.start");
  return listStocktakeIngredients(establishmentId);
}

export async function nextStocktakeNumberAction(): Promise<string> {
  const establishmentId = await requireCurrentEstablishment();
  await requirePermission("stocktakes.create");
  return nextStocktakeNumberPreview(establishmentId);
}

// ---------------------------------------------------------------------------
// Thresholds (approval gates forwarded to the RPCs)
// ---------------------------------------------------------------------------

async function resolveThresholds(
  establishmentId: string
): Promise<StocktakeThresholds> {
  const supabase = await createClient();
  const settings = await getSettingsMap(supabase, establishmentId);
  return stocktakeThresholdsFromSettings(settings);
}

// ---------------------------------------------------------------------------
// Create / start / count
// ---------------------------------------------------------------------------

export async function createStocktakeAction(input: {
  inventoryLocationId: string;
  mode: "standard" | "blind";
  notes?: string | null;
}): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createStocktakeSchema.safeParse({
      ...input,
      establishmentId,
      inventoryLocationId: input.inventoryLocationId,
      notes: input.notes ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stocktakes.create");

    const id = await createStocktake(establishmentId, {
      inventoryLocationId: parsed.data.inventoryLocationId,
      mode: parsed.data.mode,
      notes: toTrimmedOrNull(parsed.data.notes),
    });

    const created = await getStocktake(establishmentId, id);

    await writeAudit({
      action: "stocktake.created",
      establishmentId,
      entityType: "stocktake",
      entityId: id,
      newValues: {
        number: created?.stocktake_number ?? null,
        mode: parsed.data.mode,
        locationId: parsed.data.inventoryLocationId,
      },
    });

    revalidatePath("/stocktakes");
    return ok({ id, number: created?.stocktake_number ?? "" });
  } catch (error) {
    return fail(error);
  }
}

export async function startStocktakeAction(input: {
  stocktakeId: string;
  scope: "all" | "stocked" | "selected";
  includeZeroStock?: boolean;
  ingredientIds?: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = startStocktakeSchema.safeParse({
      ...input,
      establishmentId,
      stocktakeId: input.stocktakeId,
      scope: input.scope,
      includeZeroStock: Boolean(input.includeZeroStock),
      ingredientIds: input.ingredientIds ?? [],
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stocktakes.start");

    const stocktake = await getStocktake(establishmentId, parsed.data.stocktakeId);
    if (!stocktake) throw new AuthorizationError("STOCKTAKE_NOT_FOUND");
    if (!canStocktakeTransition(stocktake.status, "start")) {
      throw new AuthorizationError("STOCKTAKE_INVALID_STATUS");
    }

    await startStocktake(establishmentId, {
      stocktakeId: parsed.data.stocktakeId,
      scope: parsed.data.scope,
      includeZeroStock: parsed.data.includeZeroStock,
      ingredientIds: parsed.data.ingredientIds,
    });

    await writeAudit({
      action: "stocktake.started",
      establishmentId,
      entityType: "stocktake",
      entityId: parsed.data.stocktakeId,
      newValues: {
        number: stocktake.stocktake_number,
        scope: parsed.data.scope,
        lines: parsed.data.ingredientIds.length,
      },
    });

    revalidatePath(`/stocktakes/${parsed.data.stocktakeId}`);
    revalidatePath("/stocktakes");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function updateStocktakeCountAction(input: {
  stocktakeId: string;
  itemId: string;
  amount: number | null;
  unitId: string | null;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = stocktakeCountSchema.safeParse({
      ...input,
      establishmentId,
      stocktakeId: input.stocktakeId,
      itemId: input.itemId,
      amount: input.amount,
      unitId: input.unitId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("stocktakes.count");

    const stocktake = await getStocktake(establishmentId, parsed.data.stocktakeId);
    if (!stocktake) throw new AuthorizationError("STOCKTAKE_NOT_FOUND");
    if (stocktake.status !== "counting") {
      throw new AuthorizationError("STOCKTAKE_WRONG_STATUS");
    }

    await updateStocktakeItemCount(establishmentId, {
      stocktakeId: parsed.data.stocktakeId,
      itemId: parsed.data.itemId,
      amount: parsed.data.amount,
      unitId: parsed.data.unitId,
    });

    revalidatePath(`/stocktakes/${parsed.data.stocktakeId}/count`);
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Header workflow transitions
// ---------------------------------------------------------------------------

async function transition(
  input: StocktakeActionInput,
  permission: string,
  action: "complete" | "approve" | "validate" | "cancel" | "delete"
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = stocktakeActionSchema.safeParse({
      stocktakeId: input.stocktakeId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(permission);

    const stocktake = await getStocktake(establishmentId, parsed.data.stocktakeId);
    if (!stocktake) throw new AuthorizationError("STOCKTAKE_NOT_FOUND");
    if (!canStocktakeTransition(stocktake.status, action)) {
      throw new AuthorizationError("STOCKTAKE_INVALID_STATUS");
    }

    const reason = toTrimmedOrNull(parsed.data.reason);
    const thresholds = await resolveThresholds(establishmentId);

    switch (action) {
      case "complete":
        await completeStocktake(establishmentId, parsed.data.stocktakeId);
        break;
      case "approve":
        await approveStocktake(establishmentId, parsed.data.stocktakeId, thresholds);
        break;
      case "validate":
        await validateStocktake(establishmentId, parsed.data.stocktakeId, thresholds);
        break;
      case "cancel":
        await cancelStocktake(establishmentId, parsed.data.stocktakeId, reason);
        break;
      case "delete":
        await deleteStocktake(establishmentId, parsed.data.stocktakeId);
        break;
    }

    const target = stocktakeTargetStatus(stocktake.status, action);

    await writeAudit({
      action: `stocktake.${action === "delete" ? "deleted" : action === "complete" ? "completed" : action === "cancel" ? "cancelled" : action === "approve" ? "approved" : "validated"}`,
      establishmentId,
      entityType: "stocktake",
      entityId: parsed.data.stocktakeId,
      oldValues: {
        status: stocktake.status,
        number: stocktake.stocktake_number,
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
        entityType: "stocktake",
        entityId: parsed.data.stocktakeId,
        newValues: {
          number: stocktake.stocktake_number,
          varianceLines: stocktake.items.filter(
            (item) =>
              item.counted_quantity !== null &&
              item.variance_quantity !== 0
          ).length,
        },
      });
    }

    if (action === "delete") {
      revalidatePath("/stocktakes");
    } else {
      revalidatePath(`/stocktakes/${parsed.data.stocktakeId}`);
      revalidatePath("/stocktakes");
    }
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function completeStocktakeAction(
  input: StocktakeActionInput
): Promise<ActionResult> {
  return transition(input, "stocktakes.review", "complete");
}

export async function approveStocktakeAction(
  input: StocktakeActionInput
): Promise<ActionResult> {
  return transition(input, "stocktakes.approve", "approve");
}

export async function validateStocktakeAction(
  input: StocktakeActionInput
): Promise<ActionResult> {
  return transition(input, "stocktakes.validate", "validate");
}

export async function cancelStocktakeAction(
  input: StocktakeActionInput
): Promise<ActionResult> {
  return transition(input, "stocktakes.cancel", "cancel");
}

export async function deleteStocktakeAction(
  input: StocktakeActionInput
): Promise<ActionResult> {
  return transition(input, "stocktakes.delete", "delete");
}