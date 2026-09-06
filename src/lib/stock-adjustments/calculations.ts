// Client-side helpers to mirror the server-side arithmetic of the adjustment
// RPCs. The DB always recomputes totals at submit; these only render previews.
import type {
  StockAdjustmentItemWithRelations,
  StockAdjustmentSummary,
  StockAdjustmentThresholds,
} from "./types";

/** Round to the currency precision used across the app. */
export function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

/** Line value: base (stock unit) quantity × unit cost. */
export function lineTotalCost(baseQuantity: number, unitCost: number): number {
  return round6(baseQuantity * unitCost);
}

export function lineTotalQuantity(
  baseQuantity: number,
  baseUnitSymbol: string | null
): string {
  return `${round3(baseQuantity)} ${baseUnitSymbol ?? ""}`;
}

/** Roll a summary from the current (possibly unpersisted) line list. */
export function stockAdjustmentTotals(
  items: Pick<StockAdjustmentItemWithRelations, "base_quantity" | "unit_cost">[]
): StockAdjustmentSummary {
  let totalQuantity = 0;
  let totalValue = 0;
  for (const item of items) {
    totalQuantity += item.base_quantity;
    totalValue += lineTotalCost(item.base_quantity, item.unit_cost);
  }
  return {
    itemCount: items.length,
    totalQuantity: round3(totalQuantity),
    totalValue: round3(totalValue),
  };
}

/**
 * Mirror of the RPC gate: a submission requires approval when the setting is on
 * OR the evaluated value strictly exceeds the configured value threshold.
 */
export function adjustmentRequiresApproval(
  thresholds: StockAdjustmentThresholds,
  totalValue: number
): boolean {
  if (thresholds.requireApproval) return true;
  return (
    thresholds.approvalThresholdValue > 0 &&
    totalValue > thresholds.approvalThresholdValue
  );
}

/** Remaining book stock for a line (pure preview; RPC re-checks under lock). */
export function adjustmentAvailableQuantity(
  stockQuantity: number,
  baseQuantity: number
): number {
  return round3(stockQuantity - baseQuantity);
}

export function adjustmentHasEnoughStock(
  stockQuantity: number,
  baseQuantity: number
): boolean {
  return stockQuantity >= baseQuantity;
}

/** "PER-YYYY-NNNNNN" shape used by the numbering function. */
const STOCK_ADJUSTMENT_NUMBER_RE = /^PER-\d{4}-\d{6}$/;

export function isValidStockAdjustmentNumber(value: string): boolean {
  return STOCK_ADJUSTMENT_NUMBER_RE.test(value);
}