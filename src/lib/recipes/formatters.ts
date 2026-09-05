import type { Unit } from "../units/types";
import { isConvertible } from "../units/conversions";
import type { UnitConversion } from "../units/types";

/**
 * Accepts a quantity string in any locale (comma or dot decimal separator) and
 * returns a finite number, or null when it is not a valid decimal.
 */
export function parseRecipeDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Filters the unit list down to the units compatible with an ingredient base
 * unit (used by the recipe-builder unit dropdown). Null base → all units.
 */
export function filterUnitsCompatibleWith(
  units: readonly Unit[],
  baseUnitId: string | null,
  conversions: UnitConversion[]
): Unit[] {
  if (!baseUnitId) return [...units];
  return units.filter((unit) => isConvertible(unit.id, baseUnitId, conversions));
}