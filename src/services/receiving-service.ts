import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  GoodsReceiptStatusHistory,
  GoodsReceiptStatus,
  GoodsReceiptWithRelations,
  GoodsReceiptLineWithRelations,
  GoodsReceiptPageResult,
  GoodsReceiptLineInput,
  GoodsReceiptWriteInput,
  ReceivablePurchaseOrder,
} from "@/lib/receiving/types";
import type { Database } from "@/types/database";

type InventoryLocation = Database["public"]["Tables"]["inventory_locations"]["Row"];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function supplierRows(
  establishmentId: string,
  ids: string[]
): Promise<Map<string, { name: string | null; code: string | null }>> {
  const map = new Map<string, { name: string | null; code: string | null }>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, code")
    .eq("establishment_id", establishmentId)
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, { name: row.name, code: row.code });
  return map;
}

async function profileNameMap(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  for (const row of data ?? []) map.set(row.id, row.full_name);
  return map;
}

async function unitSymbolMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, symbol")
    .in("id", unique);
  for (const row of data ?? []) map.set(row.id, row.symbol);
  return map;
}

async function ingredientNameMap(
  establishmentId: string,
  ids: string[]
): Promise<Map<string, { name: string | null; sku: string | null }>> {
  const map = new Map<string, { name: string | null; sku: string | null }>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, sku")
    .eq("establishment_id", establishmentId)
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, { name: row.name, sku: row.sku });
  return map;
}

async function locationMap(
  establishmentId: string,
  ids: string[]
): Promise<Map<string, { name: string | null; code: string | null }>> {
  const map = new Map<string, { name: string | null; code: string | null }>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_locations")
    .select("id, name, code")
    .eq("establishment_id", establishmentId)
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, { name: row.name, code: row.code });
  return map;
}

async function purchaseOrderMap(
  establishmentId: string,
  ids: string[]
): Promise<
  Map<string, { order_number: string; status: string; currency_code: string }>
