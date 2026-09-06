import type { Database } from "@/types/database";

export type Stocktake =
  Database["public"]["Tables"]["stocktakes"]["Row"];
export type StocktakeItem =
  Database["public"]["Tables"]["stocktake_items"]["Row"];
export type StocktakeStatusHistory =
  Database["public"]["Tables"]["stocktake_status_history"]["Row"];
export type StockMovement =
  Database["public"]["Tables"]["stock_movements"]["Row"];
export type StocktakeStatus =
  Database["public"]["Tables"]["stocktakes"]["Row"]["status"];
export type StocktakeMode =
  Database["public"]["Tables"]["stocktakes"]["Row"]["mode"];
export type StocktakeItemCountStatus = StocktakeItem["count_status"];

/** Stock scope offered by the create form / start RPC. */
export type StocktakeScope = "all" | "stocked" | "selected";

/** How the item(s) of the count page are filtered. */
export type CountFilter = "all" | "pending" | "counted" | "variance" | "reviewed";

/** A stock line after enrichment with ingredient + unit names for display. */
export interface StocktakeItemWithRelations
  extends StocktakeItem {
  ingredientName: string | null;
  ingredientSku: string | null;
  baseUnitSymbol: string | null;
  countUnitSymbol: string | null;
}

/** A full stocktake with its lines + status history (RLS: stocktakes.view). */
export interface StocktakeWithRelations extends Stocktake {
  locationName: string | null;
  locationCode: string | null;
  createdByName: string | null;
  startedByName: string | null;
  completedByName: string | null;
  approvedByName: string | null;
  validatedByName: string | null;
  cancelledByName: string | null;
  items: StocktakeItemWithRelations[];
  history: StocktakeStatusHistory[];
  summary: StocktakeSummary;
}

/** Rolls aggregated after reconciliation (review/detail panels). */
export interface StocktakeSummary {
  totalCount: number;
  pendingCount: number;
  countedCount: number;
  varianceCount: number;
  surplusCount: number;
  missingCount: number;
  surplusValue: number;
  missingValue: number;
  netValue: number;
  maxVariancePercent: number;
}

export interface StocktakeFilters {
  query?: string | null;
  locationId?: string | null;
  mode?: StocktakeMode | null;
  status?: StocktakeStatus | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  pageSize?: number;
}

/** Row used by the list (no items/history/summary but per-line counters). */
export interface StocktakeListItem
  extends Omit<StocktakeWithRelations, "items" | "history" | "summary"> {
  totalLines: number;
  countedLines: number;
}

export interface StocktakePageResult {
  items: StocktakeListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Write inputs mirrored by src/validations/stocktakes.ts. */
export interface CreateStocktakeInput {
  establishmentId: string;
  inventoryLocationId: string;
  mode: StocktakeMode;
  notes: string | null;
}

export interface StartStocktakeInput {
  establishmentId: string;
  stocktakeId: string;
  scope: StocktakeScope;
  includeZeroStock: boolean;
  ingredientIds: string[];
}

export interface StocktakeCountInput {
  establishmentId: string;
  stocktakeId: string;
  itemId: string;
  amount: number | null;
  unitId: string | null;
}

export interface StocktakeActionInput {
  stocktakeId: string;
  reason?: string | null;
}

export interface StocktakeThresholds {
  warningPercentage: number;
  approvalPercentage: number;
  approvalValue: number;
  warningValue: number;
}