import type {
  DiningTableShape,
  DiningTableStatus,
} from "./types";

export const DINING_TABLE_STATUSES: readonly DiningTableStatus[] = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "disabled",
  "blocked",
];

export const DINING_TABLE_SHAPES: readonly DiningTableShape[] = [
  "round",
  "square",
  "rectangle",
];

export interface TableStatusMeta {
  value: DiningTableStatus;
  /** Badge variant used by the lists and the floor plan legend. */
  badge: "success" | "warning" | "danger" | "info" | "muted";
}

export const TABLE_STATUS_META: Record<DiningTableStatus, TableStatusMeta> = {
  available: { value: "available", badge: "success" },
  occupied: { value: "occupied", badge: "info" },
  reserved: { value: "reserved", badge: "warning" },
  cleaning: { value: "cleaning", badge: "info" },
  disabled: { value: "disabled", badge: "muted" },
  blocked: { value: "blocked", badge: "danger" },
};

/** Default leg / furniture size on the floor plan (virtual pixels). */
export const TABLE_DEFAULT_WIDTH = 90;
export const TABLE_DEFAULT_HEIGHT = 90;
export const TABLE_MIN_SIZE = 50;

export function isDiningTableStatus(
  value: unknown
): value is DiningTableStatus {
  return (
    typeof value === "string" &&
    (DINING_TABLE_STATUSES as readonly string[]).includes(value)
  );
}

export function isDiningTableShape(value: unknown): value is DiningTableShape {
  return (
    typeof value === "string" &&
    (DINING_TABLE_SHAPES as readonly string[]).includes(value)
  );
}

/** Default status when a new table is created without an explicit value. */
export const DEFAULT_TABLE_STATUS: DiningTableStatus = "available";

/** Static i18n keys (namespace `tables`) for the status values — keeps the
 *  next-intl lookups fully typed like the other feature modules. */
export const TABLE_STATUS_LABEL_KEYS: Record<DiningTableStatus, string> = {
  available: "status.available",
  occupied: "status.occupied",
  reserved: "status.reserved",
  cleaning: "status.cleaning",
  disabled: "status.disabled",
  blocked: "status.blocked",
};

export const TABLE_SHAPE_LABEL_KEYS: Record<DiningTableShape, string> = {
  round: "shape.round",
  square: "shape.square",
  rectangle: "shape.rectangle",
};