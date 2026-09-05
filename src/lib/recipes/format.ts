import { formatCost } from "../ingredients/formatters";

/** Formats a recipe raw cost in TND, or a placeholder when unknown. */
export function formatRecipeCost(
  value: number | null,
  locale: string
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${formatCost(value, locale)} TND`;
}

/** Formats an ICMP recipe quantity/label compactly. */
export function formatRecipeQuantityLabel(
  quantity: number,
  unitSymbol: string | null,
  locale: string
): string {
  if (unitSymbol) {
    return `${formatCost(quantity, locale)} ${unitSymbol}`;
  }
  return formatCost(quantity, locale);
}
