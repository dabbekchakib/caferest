/**
 * Pure yield / rendement domain types.
 *
 * Keep this module free of `server-only` and `@/` imports so it can run
 * inside the `node --test` build (see tsconfig.tests.json) as well as in
 * client components for the builder live preview.
 */

export const YIELD_TYPES = [
  "exact_consumption",
  "batch_yield",
  "range_yield",
  "portion_yield",
  "percentage_yield",
] as const;

export type YieldType = (typeof YIELD_TYPES)[number];

export function isYieldType(value: unknown): value is YieldType {
  return (
    typeof value === "string" &&
    (YIELD_TYPES as readonly string[]).includes(value)
  );
}

/** Canonical production models understood by the engine. */
export const YIELD_TYPE_LABELS: Record<YieldType, string> = {
  exact_consumption: "exact_consumption",
  batch_yield: "batch_yield",
  range_yield: "range_yield",
  portion_yield: "portion_yield",
  percentage_yield: "percentage_yield",
};

/**
 * Structural snapshot of a yield definition (independent from the Supabase
 * Row shape so the engine stays pure and trivially testable).
 */
export interface YieldDefinition {
  yieldType: YieldType;
  /** Batch input size, expressed in `inputUnitId` (1, 5, 0.5 ...). */
  inputQuantity: number | null;
  inputUnitId: string | null;
  /** Nominal outputs produced from ONE input batch (glasses, bottles...). */
  outputQuantity: number | null;
  outputUnitId: string | null;
  /** Range edges for `range_yield` (same unit as the outputs). */
  minimumYield: number | null;
  standardYield: number | null;
  maximumYield: number | null;
  /** Loss/processing percentage for `percentage_yield` (0 < x ≤ 100). */
  yieldPercentage: number | null;
  isActive?: boolean;
}

/** The range selection used to compute a specific estimate. */
export type YieldSelection = "min" | "standard" | "max";

/** Output count of ONE batch, together with the unit it is expressed in. */
export interface YieldOutput {
  count: number;
  unitId: string;
}

/**
 * Theoretical consumption of the INPUT quantity that produces ONE standard
 * output (per cup, per glass, per portion), still expressed in the input unit.
 */
export interface ConsumptionEstimate {
  inputUnitId: string;
  min: number | null;
  standard: number | null;
  max: number | null;
  /** For percentage_yield: 100 / percentage (input needed for 1 output). */
  percentage: number | null;
}

/** Result of the production projector (given an available quantity + unit). */
export interface ProductionEstimate {
  availableUnitId: string;
  inputUnitId: string | null;
  outputUnitId: string | null;
  selection: YieldSelection;
  production: number | null;
}