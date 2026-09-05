import type { Unit } from "./types";

const NBSP = "\u202F";

export type UnitLike = Pick<Partial<Unit>, "symbol" | "precision"> | null;

/** Locale-aware quantity formatting using the unit's own display precision. */
export function formatQuantity(
  value: number,
  unit: UnitLike | undefined,
  locale: string = "fr-FR"
): string {
  if (!Number.isFinite(value)) return `-`;

  const precision = Math.max(0, Math.min(Math.trunc(unit?.precision ?? 2), 6));
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(value);

  if (!unit?.symbol) return formatted;
  return `${formatted}${NBSP}${unit.symbol}`;
}

/** Whole-number style formatter used for counts (pieces, bottles...). */
export function formatCount(value: number, locale: string = "fr-FR"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}