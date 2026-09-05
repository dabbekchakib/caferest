import type { Database } from "@/types/database";

export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type SupplierContact =
  Database["public"]["Tables"]["supplier_contacts"]["Row"];
export type IngredientSupplier =
  Database["public"]["Tables"]["ingredient_suppliers"]["Row"];
export type SupplierPriceHistory =
  Database["public"]["Tables"]["supplier_price_history"]["Row"];

/**
 * Normalized purchase cost: the price expressed per single base (storage)
 * unit of the ingredient, e.g. 70 TND / kg → 0.070 TND / g. `null` means the
 * cost could not be normalized (missing units or incompatible conversions).
 */
export interface NormalizedPurchaseCost {
  /** Cost of ONE base unit of the ingredient in `currencyCode`. */
  amount: number;
  baseUnitId: string | null;
  baseUnitSymbol: string | null;
  /** Short human-readable summary of the conversion path, when available. */
  pathLabel: string | null;
}

/** Supplier row enriched for list/detail views. */
export interface SupplierWithRelations extends Supplier {
  contacts: SupplierContact[];
  /** Number of active catalog entries (ingredient_suppliers). */
  catalogCount: number;
  /** True when the supplier is the preferred one for ANY ingredient. */
  hasPreferredItems: boolean;
}

/** One supplier-catalog entry enriched for the ingredient & detail views. */
export interface SupplierCatalogItem extends IngredientSupplier {
  ingredientName: string;
  ingredientSlug: string;
  supplierName: string;
  supplierCode: string | null;
  purchaseUnitSymbol: string | null;
  normalizedCost: NormalizedPurchaseCost | null;
}

/** Price-history row enriched with the unit/current snapshot. */
export interface SupplierPriceHistoryEntry extends SupplierPriceHistory {
  ingredientName: string;
  purchaseUnitSymbol: string | null;
}

/** Per-ingredient comparison built from every supplier of the catalog. */
export interface SupplierComparisonEntry {
  ingredientId: string;
  ingredientName: string;
  baseUnitSymbol: string | null;
  offers: Array<{
    supplierId: string;
    supplierName: string;
    supplierCode: string | null;
    purchasePrice: number;
    purchaseQuantity: number;
    purchaseUnitId: string | null;
    purchaseUnitSymbol: string | null;
    currencyCode: string;
    normalizedCost: NormalizedPurchaseCost | null;
    isPreferred: boolean;
  }>;
}

export interface SupplierPageResult {
  items: SupplierWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SupplierCounts {
  total: number;
  active: number;
  preferred: number;
}