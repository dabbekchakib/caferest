/**
 * Types métier du module POS — types purs uniquement (aucun code runtime).
 */

export type SaleType = "dine_in" | "takeaway" | "delivery" | "counter";

/** Statuts de commande (miroir du CHECK orders_status_check). */
export type PosOrderStatus =
  | "draft"
  | "open"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  barcode: string | null;
  sku: string | null;
  isAvailable: boolean;
  imageUrl: string | null;
  taxRate: number;
}

export interface PosCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosCatalog {
  categories: PosCategory[];
  products: PosProduct[];
}

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

export interface OrderTotals {
  quantity: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export interface PosSettings {
  allowDiscount: boolean;
  requireConfirmation: boolean;
  allowNegativeStock: boolean;
}

export interface PosOrderCreateResult {
  id: string;
  orderNumber: string;
  status: PosOrderStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export interface PosOrderItemRow {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
}

export interface PosOrderSummary {
  id: string;
  orderNumber: string;
  status: PosOrderStatus;
  orderType: SaleType;
  tableId: string | null;
  tableNumber: string | null;
  diningAreaId: string | null;
  diningAreaName: string | null;
  customerId: string | null;
  customerName: string | null;
  serverName: string | null;
  notes: string | null;
  itemsCount: number;
  quantity: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  heldAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosOrderDetail extends PosOrderSummary {
  items: PosOrderItemRow[];
}

export interface PosTableRef {
  id: string;
  tableNumber: string;
  diningAreaId: string | null;
  diningAreaName: string | null;
  status: string;
  capacity: number | null;
}

export interface PosAreaRef {
  id: string;
  name: string;
  tables: PosTableRef[];
}

/** Événement de la timeline d'une commande (order_status_history). */
export interface PosOrderStatusEvent {
  id: string;
  status: PosOrderStatus;
  fromStatus: PosOrderStatus | null;
  userName: string | null;
  reason: string | null;
  createdAt: string;
}

/** Événement readonly (rayonnement de l'historique depuis la DB). */
export type PosOrderStatusEventRow = Omit<
  PosOrderStatusEvent,
  "userName"
> & { userName?: string | null };

/** Page de commandes (liste filtrable / paginable). */
export interface PosOrderListResult {
  items: PosOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}