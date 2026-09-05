// NOTE: relative import keeps the pure engine runnable under `node --test`
// (the test build does not resolve `@/` aliases at runtime). The only
// dependency is the conversion engine, itself pure.
import { convertUnitValue } from "../units/conversions";
import type { UnitConversion } from "../units/types";

export interface IngredientCostParams {
  /** Total price paid for `purchaseQuantity` of `purchaseUnitId`. */
  purchaseCost: number;
  /**
   * Quantity bought per purchase, expressed in `purchaseUnitId`
   * (e.g. 1 kg, 2 L, 10 pieces).
   */
  purchaseQuantity: number;
  purchaseUnitId: string;
  /** Storage/recipe unit the cost is normalized to (null → no normalization). */
  baseUnitId: string | null;
  /** Active conversion catalog of the establishment (system + local). */
  conversions: UnitConversion[];
}

/**
 * Effective cost of ONE `baseUnitId` unit:
 *
 *    base_cost = purchase_cost / converted_quantity
 *
 * where `converted_quantity` is `purchaseQuantity` expressed in the base unit
 * through the OrientedGraph conversion engine (e.g. 1 kg of coffee at 70 TND
 * → 70 / 1000 g = 0.070 TND/g). Returns null when the ingredient has no base
 * unit, no purchase unit, or when the two units are not convertible.
 */
export function calculateIngredientCostPerBaseUnit(
  params: IngredientCostParams
): number | null {
  if (
    !params.baseUnitId ||
    !params.purchaseUnitId ||
    !Number.isFinite(params.purchaseCost) ||
    !Number.isFinite(params.purchaseQuantity) ||
    params.purchaseQuantity <= 0
  ) {
    return null;
  }

  if (params.purchaseUnitId === params.baseUnitId) {
    return params.purchaseCost / params.purchaseQuantity;
  }

  try {
    const converted = convertUnitValue(
      params.purchaseQuantity,
      params.purchaseUnitId,
      params.baseUnitId,
      params.conversions
    );
    if (!Number.isFinite(converted.value) || converted.value <= 0) return null;
    return params.purchaseCost / converted.value;
  } catch {
    // Incompatible units (no conversion path) → nothing to normalize to.
    return null;
  }
}