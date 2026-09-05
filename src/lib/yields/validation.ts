// NOTE: relative imports keep the pure engine runnable under `node --test`.
import type { YieldDefinition } from "./types";

/**
 * Domain-level validation of a yield definition. Returns the stable i18n keys
 * of every violation (empty array = valid). The Zod schema (validations/yields)
 * validates the SHAPE; this validates the MODEL semantics:
 *
 *   * each model requires its own fields (model-complete),
 *   * range ordering  min ≤ standard ≤ max,
 *   * quantities must be strictly positive.
 *
 * Unit compatibility is intentionally NOT enforced: the input and the outputs
 * live in different semantic spaces (e.g. 1 kg of espresso → 85 cups) and the
 * production math never couples them. Cross-establishment reference hygiene is
 * enforced by the RLS helper `recipe_yield_references_valid`.
 */
export function validateYieldDefinition(
  def: YieldDefinition
): string[] {
  const issues: string[] = [];
  const push = (key: string) => issues.push(key);

  if (def.inputQuantity !== null && def.inputQuantity <= 0) {
    push("positiveInput");
  }
  if (def.outputQuantity !== null && def.outputQuantity <= 0) {
    push("positiveOutput");
  }
  if (
    def.yieldPercentage !== null &&
    (def.yieldPercentage <= 0 || def.yieldPercentage > 100)
  ) {
    push("percentageRange");
  }

  if (def.yieldType === "percentage_yield") {
    if (def.yieldPercentage === null) push("modelIncomplete");
  } else if (def.yieldType === "range_yield") {
    if (
      def.inputQuantity === null ||
      def.minimumYield === null ||
      def.standardYield === null ||
      def.maximumYield === null
    ) {
      push("modelIncomplete");
    }
    if (
      def.minimumYield !== null &&
      def.standardYield !== null &&
      def.maximumYield !== null &&
      !(def.minimumYield <= def.standardYield && def.standardYield <= def.maximumYield)
    ) {
      push("invalidRange");
    }
  } else {
    // exact_consumption / batch_yield / portion_yield: input + output required.
    if (def.inputQuantity === null || def.outputQuantity === null) {
      push("modelIncomplete");
    }
  }

  return issues;
}

/** Pure ordering helper: true when min ≤ standard ≤ max (null sides tolerated). */
export function isRangeOrdered(
  min: number | null,
  standard: number | null,
  max: number | null
): boolean {
  if (min !== null && standard !== null && standard < min) return false;
  if (max !== null && standard !== null && standard > max) return false;
  if (min !== null && max !== null && min > max) return false;
  return true;
}