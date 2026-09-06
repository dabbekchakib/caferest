import type { Database } from "@/types/database";

export type GoodsReceipt = Database["public"]["Tables"]["goods_receipts"]["Row"];
export type GoodsReceiptItem =
  Database["public"]["Tables"]["goods_receipt_items"]["Row"];
export type GoodsReceiptStatusHistory =
  Database["public"]["Tables"]["goods_receipt_status_history"]["Row"];
export type StockMovement =
  Database["public"]["Tables"]["stock_movements"]["Row"];
export type StockItem = Database["public"]["Tables"]["stock_items"]["Row"];

export type GoodsReceiptStatus = GoodsReceipt["status"];

/**
 * A receipt line exactly as the client sends it. Quantities come from the
 * user; prices, discounts, taxes and the unit conversion are snapshots taken
 * by the atomic RPC from the linked purchase order — never trusted here.
 */
export interface GoodsReceiptLineInput {
  purchaseOrderItemId: string;
  ingredientId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  lotNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface GoodsReceiptWriteInput {
  purchaseOrderId: string;
  receiptDate: Date | null;
  inventoryLocationId: string | null;
  deliveryNoteNumber: string | null;
  supplierInvoiceNumber: string | null;
  notes: string | null;
  internalNotes: string | null;
  items: GoodsReceiptLineInput[];
}

export interface GoodsReceiptWithRelations extends GoodsReceipt {
  supplierName: string | null;
  supplierCode: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  purchaseOrderNumber: string | null;
  purchaseOrderStatus: string | null;
  currencyCode: string | null;
  locationName: string | null;
  locationCode: string | null;
  receivedByName: string | null;
  validatedByName: string | null;
  createdByName: string | null;
  items: GoodsReceiptLineWithRelations[];
  history: GoodsReceiptStatusHistory[];
}

export interface GoodsReceiptLineWithRelations extends GoodsReceiptItem {
  ingredientName: string | null;
  ingredientSku: string | null;
  purchaseUnitSymbol: string | null;
  stockUnitSymbol: string | null;
}

export interface GoodsReceiptFilters {
  query?: string | null;
  purchaseOrderId?: string | null;
  supplierId?: string | null;
  status?: GoodsReceiptStatus | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  pageSize?: number;
}

export interface GoodsReceiptPageResult {
  items: Array<Omit<GoodsReceiptWithRelations, "items" | "history">>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** A purchase-order object fit for the receipt builder (pick of PO + PO line). */
export interface ReceivablePurchaseLine {
  id: string;
  ingredientId: string | null;
  ingredientName: string | null;
  description: string | null;
  supplierSku: string | null;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  purchaseUnitId: string | null;
  purchaseUnitSymbol: string | null;
  baseUnitId: string | null;
  baseUnitSymbol: string | null;
  isStockTracked: boolean;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  sortOrder: number;
}

export interface ReceivablePurchaseOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  currencyCode: string;
  remainingCount: number;
  lines: ReceivablePurchaseLine[];
}