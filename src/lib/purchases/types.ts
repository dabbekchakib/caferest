import type { Database } from "@/types/database";

export type PurchaseOrder =
  Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderItem =
  Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type PurchaseOrderStatusHistory =
  Database["public"]["Tables"]["purchase_order_status_history"]["Row"];

export type PurchaseOrderStatus = PurchaseOrder["status"];

/** Per-line discount mode (mirrors the DB `discount_type` CHECK). */
export type LineDiscountType = "none" | "percentage" | "fixed";

/**
 * A line exactly as the client sends it. Amounts are NEVER taken from the
 * client — the server recalcuates every value and the DB recomputes again.
 */
export interface PurchaseOrderLineInput {
  ingredientId: string;
  ingredientSupplierId: string;
  description: string | null;
  supplierSku: string | null;
  quantity: number;
  purchaseUnitId: string | null;
  unitPrice: number;
  discountType: LineDiscountType;
  discountValue: number;
  taxId: string | null;
  taxRate: number;
  notes: string | null;
  sortOrder: number;
}

/** Line money computed by the engine (gross − discount, then + tax). */
export interface PurchaseOrderLineTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/** Order money: lines aggregated + order-level shipping / other charges. */
export interface PurchaseOrderTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  otherCharges: number;
  total: number;
}

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  supplierName: string | null;
  supplierCode: string | null;
  items: PurchaseOrderItem[];
  history: PurchaseOrderStatusHistory[];
}

export interface PurchaseOrderFilters {
  query?: string | null;
  supplierId?: string | null;
  status?: PurchaseOrderStatus | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  pageSize?: number;
}

export interface PurchaseOrderPageResult {
  items: Array<Omit<PurchaseOrderWithRelations, "items" | "history">>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Invoice/address free text for the printable document. */
export interface PurchaseOrderAddressInfo {
  shippingAddress: string | null;
  billingAddress: string | null;
}