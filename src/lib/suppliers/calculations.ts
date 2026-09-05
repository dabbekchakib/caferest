// NOTE: relative import keeps the pure engine runnable under `node --test`
// (the test build does not resolve `@/` aliases at runtime).
import { convertUnitValue } from "../units/conversions";
import type { UnitConversion } from "../units/types";
import type { NormalizedPurchaseCost } from "./types";

export interface NormalizedCostParams {
  /** Total price paid for `purchaseQuantity` of `purchaseUnitId`. */
  purchasePrice: number;
  /**
   * Quantity bought per purchase, expressed in `purchaseUnitId`
   * (e.g. 1 kg, 1 carton of 24, 10 pieces). Must be > 0.
   */
  purchaseQuantity: number;
  purchaseUnitId: string;
  /** Storage/recipe unit the price is normalized to (null → no normalizing). */
  baseUnitId: string | null;
  /** Active conversion catalog of the establishment (system + local). */
  conversions: UnitConversion[];
  baseUnitSymbol?: string | null;
}

/**
 * Normalized purchase cost = price of ONE base unit of the ingredient:
 *
 *    normalized = purchase_price / converted_quantity
 *
 * where `converted_quantity` is `purchaseQuantity` expressed in the base unit
 * through the OrientedGraph conversion engine:
 *   * 70 TND / 1 kg  of coffee          → 0.0700 TND / g       (kg → g)
 *   * 120 TND / 1 carton of 24 packages → 5.0000 TND / package (carton → piece)
 *   * 2.8 TND / 1 L of milk             → 0.0028 TND / ml      (L → ml)
 *
 * Returns null when the ingredient has no base unit, no purchase unit, or
 * when the two units are not convertible — never throws.
 */
export function calculateNormalizedPurchaseCost(
  params: NormalizedCostParams
): NormalizedPurchaseCost | null {
  if (
    !params.baseUnitId ||
    !params.purchaseUnitId ||
    !Number.isFinite(params.purchasePrice) ||
    !Number.isFinite(params.purchaseQuantity) ||
    params.purchaseQuantity <= 0 ||
    params.purchasePrice < 0
  ) {
    return null;
  }

  let amount: number;
  let pathLabel: string | null = null;

  if (params.purchaseUnitId === params.baseUnitId) {
    amount = params.purchasePrice / params.purchaseQuantity;
  } else {
    try {
      const converted = convertUnitValue(
        params.purchaseQuantity,
        params.purchaseUnitId,
        params.baseUnitId,
        params.conversions
      );
      if (!Number.isFinite(converted.value) || converted.value <= 0) {
        return null;
      }
      amount = params.purchasePrice / converted.value;
      const hopCount = converted.path.steps.length;
      pathLabel = hopCount > 0 ? `${hopCount} step(s)` : null;
    } catch {
      // Incompatible units (no conversion path) → nothing to normalize to.
      return null;
    }
  }

  return {
    amount,
    baseUnitId: params.baseUnitId,
    baseUnitSymbol: params.baseUnitSymbol ?? null,
    pathLabel,
  };
}