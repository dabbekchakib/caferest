// NOTE: relative imports keep the pure engine runnable under `node --test`.
import { convertUnitValue, isConvertible } from "../units/conversions";
import type { UnitConversion } from "../units/types";

export interface NormalizeRecipeItemQuantityParams {
  /** Quantity as typed by the user, expressed in `unitId`. */
  quantity: number;
  /**
   * Unit the quantity is expressed in. When null the quantity is assumed to be
   * already expressed in the ingredient base unit.
   */
  unitId: string | null;
  /** Ingredient storage/recipe unit the quantity normalizes to. */
  baseUnitId: string | null;
  /** Active conversion catalog of the establishment (system + local). */
  conversions: UnitConversion[];
}

/**
 * Converts a recipe-item quantity into the ingredient's base unit through the
 * conversion engine. Returns the normalized value, or:
 *  - the raw quantity when `unitId` equals `baseUnitId` (no conversion needed),
 *  - null when the quantity is not finite, the base unit is missing, or the two
 *    units are incompatible (no conversion path).
 *
 * This is a *normalization* helper: it never mutates the stored row, it only
 * feeds the (preparatory) cost engine and the unit-compatibility screening.
 */
export function normalizeRecipeItemQuantity(
  params: NormalizeRecipeItemQuantityParams
): number | null {
  if (
    !Number.isFinite(params.quantity) ||
    params.quantity <= 0 ||
    !params.baseUnitId
  ) {
    return null;
  }

  if (!params.unitId || params.unitId === params.baseUnitId) {
    return params.quantity;
  }

  try {
    const converted = convertUnitValue(
      params.quantity,
      params.unitId,
      params.baseUnitId,
      params.conversions
    );
    return Number.isFinite(converted.value) && converted.value > 0
      ? converted.value
      : null;
  } catch {
    return null;
  }
}

/**
 * True when `candidateUnitId` is compatible with the ingredient base unit —
 * i.e. the conversion engine can find a path between them. Reused by the unit
 * dropdown of the recipe builder so the user can only pick units that make
 * sense for the selected ingredient (system + local conversions).
 */
export function isRecipeItemUnitCompatible(
  candidateUnitId: string | null,
  baseUnitId: string | null,
  conversions: UnitConversion[]
): boolean {
  if (!candidateUnitId || !baseUnitId) return true;
  if (candidateUnitId === baseUnitId) return true;
  return isConvertible(candidateUnitId, baseUnitId, conversions);
}