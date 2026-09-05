"use server";

import { revalidatePath } from "next/cache";
import {
  saveRecipeYieldSchema,
  recipeYieldActivateSchema,
  recipeYieldCalculateSchema,
  recipeYieldDeleteSchema,
} from "@/validations/yields";
import {
  requirePermission,
  requireAnyPermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  getRecipeYield,
  saveRecipeYield,
  setRecipeYieldActive,
  deleteRecipeYield,
  calculateTheoreticalConsumption,
  type TheoreticalConsumptionResult,
} from "@/services/yields-service";
import { productionFor } from "@/lib/yields/calculations";
import type { YieldDefinition } from "@/lib/yields/types";
import { getCatalogCached } from "@/services/units-cache";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

export async function saveRecipeYieldAction(input: {
  recipeId: string;
  yieldType:
    | "exact_consumption"
    | "batch_yield"
    | "range_yield"
    | "portion_yield"
    | "percentage_yield";
  inputQuantity?: number | null;
  inputUnitId?: string | null;
  outputQuantity?: number | null;
  outputUnitId?: string | null;
  minimumYield?: number | null;
  standardYield?: number | null;
  maximumYield?: number | null;
  yieldPercentage?: number | null;
  notes?: string | null;
  isActive?: boolean;
}): Promise<ActionResult<{ created: boolean }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = saveRecipeYieldSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    const { recipeId, establishmentId: estId, ...rest } = parsed.data;
    const existing = await getRecipeYield(estId, recipeId);
    if (existing.row) {
      await requirePermission("recipe_yields.update");
    } else {
      await requirePermission("recipe_yields.create");
    }

    const result = await saveRecipeYield(estId, recipeId, {
      yield_type: rest.yieldType,
      input_quantity: rest.inputQuantity ?? null,
      input_unit_id: rest.inputUnitId ?? null,
      output_quantity: rest.outputQuantity ?? null,
      output_unit_id: rest.outputUnitId ?? null,
      minimum_yield: rest.minimumYield ?? null,
      standard_yield: rest.standardYield ?? null,
      maximum_yield: rest.maximumYield ?? null,
      yield_percentage: rest.yieldPercentage ?? null,
      notes: rest.notes ?? null,
      is_active: rest.isActive ?? true,
    });

    await writeAudit({
      action: result.created ? "recipe_yield.created" : "recipe_yield.updated",
      establishmentId: estId,
      entityType: "recipe_yield",
      entityId: recipeId,
      newValues: {
        yieldType: rest.yieldType,
        inputQuantity: rest.inputQuantity,
        isActive: rest.isActive ?? true,
      },
    });

    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/recipes/[id]/edit", "page");
    revalidatePath("/recipes");
    return ok({ created: result.created });
  } catch (error) {
    return fail(error);
  }
}

export async function setRecipeYieldActiveAction(input: {
  recipeId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeYieldActivateSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    const { recipeId, isActive, establishmentId: estId } = parsed.data;
    await requirePermission("recipe_yields.update");
    await setRecipeYieldActive(estId, recipeId, isActive);

    await writeAudit({
      action: isActive
        ? "recipe_yield.activated"
        : "recipe_yield.deactivated",
      establishmentId: estId,
      entityType: "recipe_yield",
      entityId: recipeId,
      newValues: { isActive },
    });

    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/recipes/[id]/edit", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRecipeYieldAction(input: {
  recipeId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeYieldDeleteSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    const { recipeId, establishmentId: estId } = parsed.data;
    await requirePermission("recipe_yields.delete");
    await deleteRecipeYield(estId, recipeId);

    await writeAudit({
      action: "recipe_yield.deleted",
      establishmentId: estId,
      entityType: "recipe_yield",
      entityId: recipeId,
    });

    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/recipes/[id]/edit", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function calculateRecipeYieldAction(input: {
  recipeId: string;
  availableQuantity: number;
  availableUnitId: string;
  selection?: "min" | "standard" | "max";
}): Promise<ActionResult<{ production: number | null }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeYieldCalculateSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requireAnyPermission(["recipe_yields.view", "recipes.view"]);

    const {
      recipeId,
      availableQuantity,
      availableUnitId,
      selection,
      establishmentId: estId,
    } = parsed.data;
    const definition = (await getRecipeYield(estId, recipeId))
      .definition as YieldDefinition | null;
    const catalog = await getCatalogCached(estId);
    const production = definition
      ? productionFor(
          definition,
          availableQuantity,
          availableUnitId,
          catalog.conversions,
          selection
        )
      : null;

    // Recorded once per explicit calculation (never on implicit UI refreshes).
    await writeAudit({
      action: "recipe_yield.calculated",
      establishmentId: estId,
      entityType: "recipe_yield",
      entityId: recipeId,
      newValues: {
        availableQuantity,
        availableUnitId,
        selection,
        production,
      },
    });

    return ok({ production });
  } catch (error) {
    return fail(error);
  }
}

export async function getTheoreticalConsumptionAction(input: {
  recipeId: string;
}): Promise<ActionResult<TheoreticalConsumptionResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    await requireAnyPermission(["recipe_yields.view", "recipes.view"]);

    const result = await calculateTheoreticalConsumption(
      establishmentId,
      input.recipeId
    );
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}