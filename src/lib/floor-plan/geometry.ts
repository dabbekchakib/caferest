import type { DiningTable, DiningTableFloorPatch } from "../tables/types";
import { TABLE_MIN_SIZE } from "../tables/status";

/** Virtual canvas size of the floor plan (CSS pixels at zoom 1). */
export const FLOOR_PLAN_SIZE = 1200;

/** Base snapping step for placement. */
export const FLOOR_PLAN_SNAP = 20;

/** Snapping step applied when holding Shift. */
export const FLOOR_PLAN_FINE_SNAP = 5;

export function snapToGrid(value: number, step: number = FLOOR_PLAN_SNAP): number {
  return Math.round(value / step) * step;
}

/** Clamp a numeric value into an inclusive range (rounding to int). */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Normalize a rotation angle to [0, 360). */
export function clampRotation(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Snap a rotation to the nearest 15° step. */
export function snapRotation(value: number): number {
  return clampRotation(Math.round(value / 15) * 15);
}

/** Keep a coordinate inside the virtual canvas bounds. */
export function withinCanvas(value: number, size?: number): number {
  const limit = FLOOR_PLAN_SIZE - (size ?? 0);
  return Math.min(Math.max(0, Math.round(value)), Math.max(0, limit));
}

/** Geometry box of a table in virtual pixels (top-left anchored). */
export interface TableBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function tableBox(table: DiningTable): TableBox {
  const width =
    table.width != null ? Math.max(TABLE_MIN_SIZE, table.width) : 0;
  const height =
    table.height != null ? Math.max(TABLE_MIN_SIZE, table.height) : width;
  return {
    x: table.position_x ?? 0,
    y: table.position_y ?? 0,
    width,
    height,
    rotation: table.rotation ?? 0,
  };
}

/** Center point of a table box (rotation-agnostic anchor). */
export function tableCenter(box: TableBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clamp a dimension to the minimum size. */
export function clampDimension(value: number): number {
  return Math.max(TABLE_MIN_SIZE, Math.round(value));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Two axis-aligned rectangles overlap check (used for collision feedback). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export interface TablePatchResult {
  valid: boolean;
  reason?: "size" | "rotation" | "bounds";
  patches: DiningTableFloorPatch[];
}

/**
 * Validate + normalize a set of floor plan patches before persisting them.
 * Size must respect the minimum, rotation must stay in [0, 360] and every
 * position must live inside the virtual canvas (when provided).
 */
export function normalizeFloorPatches(
  patches: DiningTableFloorPatch[]
): TablePatchResult {
  const normalized: DiningTableFloorPatch[] = [];

  for (const patch of patches) {
    if (
      patch.width != null &&
      (patch.width < TABLE_MIN_SIZE || patch.width > FLOOR_PLAN_SIZE)
    )
      return { valid: false, reason: "size", patches: [] };
    if (
      patch.height != null &&
      (patch.height < TABLE_MIN_SIZE || patch.height > FLOOR_PLAN_SIZE)
    )
      return { valid: false, reason: "size", patches: [] };
    if (
      patch.rotation != null &&
      (patch.rotation < 0 || patch.rotation > 360)
    )
      return { valid: false, reason: "rotation", patches: [] };
    if (
      patch.positionX != null &&
      (patch.positionX < 0 || patch.positionX > FLOOR_PLAN_SIZE)
    )
      return { valid: false, reason: "bounds", patches: [] };
    if (
      patch.positionY != null &&
      (patch.positionY < 0 || patch.positionY > FLOOR_PLAN_SIZE)
    )
      return { valid: false, reason: "bounds", patches: [] };

    normalized.push({
      tableId: patch.tableId,
      areaId: patch.areaId,
      positionX: patch.positionX,
      positionY: patch.positionY,
      width: patch.width,
      height: patch.height,
      rotation: patch.rotation,
    });
  }

  return { valid: true, patches: normalized };
}