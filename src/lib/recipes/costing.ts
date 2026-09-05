// NOTE: relative imports keep the pure cost engine runnable under `node --test`.
import { calculateIngredientCostPerBaseUnit } from "../ingredients/cost";
import type { UnitConversion } from "../units/types";
import { normalizeRecipeItemQuantity } from "./normalizer";

export interface RecipeItemCostParams {
  quantity: number;
  unitId: string | null;
  /** Ingredient cost-per-base-unit (TND); null when unknown/un-normalizable. */
  costPerBaseUnit: number | null;
  /** Ingredient base unit the quantity normalizes to. */
  baseUnitId: string | null;
  /**
   * Total raw cost of the referenced sub-recipe in TND (already normalized).
   * When null the sub-recipe has incomplete costing data → contribution unknown.
   */
  subRecipeCost: number | null;
  conversions: UnitConversion[];
}

/** Cost contribution of ONE recipe item (0 when the data is unavailable). */
export function calculateRecipeItemRawCost(
  params: RecipeItemCostParams
): number | null {
  if (params.subRecipeCost !== null) {
    // The item quantity is the number of sub-recipe batches used.
    if (!Number.isFinite(params.subRecipeCost)) return null;
    return params.quantity * params.subRecipeCost;
  }

  if (params.costPerBaseUnit === null || !Number.isFinite(params.costPerBaseUnit)) {
    return null;
  }

  const normalized = normalizeRecipeItemQuantity({
    quantity: params.quantity,
    unitId: params.unitId,
    baseUnitId: params.baseUnitId,
    conversions: params.conversions,
  });
  if (normalized === null) return null;

  return normalized * params.costPerBaseUnit;
}

export interface RecipeRawCostParams {
  items: RecipeItemCostParams[];
  conversions: UnitConversion[];
}

export interface RecipeRawCostResult {
  /** Sum of the KNOWN contributions, in TND. 0 when every item is known. */
  rawCost: number;
  /** True when at least one item could not be valued. */
  missingData: boolean;
}

/**
 * Preparatory. Estimated raw cost of one batch of a recipe, in TND:
 *
 *   cost = Σ( normalized_ingredient_quantity × cost_per_base_unit ) + Σ( batches × sub_recipe_cost )
 *
 * Works only from data that already exists (ingredients purchase configs,
 * sub-recipe costs) and NEVER mutates: no ingredient purchase cost, no product
 * price, no stock — the result is a display-only estimation.
 *
 * Example: 70 TND/kg of coffee × 10 g → 0.010 kg × 70 TND = 0.700 TND.
 */
export function calculateRecipeRawCost(
  params: RecipeRawCostParams
): RecipeRawCostResult {
  let rawCost = 0;
  let missingData = false;

  for (const item of params.items) {
    const contribution = calculateRecipeItemRawCost(item);
    if (contribution === null) {
      missingData = true;
      continue;
    }
    rawCost += contribution;
  }

  // Guard against float noise from the conversion engine.
  rawCost = Math.round((rawCost + Number.EPSILON) * 1000) / 1000;
  return { rawCost, missingData };
}

export { calculateIngredientCostPerBaseUnit };