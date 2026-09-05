import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatusHistory,
  PurchaseOrderStatus,
  PurchaseOrderWithRelations,
  PurchaseOrderPageResult,
  PurchaseOrderLineInput,
} from "@/lib/purchases/types";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function enrichOrders(
  rows: Array<PurchaseOrder & { suppliers?: unknown }>
): Promise<Array<Omit<PurchaseOrderWithRelations, "items" | "history">>> {
  if (rows.length === 0) return [];
  return rows.map((row) => {
    const supplier = (Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers) as
      | { name: string | null; code: string | null }
      | null
      | undefined;
    return {
      ...row,
      supplierName: supplier?.name ?? null,
      supplierCode: supplier?.code ?? null,
    };
  });
}

/** Full order with its lines + status history (RLS requires purchases.view). */
export async function getPurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<PurchaseOrderWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name, code)")
    .eq("establishment_id", establishmentId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const listItem = await enrichOrders([
    data as PurchaseOrder & { suppliers?: unknown },
  ]).then((rows) => rows[0] ?? null);
  if (!listItem) return null;

  const [itemsRes, historyRes] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("purchase_order_status_history")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error) throw new AuthorizationError("GENERIC", itemsRes.error.message);
  if (historyRes.error)
    throw new AuthorizationError("GENERIC", historyRes.error.message);

  return {
    ...listItem,
    items: (itemsRes.data ?? []) as PurchaseOrderItem[],
    history: (historyRes.data ?? []) as PurchaseOrderStatusHistory[],
  };
}

export async function getPurchaseOrdersPage(
  establishmentId: string,
  options: {
    page?: number;
    pageSize?: number;
    query?: string | null;
    supplierId?: string | null;
    status?: PurchaseOrderStatus | null;
    fromDate?: string | null;
    toDate?: string | null;
  } = {}
): Promise<PurchaseOrderPageResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("purchase_orders")
      .select("*, suppliers(name, code)")
      .eq("establishment_id", establishmentId);

  const baseCount = () =>
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId);

  type OrderQuery = ReturnType<typeof base>;

  const applyFilters = (query: OrderQuery): OrderQuery => {
    if (options.supplierId) query = query.eq("supplier_id", options.supplierId);
    if (options.status) query = query.eq("status", options.status);
    const text = options.query?.trim();
    if (text) query = query.or(`order_number.ilike.%${text}%`);
    if (options.fromDate) query = query.gte("order_date", options.fromDate);
    if (options.toDate) query = query.lte("order_date", options.toDate);
    return query;
  };

  const { count, error: countError } = await applyFilters(baseCount());
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  const { data, error } = await applyFilters(base())
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const items = await enrichOrders(
    (data ?? []) as Array<PurchaseOrder & { suppliers?: unknown }>
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lightweight unpaged list for selectors/dashboards. */
export async function listPurchaseOrders(
  establishmentId: string,
  options: { limit?: number; statuses?: PurchaseOrderStatus[] } = {}
): Promise<PurchaseOrder[]> {
  const supabase = await createClient();
  let query = supabase
    .from("purchase_orders")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("order_date", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  }
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as PurchaseOrder[];
}

export async function getPurchaseOrderCounts(
  establishmentId: string
): Promise<Partial<Record<PurchaseOrderStatus, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const counts: Partial<Record<PurchaseOrderStatus, number>> = {};
  for (const row of data ?? []) {
    const status = row.status as PurchaseOrderStatus;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/** Next sequential order number preview (BC-YYYY-NNNNNN) from the DB. */
export async function nextPurchaseOrderNumberPreview(
  establishmentId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_purchase_order_number", {
    p_est: establishmentId,
  });
  if (error) throw toAuthorizationError(error);
  return (data ?? "") as string;
}

// ---------------------------------------------------------------------------
// Writes (always through the atomic security-definer RPCs)
// ---------------------------------------------------------------------------

export interface PurchaseOrderWriteInput {
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  currencyCode: string;
  notes: string | null;
  internalNotes: string | null;
  supplierNotes: string | null;
  shippingAddress: string | null;
  billingAddress: string | null;
  shippingAmount: number;
  otherCharges: number;
  items: PurchaseOrderLineInput[];
}

function toItemsJsonb(
  items: PurchaseOrderLineInput[]
): Record<string, unknown>[] {
  return items.map((item) => ({
    ingredient_id: item.ingredientId,
    ingredient_supplier_id: item.ingredientSupplierId,
    description: item.description ?? null,
    supplier_sku: item.supplierSku ?? null,
    quantity: item.quantity,
    purchase_unit_id: item.purchaseUnitId ?? null,
    unit_price: item.unitPrice,
    discount_type: item.discountType,
    discount_value: item.discountValue,
    tax_id: item.taxId ?? null,
    tax_rate: item.taxRate,
    notes: item.notes ?? null,
    sort_order: item.sortOrder,
  }));
}

export async function createPurchaseOrder(
  establishmentId: string,
  input: PurchaseOrderWriteInput
): Promise<PurchaseOrderWithRelations> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_est: establishmentId,
    p_supplier_id: input.supplierId,
    p_order_date: input.orderDate.toISOString(),
    p_expected_delivery_date: input.expectedDeliveryDate
      ? input.expectedDeliveryDate.toISOString()
      : null,
    p_currency_code: input.currencyCode,
    p_notes: input.notes ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_supplier_notes: input.supplierNotes ?? null,
    p_shipping_address: input.shippingAddress ?? null,
    p_billing_address: input.billingAddress ?? null,
    p_shipping_amount: input.shippingAmount,
    p_other_charges: input.otherCharges,
    p_items: toItemsJsonb(input.items),
  });
  if (error) throw toAuthorizationError(error);

  const order = await getPurchaseOrder(establishmentId, data as string);
  if (!order) {
    throw new AuthorizationError("PURCHASE_ORDER_NOT_FOUND");
  }
  return order;
}

export async function updatePurchaseOrder(
  establishmentId: string,
  orderId: string,
  input: PurchaseOrderWriteInput
): Promise<PurchaseOrderWithRelations> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
    p_supplier_id: input.supplierId,
    p_order_date: input.orderDate.toISOString(),
    p_expected_delivery_date: input.expectedDeliveryDate
      ? input.expectedDeliveryDate.toISOString()
      : null,
    p_currency_code: input.currencyCode,
    p_notes: input.notes ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_supplier_notes: input.supplierNotes ?? null,
    p_shipping_address: input.shippingAddress ?? null,
    p_billing_address: input.billingAddress ?? null,
    p_shipping_amount: input.shippingAmount,
    p_other_charges: input.otherCharges,
    p_items: toItemsJsonb(input.items),
  });
  if (error) throw toAuthorizationError(error);

  const order = await getPurchaseOrder(establishmentId, orderId);
  if (!order) {
    throw new AuthorizationError("PURCHASE_ORDER_NOT_FOUND");
  }
  return order;
}

export async function deletePurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function duplicatePurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
  return data as string;
}

export async function submitPurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function approvePurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function sendPurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function cancelPurchaseOrder(
  establishmentId: string,
  orderId: string,
  reason: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
    p_reason: reason ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function closePurchaseOrder(
  establishmentId: string,
  orderId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_purchase_order", {
    p_est: establishmentId,
    p_order_id: orderId,
  });
  if (error) throw toAuthorizationError(error);
}