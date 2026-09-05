import { test } from "node:test";
import assert from "node:assert/strict";
import {
  yieldOutputsPerBatch,
  effectiveYieldRate,
  consumptionPerOutput,
  consumptionEstimate,
  productionFor,
  normalizeAvailable,
  productionEstimate,
} from "../src/lib/yields/calculations";
import { validateYieldDefinition, isRangeOrdered } from "../src/lib/yields/validation";
import { isYieldType, YIELD_TYPES } from "../src/lib/yields/types";
import { formatYieldQuantity, formatYieldCount } from "../src/lib/yields/formatter";
import { convertUnitValue } from "../src/lib/units/conversions";
import type { UnitConversion } from "../src/lib/units/types";
import {
  PERMISSION_MODULES,
  PERMISSION_SLUGS,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../src/lib/authorization/permissions";
import { recipeYieldDeleteSchema } from "../src/validations/yields";

function conv(
  id: string,
  from: string,
  to: string,
  factor: number,
  offset = 0
): UnitConversion {
  return {
    id,
    establishment_id: null,
    from_unit_id: from,
    to_unit_id: to,
    factor,
    offset_value: offset,
    is_system: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

const weightEdges: UnitConversion[] = [
  conv("1", "kg", "g", 1000),
  conv("2", "g", "mg", 1000),
  conv("3", "L", "ml", 1000),
];

const none: UnitConversion[] = [];

function approx(actual: number | null, expected: number, eps = 1e-9): void {
  assert.ok(actual !== null, `expected ${expected}, got null`);
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${expected}, got ${actual}`
  );
}

test("YIELD_TYPES exposes the five canonical models", () => {
  assert.equal(YIELD_TYPES.length, 5);
  assert.equal(isYieldType("percentage_yield"), true);
  assert.equal(isYieldType("linear_yield"), false);
});

// ---------------------------------------------------------------------------
// yieldOutputsPerBatch
// ---------------------------------------------------------------------------

test("exact model: one batch produces a fixed output count", () => {
  const def = {
    yieldType: "exact_consumption" as const,
    inputQuantity: 0.5,
    inputUnitId: "L",
    outputQuantity: 10,
    outputUnitId: "verre",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  assert.deepEqual(yieldOutputsPerBatch(def), { count: 10, unitId: "verre" });
});

test("batch model: outputs-per-batch independant of the selection", () => {
  const def = {
    yieldType: "batch_yield" as const,
    inputQuantity: 5,
    inputUnitId: "L",
    outputQuantity: 50,
    outputUnitId: "btl",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  assert.deepEqual(yieldOutputsPerBatch(def, "min"), {
    count: 50,
    unitId: "btl",
  });
  assert.deepEqual(yieldOutputsPerBatch(def, "max"), {
    count: 50,
    unitId: "btl",
  });
});

test("range model: selection picks the edge (min/standard/max)", () => {
  const def = {
    yieldType: "range_yield" as const,
    inputQuantity: 1,
    inputUnitId: "kg",
    outputQuantity: null,
    outputUnitId: "cup",
    minimumYield: 70,
    standardYield: 85,
    maximumYield: 100,
    yieldPercentage: null,
  };
  assert.equal(yieldOutputsPerBatch(def, "min")?.count, 70);
  assert.equal(yieldOutputsPerBatch(def, "standard")?.count, 85);
  assert.equal(yieldOutputsPerBatch(def, "max")?.count, 100);
});

test("portion model: outputs depend on the portion count", () => {
  const def = {
    yieldType: "portion_yield" as const,
    inputQuantity: 1,
    inputUnitId: "gâteau",
    outputQuantity: 12,
    outputUnitId: "part",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  assert.deepEqual(yieldOutputsPerBatch(def), { count: 12, unitId: "part" });
});

test("percentage model has no discrete output count", () => {
  const def = {
    yieldType: "percentage_yield" as const,
    inputQuantity: 1,
    inputUnitId: "kg",
    outputQuantity: null,
    outputUnitId: "kg",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: 70,
  };
  assert.equal(yieldOutputsPerBatch(def), null);
});

test("outputsPerBatch is null when the count is unknown or unitless", () => {
  assert.equal(yieldOutputsPerBatch({ ...blank("batch_yield"), outputQuantity: 0 }), null);
  assert.equal(yieldOutputsPerBatch({ ...blank("batch_yield"), outputUnitId: null }), null);
});

// ---------------------------------------------------------------------------
// consumptionPerOutput (+ the Mojito reference from the spec)
// ---------------------------------------------------------------------------

test("mojito reference: 500 ml rhum for 10 verres → 50 ml/verre", () => {
  const def = {
    yieldType: "exact_consumption" as const,
    inputQuantity: 0.5,
    inputUnitId: "L",
    outputQuantity: 10,
    outputUnitId: "verre",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  approx(consumptionPerOutput(def), 0.05);
  approx(
    convertUnitValue(consumptionPerOutput(def)!, "L", "ml", weightEdges).value,
    50
  );
});

test("batch: 5 L sirop → 50 bouteilles of 100 ml ⇒ 100 ml by bottle", () => {
  const def = {
    yieldType: "batch_yield" as const,
    inputQuantity: 5,
    inputUnitId: "L",
    outputQuantity: 50,
    outputUnitId: "btl",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  approx(consumptionPerOutput(def), 0.1);
  approx(
    convertUnitValue(consumptionPerOutput(def)!, "L", "ml", weightEdges).value,
    100
  );
});

test("range: 1 kg → 85 cups ⇒ ~11.7647 g per cup (precision preserved)", () => {
  const def = rangeDef(1, 70, 85, 100);
  approx(
    consumptionPerOutput(def, "standard"),
    1 / 85,
    1e-12
  );
  approx(
    convertUnitValue(consumptionPerOutput(def, "standard")!, "kg", "g", weightEdges).value,
    1000 / 85,
    1e-9
  );
  approx(
    convertUnitValue(consumptionPerOutput(def, "min")!, "kg", "g", weightEdges).value,
    1000 / 70,
    1e-9
  );
  approx(
    convertUnitValue(consumptionPerOutput(def, "max")!, "kg", "g", weightEdges).value,
    1000 / 100,
    1e-9
  );
});

test("portion: 1 gâteau → 12 parts ⇒ 1/12 gâteau per part", () => {
  const def = portionDef(1, 12);
  approx(consumptionPerOutput(def), 1 / 12);
});

test("percentage: 1 kg @70% ⇒ 1/0.70 input per 1 usable output", () => {
  const def = percentageDef(1, 70);
  approx(consumptionPerOutput(def), 1 / 0.7);
});

test("consumption is null on zero/negative or missing input", () => {
  const base = rangeDef(1, 70, 85, 100);
  assert.equal(consumptionPerOutput({ ...base, inputQuantity: 0 }), null);
  assert.equal(consumptionPerOutput({ ...base, inputQuantity: -2 }), null);
  assert.equal(consumptionPerOutput({ ...base, inputQuantity: null }), null);
});

test("consumptionEstimate covers min/standard/max (range)", () => {
  const e = consumptionEstimate(rangeDef(1, 70, 85, 100));
  approx(e.min ?? 0, 1 / 70);
  approx(e.standard ?? 0, 1 / 85);
  approx(e.max ?? 0, 1 / 100);
  assert.equal(e.percentage, null);
});

test("consumptionEstimate exposes the percentage ratio", () => {
  const e = consumptionEstimate(percentageDef(1, 70));
  assert.equal(e.min, null);
  approx(e.percentage ?? 0, 1 / 0.7);
});

// ---------------------------------------------------------------------------
// productionFor — the production projector
// ---------------------------------------------------------------------------

test("5 kg of coffee → 425 standard cups (85 / kg)", () => {
  approx(productionFor(rangeDef(1, 70, 85, 100), 5, "kg", weightEdges), 425);
  approx(productionFor(rangeDef(1, 70, 85, 100), 5, "kg", weightEdges, "min"), 350);
  approx(productionFor(rangeDef(1, 70, 85, 100), 5, "kg", weightEdges, "max"), 500);
});

test("available quantity is normalized when its unit is convertible", () => {
  // 5000 g available → 5 kg → 425 cups.
  approx(productionFor(rangeDef(1, 70, 85, 100), 5000, "g", weightEdges), 425);
  // weight vs volume (no edges) → null.
  assert.equal(productionFor(rangeDef(1, 70, 85, 100), 5, "L", weightEdges), null);
});

test("normalizeAvailable returns null on unknown units", () => {
  approx(normalizeAvailable(rangeDef(1, 70, 85, 100), 5, "kg", weightEdges)!, 5);
  assert.equal(normalizeAvailable(rangeDef(1, 70, 85, 100), 5, "L", weightEdges), null);
});

test("batch production: 20 L sirop → 200 bouteilles", () => {
  const def = {
    yieldType: "batch_yield" as const,
    inputQuantity: 5,
    inputUnitId: "L",
    outputQuantity: 50,
    outputUnitId: "btl",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
  approx(productionFor(def, 20, "L", none), 200);
});

test("percentage production: 2 kg fruit @70% → 1.4 kg of pulp", () => {
  approx(productionFor(percentageDef(1, 70), 2, "kg", none), 1.4);
  approx(effectiveYieldRate(percentageDef(1, 70))!, 0.7);
  assert.equal(effectiveYieldRate(rangeDef(1, 70, 85, 100)), null);
});

test("productionEstimate surfaces the resolved model + selection", () => {
  const e = productionEstimate(rangeDef(1, 70, 85, 100), 5, "kg", weightEdges, "max");
  assert.equal(e.selection, "max");
  assert.equal(e.inputUnitId, "kg");
  assert.equal(e.outputUnitId, "cup");
  approx(e.production ?? 0, 500);
});

// ---------------------------------------------------------------------------
// validateYieldDefinition — model semantics + catalog compatibility
// ---------------------------------------------------------------------------

test("validation rejects zero/negative quantities and bad percentage", () => {
  // Negative input on an otherwise-incomplete exact definition reports BOTH
  // the sign error and the missing output (model incomplete).
  assert.deepEqual(
    validateYieldDefinition({ ...blank("exact_consumption"), inputQuantity: -1 }),
    ["positiveInput", "modelIncomplete"]
  );
  assert.deepEqual(
    validateYieldDefinition({ ...blank("exact_consumption"), outputQuantity: 0 }),
    ["positiveOutput", "modelIncomplete"]
  );
  assert.deepEqual(
    validateYieldDefinition({ ...blank("percentage_yield"), yieldPercentage: 150 }),
    ["percentageRange"]
  );
});

test("range model requires min/standard/max fields", () => {
  assert.deepEqual(validateYieldDefinition({ ...blank("range_yield"), inputQuantity: 1, minimumYield: 70, standardYield: 85 }), ["modelIncomplete"]);
});

test("range ordering violation (min > max) is flagged", () => {
  const issues = validateYieldDefinition({ ...rangeDef(1, 100, 85, 70) });
  assert.ok(issues.includes("invalidRange"));
  assert.equal(isRangeOrdered(100, 85, 70), false);
  assert.equal(isRangeOrdered(70, 85, 100), true);
});

test("exact/batch/portion require both input and output", () => {
  assert.ok(validateYieldDefinition({ ...blank("batch_yield"), inputQuantity: 5 }).includes("modelIncomplete"));
  assert.ok(validateYieldDefinition({ ...blank("portion_yield"), outputQuantity: 12 }).includes("modelIncomplete"));
});

test("percentage_yield requires the percentage", () => {
  assert.deepEqual(validateYieldDefinition({ ...blank("percentage_yield"), inputQuantity: 1 }), ["modelIncomplete"]);
});

test("input and output units never need to be convertible (kg → cups)", () => {
  // Espresso scenario: mass input vs count output — the production math never
  // couples both sides, so unit families are NOT checked against each other.
  const def = {
    ...blank("range_yield"),
    inputQuantity: 1,
    inputUnitId: "kg",
    minimumYield: 70,
    standardYield: 85,
    maximumYield: 100,
    outputUnitId: "cup",
  };
  assert.deepEqual(validateYieldDefinition(def), []);
});

test("valid range definition passes cleanly", () => {
  assert.deepEqual(validateYieldDefinition(rangeDef(1, 70, 85, 100)), []);
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

test("formatYieldQuantity formats with up to 3 decimals + unit symbol", () => {
  assert.equal(formatYieldQuantity(11.7647, "g", "fr-FR"), "11,765\u202Fg");
  assert.equal(formatYieldQuantity(50, "ml", "en-US"), "50\u202Fml");
  assert.equal(formatYieldQuantity(null, "g"), "—");
});

test("formatYieldCount rounds to whole outputs", () => {
  assert.equal(formatYieldCount(425.6, "en-US"), "426");
  assert.equal(formatYieldCount(null), "—");
});

// ---------------------------------------------------------------------------
// RBAC catalog parity (module + slugs + role matrix)
// ---------------------------------------------------------------------------

test("recipe_yields is a registered module with four slugs", () => {
  assert.ok(PERMISSION_MODULES.includes("recipe_yields" as never));
  for (const slug of [
    "recipe_yields.view",
    "recipe_yields.create",
    "recipe_yields.update",
    "recipe_yields.delete",
  ]) {
    assert.ok(PERMISSION_SLUGS.includes(slug as never), `missing ${slug}`);
  }
});

test("role matrix grants the full yield workflow to manager, view to staff", () => {
  const manager = SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager;
  for (const slug of ["recipe_yields.view", "recipe_yields.create", "recipe_yields.update", "recipe_yields.delete"]) {
    assert.ok(manager.includes(slug as never), `manager misses ${slug}`);
  }
  for (const role of ["stock_manager", "purchasing", "kitchen", "bar", "accountant"] as const) {
    const matrix = SYSTEM_ROLE_DEFAULT_PERMISSIONS[role];
    assert.ok(matrix.includes("recipe_yields.view" as never), `${role} misses view`);
    assert.ok(!matrix.includes("recipe_yields.create" as never), `${role} should not create`);
  }
});

// ---------------------------------------------------------------------------
// Action payload schema (recipe yield deletion)
// ---------------------------------------------------------------------------

test("delete schema requires a valid recipeId + server-owned establishmentId", () => {
  const recipeId = "11111111-1111-4111-8111-111111111111";
  const establishmentId = "22222222-2222-4222-8222-222222222222";

  const ok = recipeYieldDeleteSchema.safeParse({
    recipeId,
    establishmentId,
  });
  assert.equal(ok.success, true);

  const missingEst = recipeYieldDeleteSchema.safeParse({ recipeId });
  assert.equal(missingEst.success, false);

  const badRecipe = recipeYieldDeleteSchema.safeParse({
    recipeId: "not-a-uuid",
    establishmentId,
  });
  assert.equal(badRecipe.success, false);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function blank(type: (typeof YIELD_TYPES)[number]) {
  return {
    yieldType: type,
    inputQuantity: null,
    inputUnitId: null,
    outputQuantity: null,
    outputUnitId: null,
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
}

function rangeDef(input: number, min: number, std: number, max: number) {
  return {
    yieldType: "range_yield" as const,
    inputQuantity: input,
    inputUnitId: "kg",
    outputQuantity: null,
    outputUnitId: "cup",
    minimumYield: min,
    standardYield: std,
    maximumYield: max,
    yieldPercentage: null,
  };
}

function portionDef(input: number, portions: number) {
  return {
    yieldType: "portion_yield" as const,
    inputQuantity: input,
    inputUnitId: "gâteau",
    outputQuantity: portions,
    outputUnitId: "part",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: null,
  };
}

function percentageDef(input: number, pct: number) {
  return {
    yieldType: "percentage_yield" as const,
    inputQuantity: input,
    inputUnitId: "kg",
    outputQuantity: null,
    outputUnitId: "kg",
    minimumYield: null,
    standardYield: null,
    maximumYield: null,
    yieldPercentage: pct,
  };
}