import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertUnitValue,
  findConversionPath,
  isConvertible,
  hasConversion,
  roundToPrecision,
} from "../src/lib/units/conversions";
import { formatQuantity, formatCount } from "../src/lib/units/formatter";
import type { Unit, UnitConversion } from "../src/lib/units/types";
import { AuthorizationError } from "../src/lib/authorization/errors";

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

const metricEdges: UnitConversion[] = [
  conv("1", "kg", "g", 1000),
  conv("2", "g", "mg", 1000),
  conv("3", "L", "ml", 1000),
  conv("4", "cl", "ml", 10),
];

function unit(symbol: string, type: Unit["type"], precision = 2): Unit {
  return {
    id: symbol,
    establishment_id: null,
    name: symbol,
    symbol,
    category: "weight",
    type,
    slug: symbol,
    description: null,
    precision,
    is_base: false,
    is_system: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

test("direct conversion kg -> g", () => {
  const res = convertUnitValue(2.5, "kg", "g", metricEdges);
  assert.equal(res.value, 2500);
  assert.equal(res.path.steps.length, 1);
});

test("inverse conversion is derived (g -> kg)", () => {
  const res = convertUnitValue(2500, "g", "kg", metricEdges);
  assert.equal(res.value, 2.5);
});

test("composite conversion through an intermediate (L -> cl)", () => {
  const res = convertUnitValue(1, "L", "cl", metricEdges);
  assert.ok(Math.abs(res.value - 100) < 1e-9, `got ${res.value}`);
  assert.equal(res.path.steps.length, 2);
});

test("incompatible units throw INCOMPATIBLE_UNITS", () => {
  assert.throws(
    () => convertUnitValue(1, "kg", "ml", metricEdges),
    (err) =>
      err instanceof AuthorizationError && err.code === "INCOMPATIBLE_UNITS"
  );
});

test("business conversion service -> volume is supported via explicit edge", () => {
  const edges = [...metricEdges, conv("5", "bottle", "ml", 700)];
  const res = convertUnitValue(2, "bottle", "ml", edges);
  assert.equal(res.value, 1400);
});

test("affine conversion (offset) and its derived inverse", () => {
  const f2c: UnitConversion[] = [
    { ...conv("6", "F", "C", 5 / 9, (-32 * 5) / 9), is_system: false },
  ];
  const c = convertUnitValue(212, "F", "C", f2c);
  assert.ok(Math.abs(c.value - 100) < 1e-9, `got ${c.value}`);
  const f = convertUnitValue(100, "C", "F", f2c);
  assert.ok(Math.abs(f.value - 212) < 1e-9, `got ${f.value}`);
});

test("cycle does not hang and still resolves", () => {
  const edges: UnitConversion[] = [
    conv("a", "A", "B", 2),
    conv("b", "B", "A", 0.5),
  ];
  const res = convertUnitValue(10, "A", "B", edges);
  assert.equal(res.value, 20);
  assert.equal(findConversionPath("A", "A", edges)?.steps.length, 0);
});

test("same unit conversion is a no-op path", () => {
  const path = findConversionPath("kg", "kg", metricEdges);
  assert.deepEqual(path, { fromUnitId: "kg", toUnitId: "kg", steps: [] });
});

test("isConvertible respects the graph", () => {
  assert.equal(isConvertible("kg", "mg", metricEdges), true);
  assert.equal(isConvertible("kg", "ml", metricEdges), false);
});

test("hasConversion detects either direction", () => {
  assert.equal(hasConversion("kg", "g", metricEdges), true);
  assert.equal(hasConversion("g", "kg", metricEdges), true);
  assert.equal(hasConversion("kg", "ml", metricEdges), false);
  assert.equal(
    hasConversion("kg", "g", metricEdges, "1"),
    false,
    "excluding the matching edge hides it"
  );
});

test("invalid (non-finite) quantity values throw", () => {
  assert.throws(() =>
    convertUnitValue(Number.NaN, "kg", "g", metricEdges)
  );
});

test("roundToPrecision clamps display precision", () => {
  assert.equal(roundToPrecision(12.3487, 2), 12.35);
  assert.equal(roundToPrecision(12.3487, 0), 12);
  assert.equal(roundToPrecision(5, 6), 5);
  assert.equal(roundToPrecision(1.2345678901234, 100), 1.234567890123);
});

test("formatQuantity uses unit precision and locale separators", () => {
  const g = unit("g", "mass", 2);
  assert.equal(formatQuantity(12.345, g, "fr-FR"), "12,35\u202Fg");
  assert.equal(formatQuantity(1000, unit("piece", "count", 0), "en-US"), "1,000\u202Fpiece");
});

test("formatQuantity without a symbol formats the bare number", () => {
  assert.equal(formatQuantity(42, null, "fr-FR"), "42");
});

test("formatCount renders whole numbers", () => {
  assert.equal(formatCount(1200, "en-US"), "1,200");
});