> {
  const map = new Map<
    string,
    { order_number: string; status: string; currency_code: string }
  >();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, order_number, status, currency_code")
    .eq("establishment_id", establishmentId)
    .in("id", ids);
  for (const row of data ?? []) {
    map.set(row.id, {
      order_number: row.order_number,
      status: row.status,
      currency_code: row.currency_code,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function enrichItems(
  establishmentId: string,
  items: GoodsReceiptItem[]
): Promise<GoodsReceiptLineWithRelations[]> {
  if (items.length === 0) return [];
  const [ingredients, units] = await Promise.all([
    ingredientNameMap(
      establishmentId,
      items.map((item) => item.ingredient_id)
    ),
    unitSymbolMap(
      items.flatMap((item) =>
        [item.purchase_unit_id, item.stock_unit_id].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
  ]);
  return items.map((item) => ({
    ...item,
    ingredientName: ingredients.get(item.ingredient_id)?.name ?? null,
    ingredientSku: ingredients.get(item.ingredient_id)?.sku ?? null,
    purchaseUnitSymbol: item.purchase_unit_id
      ? units.get(item.purchase_unit_id) ?? null
      : null,
    stockUnitSymbol: item.stock_unit_id ? units.get(item.stock_unit_id) ?? null : null,
  }));
}

interface GoodsReceiptEnrichContext {
  suppliers: Map<string, { name: string | null; code: string | null }>;
  orders: Map<string, { order_number: string; status: string; currency_code: string }>;
  locations: Map<string, { name: string | null; code: string | null }>;
  profiles: Map<string, string | null>;
}

async function enrichContext(
  establishmentId: string,
  rows: GoodsReceipt[]
): Promise<GoodsReceiptEnrichContext> {
  const [suppliers, orders, locations, profiles] = await Promise.all([
    supplierRows(
      establishmentId,
      rows.map((row) => row.supplier_id)
    ),
    purchaseOrderMap(
      establishmentId,
      rows.map((row) => row.purchase_order_id)
    ),
    locationMap(
      establishmentId,
      rows
        .map((row) => row.inventory_location_id)
        .filter((id): id is string => Boolean(id))
    ),
    profileNameMap(
      rows.flatMap((row) =>
        [row.received_by, row.validated_by, row.created_by].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
  ]);
  return { suppliers, orders, locations, profiles };
}

function toListItem(
  row: GoodsReceipt,
  ctx: GoodsReceiptEnrichContext
): Omit<GoodsReceiptWithRelations, "items" | "history"> {
  const supplier = ctx.suppliers.get(row.supplier_id);
  const order = ctx.orders.get(row.purchase_order_id);
  const location = row.inventory_location_id
    ? ctx.locations.get(row.inventory_location_id)
    : undefined;
  return {
    ...row,
    supplierName: supplier?.name ?? null,
    supplierCode: supplier?.code ?? null,
    supplierAddress: null,
    supplierPhone: null,
    purchaseOrderNumber: order?.order_number ?? null,
    purchaseOrderStatus: order?.status ?? null,
    currencyCode: order?.currency_code ?? null,
    locationName: location?.name ?? null,
    locationCode: location?.code ?? null,
    receivedByName: row.received_by ? ctx.profiles.get(row.received_by) ?? null : null,
    validatedByName: row.validated_by
      ? ctx.profiles.get(row.validated_by) ?? null
      : null,
    createdByName: row.created_by ? ctx.profiles.get(row.created_by) ?? null : null,
  };
}

/** Full receipt with its lines + status history (RLS requires goods_receipts.view). */
export async function getGoodsReceipt(
  establishmentId: string,
  receiptId: string
): Promise<GoodsReceiptWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", receiptId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const ctx = await enrichContext(establishmentId, [data as GoodsReceipt]);

  const [itemsRes, historyRes] = await Promise.all([
    supabase
      .from("goods_receipt_items")
      .select("*")
      .eq("goods_receipt_id", receiptId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("goods_receipt_status_history")
      .select("*")
      .eq("goods_receipt_id", receiptId)
      .order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error) throw new AuthorizationError("GENERIC", itemsRes.error.message);
  if (historyRes.error)
    throw new AuthorizationError("GENERIC", historyRes.error.message);

  const listItem = toListItem(data as GoodsReceipt, ctx);
  return {
    ...listItem,
    items: await enrichItems(
      establishmentId,
      (itemsRes.data ?? []) as GoodsReceiptItem[]
    ),
    history: (historyRes.data ?? []) as GoodsReceiptStatusHistory[],
  };
}

export async function getGoodsReceiptsPage(
  establishmentId: string,
  options: {
    page?: number;
    pageSize?: number;
    query?: string | null;
    purchaseOrderId?: string | null;
    supplierId?: string | null;
    status?: GoodsReceiptStatus | null;
    fromDate?: string | null;
    toDate?: string | null;
  } = {}
): Promise<GoodsReceiptPageResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));

  const supabase = await createClient();
  const base = () =>
    supabase.from("goods_receipts").select("*").eq("establishment_id", establishmentId);

  const baseCount = () =>
    supabase
      .from("goods_receipts")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId);

  type ReceiptQuery = ReturnType<typeof base>;

  const applyFilters = (query: ReceiptQuery): ReceiptQuery => {
    if (options.purchaseOrderId)
      query = query.eq("purchase_order_id", options.purchaseOrderId);
    if (options.supplierId) query = query.eq("supplier_id", options.supplierId);
    if (options.status) query = query.eq("status", options.status);
    const text = options.query?.trim();
    if (text) query = query.or(`receipt_number.ilike.%${text}%`);
    if (options.fromDate) query = query.gte("receipt_date", options.fromDate);
    if (options.toDate) query = query.lte("receipt_date", options.toDate);
    return query;
  };

  const { count, error: countError } = await applyFilters(baseCount());
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  const { data, error } = await applyFilters(base())
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as GoodsReceipt[];
  const ctx = await enrichContext(establishmentId, rows);

  return {
    items: rows.map((row) => toListItem(row, ctx)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lightweight unpaged list for selectors/dashboards. */
export async function listGoodsReceipts(
  establishmentId: string,
  options: { limit?: number; statuses?: GoodsReceiptStatus[] } = {}
): Promise<GoodsReceipt[]> {
  const supabase = await createClient();
  let query = supabase
    .from("goods_receipts")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("receipt_date", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  }
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as GoodsReceipt[];
}

export async function getGoodsReceiptCounts(
  establishmentId: string
): Promise<Partial<Record<GoodsReceiptStatus, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select("status")
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const counts: Partial<Record<GoodsReceiptStatus, number>> = {};
  for (const row of data ?? []) {
    const status = row.status as GoodsReceiptStatus;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/** Stock movements created by a validated receipt (enriched for display). */
export async function getGoodsReceiptStockMovements(
  establishmentId: string,
  receiptId: string
): Promise<
  Array<{
    id: string;
    ingredientName: string | null;
    baseQuantity: number | null;
    baseUnitSymbol: string | null;
    unitCost: number;
    totalCost: number;
    lotNumber: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    locationName: string | null;
    createdAt: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("goods_receipt_id", receiptId)
    .order("created_at", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as Database["public"]["Tables"]["stock_movements"]["Row"][];
  if (rows.length === 0) return [];

  const [ingredients, units, locations] = await Promise.all([
    ingredientNameMap(
      establishmentId,
      rows.map((row) => row.ingredient_id)
    ),
    unitSymbolMap(
      rows.flatMap((row) =>
        [row.base_unit_id].filter((id): id is string => Boolean(id))
      )
    ),
    locationMap(
      establishmentId,
      rows
        .map((row) => row.location_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]);

  return rows.map((row) => ({
    id: row.id,
    ingredientName: ingredients.get(row.ingredient_id)?.name ?? null,
    baseQuantity: row.base_quantity,
    baseUnitSymbol: row.base_unit_id ? units.get(row.base_unit_id) ?? null : null,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    lotNumber: row.lot_number,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    locationName: row.location_id ? locations.get(row.location_id)?.name ?? null : null,
    createdAt: row.created_at,
  }));
}

/** Active inventory locations (broad read policy; used by the receipt builder). */
export async function listInventoryLocations(
  establishmentId: string
): Promise<InventoryLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as InventoryLocation[];
}

/** Next sequential receipt number preview (BR-YYYY-NNNNNN) from the DB. */
export async function nextGoodsReceiptNumberPreview(
  establishmentId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_goods_receipt_number", {
    p_est: establishmentId,
  });
  if (error) throw toAuthorizationError(error);
  return (data ?? "") as string;
}

// ---------------------------------------------------------------------------
// Receivable purchase orders (the builder source for a new receipt)
// ---------------------------------------------------------------------------

/** Purchase orders a receipt may be opened against (approved/sent/partially_received). */
export async function listReceivablePurchaseOrders(
  establishmentId: string
): Promise<ReceivablePurchaseOrder[]> {
  const supabase = await createClient();
  const { data: orders, error: ordersError } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .eq("establishment_id", establishmentId)
    .in("status", ["approved", "sent", "partially_received"])
    .order("order_date", { ascending: false })
    .limit(100);
  if (ordersError) throw new AuthorizationError("GENERIC", ordersError.message);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((order) => order.id);
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_items")
    .select("*")
    .in("purchase_order_id", orderIds)
    .order("sort_order", { ascending: true });
  if (linesError) throw new AuthorizationError("GENERIC", linesError.message);

  const ingredientIds = (lines ?? [])
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const [ingredients, units] = await Promise.all([
    ingredientNameMap(establishmentId, ingredientIds),
    unitSymbolMap(
      (lines ?? []).flatMap((item) =>
        [item.purchase_unit_id].filter((id): id is string => Boolean(id))
      )
    ),
  ]);
  const baseUnitIds = (lines ?? [])
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const baseUnitMap = await baseUnitsOf(establishmentId, baseUnitIds);

  const ordersById = new Map<string, { id: string; order_number: string; order_date: string; expected_delivery_date: string | null; supplier_id: string | null; supplier_name: string | null; status: string; currency_code: string }>();
  for (const order of orders ?? []) {
    const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;
    ordersById.set(order.id, {
      id: order.id,
      order_number: order.order_number,
      order_date: order.order_date,
      expected_delivery_date: order.expected_delivery_date ?? null,
      supplier_id: order.supplier_id ?? null,
      supplier_name:
        (supplier as { name?: string | null } | null)?.name ?? null,
      status: order.status,
      currency_code: order.currency_code,
    });
  }

  const result: ReceivablePurchaseOrder[] = [];
  for (const line of lines ?? []) {
    const order = ordersById.get(line.purchase_order_id);
    if (!order) continue;
    const remaining = Math.max(0, Number(line.quantity) - Number(line.received_quantity));
    if (remaining <= 0) continue;

    let target = result.find((entry) => entry.id === order.id);
    if (!target) {
      target = {
        id: order.id,
        orderNumber: order.order_number,
        orderDate: order.order_date,
        expectedDeliveryDate: order.expected_delivery_date,
        supplierId: order.supplier_id,
        supplierName: order.supplier_name,
        status: order.status,
        currencyCode: order.currency_code,
        remainingCount: 0,
        lines: [],
      };
      result.push(target);
    }

    const ingredient = line.ingredient_id;
    const ingredientBase = ingredient ? baseUnitMap.get(ingredient) : undefined;
    target.lines.push({
      id: line.id,
      ingredientId: line.ingredient_id ?? null,
      ingredientName: ingredient ? (ingredients.get(ingredient)?.name ?? null) : null,
      description: line.description ?? null,
      supplierSku: line.supplier_sku ?? null,
      quantity: Number(line.quantity),
      receivedQuantity: Number(line.received_quantity),
      remainingQuantity: remaining,
      purchaseUnitId: line.purchase_unit_id ?? null,
      purchaseUnitSymbol: line.purchase_unit_id
        ? units.get(line.purchase_unit_id) ?? null
        : null,
      baseUnitId: ingredientBase?.base_unit_id ?? null,
      baseUnitSymbol: ingredientBase?.base_unit_symbol ?? null,
      isStockTracked: ingredientBase?.is_stock_tracked ?? false,
      unitPrice: Number(line.unit_price),
      discountAmount: Number(line.discount_amount),
      taxRate: Number(line.tax_rate),
      sortOrder: Number(line.sort_order),
    });
  }

  for (const order of orders ?? []) {
    const entry = result.find((item) => item.id === order.id);
    if (entry) entry.remainingCount = entry.lines.length;
  }

  return result.filter((entry) => entry.lines.length > 0);
}

async function baseUnitsOf(
  establishmentId: string,
  ingredientIds: string[]
): Promise<
  Map<string, { base_unit_id: string | null; base_unit_symbol: string | null; is_stock_tracked: boolean }>
> {
  const map = new Map<
    string,
    { base_unit_id: string | null; base_unit_symbol: string | null; is_stock_tracked: boolean }
  >();
  if (ingredientIds.length === 0) return map;
  const unique = [...new Set(ingredientIds)];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, base_unit_id, is_stock_tracked")
    .eq("establishment_id", establishmentId)
    .in("id", unique);
  if (!data || data.length === 0) return map;

  const unitIds = data
    .map((row) => row.base_unit_id)
    .filter((id): id is string => Boolean(id));
  const symbols = await unitSymbolMap(unitIds);

  for (const row of data) {
    map.set(row.id, {
      base_unit_id: row.base_unit_id ?? null,
      base_unit_symbol: row.base_unit_id ? symbols.get(row.base_unit_id) ?? null : null,
      is_stock_tracked: Boolean(row.is_stock_tracked),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Writes (always through the atomic security-definer RPCs)
// ---------------------------------------------------------------------------

export interface GoodsReceiptRpcLine {
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

function toLinesJsonb(
  items: GoodsReceiptLineInput[]
): Record<string, unknown>[] {
  return items.map((item) => ({
    purchase_order_item_id: item.purchaseOrderItemId,
    ingredient_id: item.ingredientId,
    received_quantity: item.receivedQuantity,
    accepted_quantity: item.acceptedQuantity,
    rejected_quantity: item.rejectedQuantity,
    lot_number: item.lotNumber ?? null,
    batch_number: item.batchNumber ?? null,
    expiry_date: item.expiryDate ?? null,
    notes: item.notes ?? null,
    sort_order: item.sortOrder,
  }));
}

export async function createGoodsReceipt(
  establishmentId: string,
  input: GoodsReceiptWriteInput
): Promise<GoodsReceiptWithRelations> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_goods_receipt", {
    p_est: establishmentId,
    p_purchase_order_id: input.purchaseOrderId,
    p_receipt_date: input.receiptDate ? input.receiptDate.toISOString() : null,
    p_inventory_location_id: input.inventoryLocationId ?? null,
    p_delivery_note_number: input.deliveryNoteNumber ?? null,
    p_supplier_invoice_number: input.supplierInvoiceNumber ?? null,
    p_notes: input.notes ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_items: toLinesJsonb(input.items),
  });
  if (error) throw toAuthorizationError(error);

  const receipt = await getGoodsReceipt(establishmentId, data as string);
  if (!receipt) throw new AuthorizationError("GOODS_RECEIPT_NOT_FOUND");
  return receipt;
}

export async function updateGoodsReceipt(
  establishmentId: string,
  receiptId: string,
  input: GoodsReceiptWriteInput
): Promise<GoodsReceiptWithRelations> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_goods_receipt", {
    p_est: establishmentId,
    p_receipt_id: receiptId,
    p_receipt_date: input.receiptDate ? input.receiptDate.toISOString() : null,
    p_inventory_location_id: input.inventoryLocationId ?? null,
    p_delivery_note_number: input.deliveryNoteNumber ?? null,
    p_supplier_invoice_number: input.supplierInvoiceNumber ?? null,
    p_notes: input.notes ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_items: toLinesJsonb(input.items),
  });
  if (error) throw toAuthorizationError(error);

  const receipt = await getGoodsReceipt(establishmentId, receiptId);
  if (!receipt) throw new AuthorizationError("GOODS_RECEIPT_NOT_FOUND");
  return receipt;
}

export async function deleteGoodsReceipt(
  establishmentId: string,
  receiptId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_goods_receipt", {
    p_est: establishmentId,
    p_receipt_id: receiptId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function submitGoodsReceipt(
  establishmentId: string,
  receiptId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_goods_receipt", {
    p_est: establishmentId,
    p_receipt_id: receiptId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function validateGoodsReceipt(
  establishmentId: string,
  receiptId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("validate_goods_receipt", {
    p_est: establishmentId,
    p_receipt_id: receiptId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function cancelGoodsReceipt(
  establishmentId: string,
  receiptId: string,
  reason: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_goods_receipt", {
    p_est: establishmentId,
    p_receipt_id: receiptId,
    p_reason: reason ?? null,
  });
  if (error) throw toAuthorizationError(error);
}