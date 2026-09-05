// NOTE: relative imports keep the pure helpers runnable under `node --test`.
import { formatCost } from "../ingredients/formatters";

/** Display precision of yield figures (storage stays unrounded). */
export const YIELD_MAX_DECIMALS = 3;

/**
 * Locale-aware formatting of a yield quantity (consumption, output counts...).
 * The optional unit symbol is appended with a narrow no-break space.
 */
export function formatYieldQuantity(
  value: number | null,
  unitSymbol: string | null,
  locale: string = "fr-FR"
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const label = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: YIELD_MAX_DECIMALS,
  }).format(value);
  return unitSymbol ? `${label}\u202F${unitSymbol}` : label;
}

/** Formats a production count (whole output units). */
export function formatYieldCount(
  value: number | null,
  locale: string = "fr-FR"
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats a theoretical cost per output in TND (3 decimals). */
export function formatYieldCost(
  value: number | null,
  locale: string = "fr-FR"
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${formatCost(value, locale)}\u00A0TND`;
}