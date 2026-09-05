// NOTE: relative import keeps the pure engine runnable under `node --test`
// (the test build does not resolve `@/` aliases at runtime).
import { AuthorizationError } from "../authorization/errors";
import type {
  ConversionPath,
  ConversionResult,
  ConversionStep,
  UnitConversion,
} from "./types";

export const MAX_CONVERSION_DEPTH = 8;

interface DirectedEdge {
  step: ConversionStep;
}

/**
 * Build the directed adjacency list for an oriented conversion graph.
 * Stored edges are one-directional (A -> B); the reverse direction is derived
 * from the stored affine mapping  B = A * factor + offset  without storing it,
 * which keeps the table free of duplicate reverse rows and guarantees the
 * reverse parameterization matches the forward one.
 */
function adjacency(conversions: UnitConversion[]): Map<string, DirectedEdge[]> {
  const graph = new Map<string, DirectedEdge[]>();

  const add = (from: string, to: DirectedEdge) => {
    const list = graph.get(from) ?? [];
    list.push(to);
    graph.set(from, list);
  };

  for (const c of conversions) {
    if (!c.is_active) continue;
    const factor = Number(c.factor);
    const offset = Number(c.offset_value);
    // Forward traversal uses the stored affine mapping.
    add(c.from_unit_id, {
      step: { id: c.id, fromUnitId: c.from_unit_id, toUnitId: c.to_unit_id, factor, offset },
    });
    // Reverse traversal derives  B = A * factor + offset <=> A = (B - offset) / factor
    // without ever storing a second row.
    const invFactor = factor === 0 ? 0 : 1 / factor;
    const invOffset = factor === 0 ? 0 : -offset / factor;
    add(c.to_unit_id, {
      step: { id: c.id, fromUnitId: c.to_unit_id, toUnitId: c.from_unit_id, factor: invFactor, offset: invOffset },
    });
  }

  return graph;
}

/**
 * BFS for the shortest conversion path between two units.
 * Cycle-safe (visited set) and depth-capped. Returns null when the units are
 * incompatible (no path exists between them in the oriented graph).
 */
export function findConversionPath(
  fromUnitId: string,
  toUnitId: string,
  conversions: UnitConversion[],
  maxDepth: number = MAX_CONVERSION_DEPTH
): ConversionPath | null {
  if (fromUnitId === toUnitId) {
    return { fromUnitId, toUnitId, steps: [] };
  }

  const graph = adjacency(conversions);
  const queue: { id: string; steps: ConversionStep[] }[] = [
    { id: fromUnitId, steps: [] },
  ];
  const visited = new Set<string>([fromUnitId]);

  while (queue.length > 0) {
    const { id, steps } = queue.shift()!;

    if (steps.length >= maxDepth) continue;

    const neighbors = graph.get(id) ?? [];
    for (const neighbor of neighbors) {
      const nextSteps = [...steps, neighbor.step];
      if (neighbor.step.toUnitId === toUnitId) {
        return { fromUnitId, toUnitId, steps: nextSteps };
      }
      if (visited.has(neighbor.step.toUnitId)) continue;
      visited.add(neighbor.step.toUnitId);
      queue.push({ id: neighbor.step.toUnitId, steps: nextSteps });
    }
  }

  return null;
}

/** Apply a path to a raw value: each step maps  value = value * factor + offset. */
function applyPath(value: number, path: ConversionPath): number {
  return path.steps.reduce(
    (out, step) => out * step.factor + step.offset,
    value
  );
}

export interface ConversionOptions {
  /** Custom limit; defaults to MAX_CONVERSION_DEPTH. */
  maxDepth?: number;
}

/**
 * Convert `value` expressed in `fromUnitId` into `toUnitId`.
 *
 * Throws `INCOMPATIBLE_UNITS` when the two units belong to different
 * compatibility groups (no path in the oriented graph), and `UNIT_SCOPE`
 * when the units are the same but no valid determination can be made is not
 * possible (defensive). Supply `options.maxDepth` to tighten the search.
 */
export function convertUnitValue(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  conversions: UnitConversion[],
  options: ConversionOptions = {}
): ConversionResult {
  if (!Number.isFinite(value)) {
    throw new AuthorizationError("GENERIC", "invalid_quantity_value");
  }

  const maxDepth = options.maxDepth ?? MAX_CONVERSION_DEPTH;
  const path = findConversionPath(fromUnitId, toUnitId, conversions, maxDepth);
  if (!path) {
    throw new AuthorizationError(
      "INCOMPATIBLE_UNITS",
      "incompatible_units"
    );
  }

  return { value: applyPath(value, path), path };
}

/** Cheap boolean answer for "can these two units interoperate?". */
export function isConvertible(
  fromUnitId: string,
  toUnitId: string,
  conversions: UnitConversion[]
): boolean {
  return fromUnitId === toUnitId || findConversionPath(fromUnitId, toUnitId, conversions) !== null;
}

/** Minimal structural edge enough for pair detection. */
export interface EdgeLike {
  id?: string;
  from_unit_id: string;
  to_unit_id: string;
}

/** True when the edge already exists in either direction. */
export function hasConversion(
  fromUnitId: string,
  toUnitId: string,
  conversions: EdgeLike[],
  excludingId?: string
): boolean {
  return conversions.some(
    (c) =>
      c.id !== excludingId &&
      ((c.from_unit_id === fromUnitId && c.to_unit_id === toUnitId) ||
        (c.from_unit_id === toUnitId && c.to_unit_id === fromUnitId))
  );
}

/** Round a quantity to the display precision of the target unit. */
export function roundToPrecision(value: number, precision: number): number {
  const places = Math.max(0, Math.min(Math.trunc(precision), 12));
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}