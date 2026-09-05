// NOTE: relative imports keep the pure engine runnable under `node --test`
// (the test build does not resolve `@/` aliases at runtime).
import { convertUnitValue } from "../units/conversions";
import type { UnitConversion } from "../units/types";
import type {
  ConsumptionEstimate,
  ProductionEstimate,
  YieldDefinition,
  YieldOutput,
  YieldSelection,
} from "./types";

/**
 * Outputs produced by ONE input batch, for the models that define a countable
 * output (exact, batch, range, portion). Returns null for `percentage_yield`
 * (no discrete output count — the yield is a rate).
 *
 * Fallbacks keep legacy Phase-11 data coherent: `standardYield` acts as the
 * output count when `outputQuantity` is not set (and vice-versa).
 */
export function yieldOutputsPerBatch(
  def: YieldDefinition,
  selection: YieldSelection = "standard"
): YieldOutput | null {
  if (!def.outputUnitId) return null;

  if (def.yieldType === "percentage_yield") return null;

  const base =
    def.yieldType === "range_yield"
      ? selection === "min"
        ? def.minimumYield
        : selection === "max"
          ? def.maximumYield
          : def.standardYield
      : def.outputQuantity ?? def.standardYield;

  if (base === null || !Number.isFinite(base) || base <= 0) return null;
  return { count: base, unitId: def.outputUnitId };
}

/**
 * Effective yield rate for `percentage_yield` (e.g. 1 kg fruit at 70% →
 * 0.70 kg of usable pulp). Null otherwise.
 */
export function effectiveYieldRate(
  def: YieldDefinition
): number | null {
  if (def.yieldType !== "percentage_yield") return null;
  if (def.yieldPercentage === null || !Number.isFinite(def.yieldPercentage)) {
    return null;
  }
  if (def.yieldPercentage <= 0 || def.yieldPercentage > 100) return null;
  return def.yieldPercentage / 100;
}

/**
 * Theoretical input consumption required to produce ONE output unit/cup.
 *
 *   consumption = input_quantity / outputs_per_batch
 *
 * Example: range 1 kg → 85 standard cups ⇒ 1000 / 85 = 11.7647 g per cup.
 * For percentage_yield the consumption is a ratio: 1 unit of usable output
 * needs `1 / rate` input units (e.g. 70 % ⇒ 1.4286 input per output).
 */
export function consumptionPerOutput(
  def: YieldDefinition,
  selection: YieldSelection = "standard",
  _conversions: UnitConversion[] = []
): number | null {
  if (def.inputQuantity === null || !Number.isFinite(def.inputQuantity)) {
    return null;
  }
  if (def.inputQuantity <= 0) return null;

  if (def.yieldType === "percentage_yield") {
    const rate = effectiveYieldRate(def);
    if (rate === null) return null;
    return 1 / rate;
  }

  const output = yieldOutputsPerBatch(def, selection);
  if (!output) return null;
  return def.inputQuantity / output.count;
}

/**
 * Full consumption estimate for the preview (min / standard / max) in the
 * input unit, plus the percentage ratio when applicable.
 */
export function consumptionEstimate(
  def: YieldDefinition
): ConsumptionEstimate {
  if (def.yieldType === "percentage_yield") {
    const rate = effectiveYieldRate(def);
    return {
      inputUnitId: def.inputUnitId ?? "",
      min: null,
      standard: null,
      max: null,
      percentage: rate === null ? null : 1 / rate,
    };
  }

  const min = consumptionPerOutput(def, "min");
  const standard = consumptionPerOutput(def, "standard");
  const max = consumptionPerOutput(def, "max");

  return {
    inputUnitId: def.inputUnitId ?? "",
    min,
    standard,
    max,
    percentage: null,
  };
}

/**
 * Production projector: given `availableQuantity` expressed in
 * `availableUnitId`, how many CALIBRATED outputs can be produced?
 *
 *   production = normalized_available / input_quantity × outputs_per_batch
 *
 * Example: 5 kg of coffee at 85 cups/kg ⇒ 5 / 1 × 85 = 425 cups.
 * When the available quantity uses a different (but convertible) unit it is
 * normalized into the input unit first (5000 g → 5 kg).
 *
 * Throws `INCOMPATIBLE_UNITS` when `availableUnitId` cannot be expressed in
 * the input unit (delegated to the conversion engine).
 */
export function productionFor(
  def: YieldDefinition,
  availableQuantity: number,
  availableUnitId: string,
  conversions: UnitConversion[],
  selection: YieldSelection = "standard"
): number | null {
  if (!def.inputQuantity || def.inputQuantity <= 0) return null;
  if (!Number.isFinite(availableQuantity) || availableQuantity < 0) return null;

  const normalized = normalizeAvailable(
    def,
    availableQuantity,
    availableUnitId,
    conversions
  );
  if (normalized === null) return null;

  if (def.yieldType === "percentage_yield") {
    const rate = effectiveYieldRate(def);
    if (rate === null) return null;
    return normalized * rate;
  }

  const output = yieldOutputsPerBatch(def, selection);
  if (!output) return null;
  return (normalized / def.inputQuantity) * output.count;
}

/** Normalized available quantity expressed in the input unit (null when unsupported). */
export function normalizeAvailable(
  def: YieldDefinition,
  availableQuantity: number,
  availableUnitId: string,
  conversions: UnitConversion[]
): number | null {
  if (!def.inputUnitId) return null;
  if (def.inputUnitId === availableUnitId) return availableQuantity;
  if (!def.inputQuantity || def.inputQuantity <= 0) return null;

  try {
    const converted = convertUnitValue(
      availableQuantity,
      availableUnitId,
      def.inputUnitId,
      conversions
    );
    return Number.isFinite(converted.value) ? converted.value : null;
  } catch {
    return null;
  }
}

/** Production estimate shape used by the calculator UI. */
export function productionEstimate(
  def: YieldDefinition,
  availableQuantity: number,
  availableUnitId: string,
  conversions: UnitConversion[],
  selection: YieldSelection = "standard"
): ProductionEstimate {
  return {
    availableUnitId,
    inputUnitId: def.inputUnitId,
    outputUnitId: def.outputUnitId,
    selection,
    production: productionFor(
      def,
      availableQuantity,
      availableUnitId,
      conversions,
      selection
    ),
  };
}

export type { YieldDefinition, YieldOutput, YieldSelection };