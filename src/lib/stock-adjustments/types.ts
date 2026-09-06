import type { Database } from "@/types/database";

export type StockAdjustment =
  Database["public"]["Tables"]["stock_adjustments"]["Row"];
export type StockAdjustmentItem =
  Database["public"]["Tables"]["stock_adjustment_items"]["Row"];
export type StockAdjustmentReason =
  Database["public"]["Tables"]["stock_adjustment_reasons"]["Row"];
export type StockAdjustmentStatusHistory =
  Database["public"]["Tables"]["stock_adjustment_status_history"]["Row"];
export type StockAdjustmentStatus = StockAdjustment["status"];
export type StockAdjustmentType = StockAdjustment["adjustment_type"];

/** A stock line after enrichment with ingredient + unit names for display. */
export interface StockAdjustmentItemWithRelations
  extends StockAdjustmentItem {
  ingredientName: string | null;
  ingredientSku: string | null;
  baseUnitSymbol: string | null;
  unitSymbol: string | null;
}

/** A full adjustment with its lines + status history (RLS: stock_adjustments.view). */
export interface StockAdjustmentWithRelations
  extends StockAdjustment {
  locationName: string | null;
  locationCode: string | null;
  reasonCode: string | null;
  reasonLabel: string | null;
  createdByName: string | null;
  submittedByName: string | null;
  approvedByName: string | null;
  validatedByName: string | null;
  cancelledByName: string | null;
  items: StockAdjustmentItemWithRelations[];
  history: StockAdjustmentStatusHistory[];
  summary: StockAdjustmentSummary;
}

/** Totals rolled client-side (server RPCs stay the authority at submit). */
export interface StockAdjustmentSummary {
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface StockAdjustmentFilters {
  query?: string | null;
  locationId?: string | null;
  type?: StockAdjustmentType | null;
  status?: StockAdjustmentStatus | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  pageSize?: number;
}

/** Row used by the list (no items/history/summary but a per-doc line count). */
export interface StockAdjustmentListItem
  extends Omit<StockAdjustmentWithRelations, "items" | "history" | "summary"> {
  totalLines: number;
}

export interface StockAdjustmentPageResult {
  items: StockAdjustmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Approval / separation rules resolved from the establishment settings. */
export interface StockAdjustmentThresholds {
  requireApproval: boolean;
  approvalThresholdValue: number;
  /** Reserved for the future recipe-consumption phase (not enforced yet). */
  approvalThresholdPercentage: number;
  requireSeparation: boolean;
}

/** One line passed to the atomic create RPC (quantity in any compatible unit). */
export interface CreateStockAdjustmentItemInput {
  ingredientId: string;
  quantity: number;
  unitId?: string | null;
}

/** Write inputs mirrored by src/validations/stock-adjustments.ts. */
export interface CreateStockAdjustmentInput {
  establishmentId: string;
  inventoryLocationId: string;
  adjustmentType: StockAdjustmentType;
  adjustmentDate: string;
  reasonId: string | null;
  notes: string | null;
  internalReference: string | null;
  items: CreateStockAdjustmentItemInput[];
}

export interface StockAdjustmentLineInput {
  establishmentId: string;
  adjustmentId: string;
  ingredientId: string;
  quantity: number;
  unitId: string | null;
}

export interface StockAdjustmentLineUpdateInput {
  establishmentId: string;
  adjustmentId: string;
  itemId: string;
  quantity: number;
  unitId: string | null;
}

export interface StockAdjustmentLineRemoveInput {
  establishmentId: string;
  adjustmentId: string;
  itemId: string;
}

export interface StockAdjustmentActionInput {
  adjustmentId: string;
  reason?: string | null;
}