/**
 * Pure presentation helpers for the ingredient catalog.
 * Money formatting is locale-aware and mirrors `src/lib/format.ts`.
 */

export const INGREDIENT_COST_MAX_DECIMALS = 3;
export const INGREDIENT_WASTE_MAX_DECIMALS = 0;
export const INGREDIENT_QUANTITY_MAX_DECIMALS = 3;

/** Formats a raw numeric cost with grouping and ≤3 decimals (no currency symbol). */
export function formatCost(value: number, locale = "fr"): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: INGREDIENT_COST_MAX_DECIMALS,
  }).format(value);
}

/** Formats a quantity (purchase quantity / cost-per-base-unit base). */
export function formatIngredientQuantity(value: number, locale = "fr"): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: INGREDIENT_QUANTITY_MAX_DECIMALS,
  }).format(value);
}

/** Formats a waste percentage (0–100, no unit). */
export function formatWaste(value: number, locale = "fr"): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: INGREDIENT_WASTE_MAX_DECIMALS,
  }).format(value);
}

/** Parses a user-typed decimal (accepts comma or dot as separator). */
export function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** True when `value` is a finite number ≥ 0 (defensive check before insert). */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** True when `value` is a finite number > 0. */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}