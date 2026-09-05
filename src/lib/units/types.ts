import type {
  Database,
  UnitType,
} from "@/types/database";

export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type UnitConversion =
  Database["public"]["Tables"]["unit_conversions"]["Row"];

export { UnitType };

/** Ordered chain of stored edges traversed to convert A -> B. */
export interface ConversionPath {
  fromUnitId: string;
  toUnitId: string;
  /** One entry per hop, with the direction-aware factor/offset already baked in. */
  steps: ConversionStep[];
}

/** A single hop of a conversion path (direction-aware). */
export interface ConversionStep {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
  offset: number;
}

export interface ConversionResult {
  value: number;
  path: ConversionPath;
}

/** Every stored (system + establishment) edge for an establishment scope. */
export interface UnitCatalog {
  units: Unit[];
  conversions: UnitConversion[];
}