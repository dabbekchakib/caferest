/**
 * Pure presentation helpers for the product catalog.
 * Money formatting is locale-aware and mirrors `src/lib/format.ts`.
 */

export const PRODUCT_PRICE_MAX_DECIMALS = 3;

/** Formats a raw numeric price with grouping and ≤3 decimals (no currency symbol). */
export function formatPrice(value: number, locale = "fr"): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: PRODUCT_PRICE_MAX_DECIMALS,
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