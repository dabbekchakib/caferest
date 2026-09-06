// Pure stocktake calculation engine (no imports outside this module so it runs
// standalone under `node --test`, mirroring src/lib/receiving/calculations).
//
// These functions MUST stay in sync with `reconcile_stocktake` of
// supabase/migrations/00000000000052_phase_16_stocktake_rpc.sql — the DB is
// the authority, this module is for previews, tests and the UI.

export const QTY_STEP = 1e-6;

/** Round to 6 decimals (numeric(.,6) server-side convention). */
export function round6(value: number): number {
  return Math.round(value / QTY_STEP) * QTY_STEP;
}

/** A single movement row reduced to its signed base quantity. */
export interface SignedMovement {
  direction: "in" | "out";
  baseQuantity: number | null;
}

/** Signed contribution of one movement (+in / −out), 0 when no base unit. */
export function signedMovementQuantity(movement: SignedMovement): number {
  const base = movement.baseQuantity ?? 0;
  return movement.direction === "out" ? -base : base;
}

/** The theoretical quantity at validation: snapshot ± movements since start. */
export function expectedQuantity(
  snapshotQuantity: number,
  movements: number
): number {
  return Math.max(round6(snapshotQuantity + movements), 0);
}

/** variance = counted − expected (NOT rounded at the endpoint; caller rounds). */
export function varianceQuantity(
  countedQuantity: number,
  expectedQuantity: number
): number {
  return countedQuantity - expectedQuantity;
}

/**
 * Percentage variance with the DB convention:
 *   0 / 0  → 0,  x / 0  → 100,  otherwise counted/expected − 1.
 */
export function variancePercentage(
  countedQuantity: number,
  expected: number
): number {
  if (expected === 0 && countedQuantity === 0) return 0;
  if (expected === 0) return 100;
  return ((countedQuantity - expected) / expected) * 100;
}

/** Monetary valuation of a line variance at the given live unit cost. */
export function varianceValue(
  countedQuantity: number,
  expected: number,
  unitCost: number
): number {
  return round6((countedQuantity - expected) * unitCost);
}

/** Aggregated reconciliation for one item (see recompute in the RPC). */
export interface StocktakeItemResult {
  movementsQuantity: number | null;
  expectedQuantity: number | null;
  varianceQuantity: number | null;
  variancePercentage: number | null;
  varianceValue: number | null;
}

/**
 * Pure mirror of the `reconcile_stocktake` RPC for one item. Pass the signed
 * Σ(movements since started_at, excluding the stocktake's own adjustments).
 */
export function reconcileItem(
  snapshotQuantity: number,
  signedMovements: number,
  countedQuantity: number | null,
  unitCost: number
): StocktakeItemResult {
  const expected = expectedQuantity(snapshotQuantity, signedMovements);
  const counted = countedQuantity;
  if (counted === null) {
    return {
      movementsQuantity: round6(signedMovements),
      expectedQuantity: expected,
      varianceQuantity: null,
      variancePercentage: null,
      varianceValue: null,
    };
  }
  const variance = varianceQuantity(counted, expected);
  return {
    movementsQuantity: round6(signedMovements),
    expectedQuantity: expected,
    varianceQuantity: round6(variance),
    variancePercentage: round6(variancePercentage(counted, expected)),
    varianceValue: varianceValue(counted, expected, unitCost),
  };
}

/** Rolls across all counted + reconciled lines. */
export interface StocktakeRolls {
  totalCount: number;
  countedCount: number;
  pendingCount: number;
  varianceCount: number;
  surplusCount: number;
  missingCount: number;
  surplusValue: number;
  missingValue: number;
  netValue: number;
  maxVariancePercent: number;
}

/** Shape of a stock line reduced to the fields the summary needs. */
export interface RollableItem {
  counted_quantity: number | null;
  expected_quantity: number | null;
  variance_value: number | null;
  variance_percentage: number | null;
}

export function summarizeStocktake(items: RollableItem[]): StocktakeRolls {
  const rolls: StocktakeRolls = {
    totalCount: items.length,
    countedCount: 0,
    pendingCount: 0,
    varianceCount: 0,
    surplusCount: 0,
    missingCount: 0,
    surplusValue: 0,
    missingValue: 0,
    netValue: 0,
    maxVariancePercent: 0,
  };

  for (const item of items) {
    if (item.counted_quantity === null) {
      rolls.pendingCount += 1;
      continue;
    }
    rolls.countedCount += 1;
    const expected = item.expected_quantity ?? 0;
    const variance = item.counted_quantity - expected;
    if (variance !== 0) {
      rolls.varianceCount += 1;
      if (variance > 0) {
        rolls.surplusCount += 1;
        rolls.surplusValue = round6(rolls.surplusValue + (item.variance_value ?? 0));
      } else {
        rolls.missingCount += 1;
        rolls.missingValue = round6(
          rolls.missingValue + (item.variance_value ?? 0)
        );
      }
    }
    const pct = Math.abs(item.variance_percentage ?? 0);
    if (pct > rolls.maxVariancePercent) rolls.maxVariancePercent = pct;
  }

  rolls.netValue = round6(rolls.surplusValue + rolls.missingValue);
  return rolls;
}

/** Severity classification of a line variance against the configurable gates. */
export type VarianceSeverity = "none" | "warning" | "approval";

export function varianceSeverity(
  variancePercentage: number | null,
  varianceValue: number | null,
  thresholds: {
    warningPercentage: number;
    approvalPercentage: number;
    warningValue: number;
  }
): VarianceSeverity {
  const pct = Math.abs(variancePercentage ?? 0);
  const value = Math.abs(varianceValue ?? 0);
  if (
    pct > thresholds.approvalPercentage ||
    (thresholds.warningValue > 0 && value > thresholds.warningValue)
  ) {
    return "approval";
  }
  if (
    (pct !== 0 && pct > thresholds.warningPercentage) ||
    (thresholds.warningValue > 0 && value > thresholds.warningValue)
  ) {
    return "warning";
  }
  return "none";
}

// ---------------------------------------------------------------------------
// Idempotence / reference helpers (keep the spec-formula literals testable)
// ---------------------------------------------------------------------------

/** INV-YYYY-NNNNNN check used by the DB constraint `stocktakes_number_check`. */
export function isValidStocktakeNumber(number: string): boolean {
  return /^INV-[0-9]{4}-[0-9]{6}$/.test(number);
}

/** Build the movement reference label used for stocktake adjustments. */
export function adjustmentReason(stocktakeNumber: string): string {
  return `Stocktake ${stocktakeNumber}`;
}