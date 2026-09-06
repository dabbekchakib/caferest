import type { Database } from "@/types/database";

export type DiningArea =
  Database["public"]["Tables"]["dining_areas"]["Row"];
export type DiningAreaTranslation =
  Database["public"]["Tables"]["dining_area_translations"]["Row"];
export type DiningTable = Database["public"]["Tables"]["tables"]["Row"];

export type DiningTableStatus = DiningTable["status"];
export type DiningTableShape = DiningTable["shape"];
export type DiningAreaLocale = "fr" | "en" | "ar";

export interface DiningAreaTranslationFields {
  name?: string | null;
  description?: string | null;
}

export interface DiningAreaTranslationInput
  extends DiningAreaTranslationFields {
  locale: DiningAreaLocale;
}

/** An area with its optional per-locale name/description overrides. */
export interface DiningAreaWithTranslations extends DiningArea {
  translations: Partial<
    Record<DiningAreaLocale, DiningAreaTranslationFields>
  >;
}

/** A table row enriched with its area display metadata for lists/floor plan. */
export interface DiningTableListItem extends DiningTable {
  areaName: string | null;
  areaSlug: string | null;
  areaColor: string | null;
}

export interface DiningAreaFilters {
  query?: string | null;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
}

export interface DiningAreaPageResult {
  items: DiningAreaWithTranslations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DiningTableFilters {
  query?: string | null;
  areaId?: string | null;
  status?: DiningTableStatus | null;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
}

export interface DiningTablePageResult {
  items: DiningTableListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DiningAreaCreateInput {
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  translations?: DiningAreaTranslationInput[];
}

export interface DiningAreaUpdateInput {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  translations?: DiningAreaTranslationInput[];
}

export interface DiningTableCreateInput {
  name: string;
  slug: string;
  tableNumber?: string | null;
  areaId?: string | null;
  capacity?: number;
  shape?: DiningTableShape;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number;
  color?: string | null;
  sortOrder?: number;
  status?: DiningTableStatus;
  isActive?: boolean;
}

export interface DiningTableUpdateInput {
  name?: string;
  slug?: string;
  tableNumber?: string | null;
  areaId?: string | null;
  capacity?: number;
  shape?: DiningTableShape;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number;
  color?: string | null;
  sortOrder?: number;
  status?: DiningTableStatus;
  isActive?: boolean;
}

/** One geometry/placement patch applied from the floor plan editor. */
export interface DiningTableFloorPatch {
  tableId: string;
  areaId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number;
}