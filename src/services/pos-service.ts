/**
 * Service POS — catalogue, commandes ouvertes et écritures atomiques.
 *
 * Lectures : session utilisateur (RLS). Écritures : RPC SECURITY DEFINER
 * (numérotation serveur, snapshots produits/taxes, totaux recalculés, table
 * occupée seulement à la confirmation).
 */

import { getPosProducts, listTaxes } from "./products-service";
import { listCategories } from "./categories-service";
import { listDiningAreas, listTables } from "./tables-service";
import { getSettingsMap } from "./settings";
import { settingValue } from "@/lib/config/settings";
import { createClient } from "@/lib/supabase/server";
import { toAuthorizationError } from "@/lib/authorization/errors";
import {
  OPEN_ORDER_STATUSES,
  POS_SETTINGS_DEFAULTS,
  POS_SETTINGS_KEYS,
} from "@/lib/pos/config";
import type {
  PosAreaRef,
  PosCatalog,
  PosOrderCreateResult,
  PosOrderDetail,
  PosOrderItemRow,
  PosOrderListResult,
  PosOrderStatusEvent,
  PosOrderSummary,
  PosProduct,
  PosSettings,
  PosTableRef,
} from "@/lib/pos/types";
import type { OrderListFiltersInput } from "@/lib/orders/schemas";

const ORDER_SELECT =
  "id, order_number, status, order_type, table_id, dining_area_id, customer_id, user_id, notes, subtotal, discount_amount, tax_amount, total, held_at, confirmed_at, cancelled_at, created_at, updated_at";

interface RawOrderRow {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  table_id: string | null;
  dining_area_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  held_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function resolveLocalizedName(
  master: string,
  translations: Record<string, { name?: string | null }>,
  locale: string
): string {
  if (locale === "fr") return master;
  const localized = translations[locale]?.name;
  if (localized) return localized;
  if (locale === "en") return master;
  return translations.en?.name ?? master;
}

// ---------------------------------------------------------------------------
// Catalogue du POS
// ---------------------------------------------------------------------------

export async function getPosCatalog(
  establishmentId: string,
  locale: string
): Promise<PosCatalog> {
  const [categories, products, taxes] = await Promise.all([
    listCategories(establishmentId),
    getPosProducts(establishmentId),
    listTaxes(establishmentId),
  ]);

  const taxMap = new Map(taxes.map((tax) => [tax.id, tax.rate]));

  const categoryNames = new Map<string, string>();
  for (const category of categories) {
    categoryNames.set(
      category.id,
      resolveLocalizedName(category.name, category.translations, locale)
    );
  }

  const posProducts: PosProduct[] = products.map((product) => ({
    id: product.id,
    name: resolveLocalizedName(product.name, product.translations, locale),
    price: product.price,
    categoryId: product.category_id,
    categoryName: product.category_id
      ? categoryNames.get(product.category_id) ?? null
      : null,
    barcode: product.barcode ?? null,
    sku: product.sku ?? null,
    isAvailable: product.is_active && product.is_available,
    imageUrl: product.image_url ?? null,
    taxRate: product.tax_id ? (taxMap.get(product.tax_id) ?? 0) : 0,
  }));

  const posCategories: PosCatalog["categories"] = categories
    .filter((category) =>
      posProducts.some((product) => product.categoryId === category.id)
    )
    .map((category) => ({
      id: category.id,
      name: categoryNames.get(category.id) ?? category.name,
      sortOrder: category.sort_order,
    }));

  return { categories: posCategories, products: posProducts };
}

// ---------------------------------------------------------------------------
// Paramètres POS (lecture légère en session ; fallbacks typés)
// ---------------------------------------------------------------------------

export async function getPosSettings(
  establishmentId: string
): Promise<PosSettings> {
  const supabase = await createClient();
  const map = await getSettingsMap(supabase, establishmentId);
  return {
    allowDiscount: settingValue<boolean>(
      map,
      POS_SETTINGS_KEYS.allowDiscount,
      POS_SETTINGS_DEFAULTS.allowDiscount
    ),
    requireConfirmation: settingValue<boolean>(
      map,
      POS_SETTINGS_KEYS.requireConfirmation,
      POS_SETTINGS_DEFAULTS.requireConfirmation
    ),
    allowNegativeStock: settingValue<boolean>(
      map,
      POS_SETTINGS_KEYS.allowNegativeStock,
      POS_SETTINGS_DEFAULTS.allowNegativeStock
    ),
  };
}

// ---------------------------------------------------------------------------
// Commandes (lecture)
// ---------------------------------------------------------------------------

export async function listOpenOrders(
  establishmentId: string
): Promise<PosOrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("establishment_id", establishmentId)
    .in("status", [...OPEN_ORDER_STATUSES])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw toAuthorizationError(error);

  return enrichOrderSummaries(establishmentId, (data ?? []) as RawOrderRow[]);
}

export async function listRecentOrders(
  establishmentId: string,
  limit = 50
): Promise<PosOrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toAuthorizationError(error);

  return enrichOrderSummaries(establishmentId, (data ?? []) as RawOrderRow[]);
}

export async function getPosOrder(
  establishmentId: string,
  orderId: string
): Promise<PosOrderDetail | null> {
  const supabase = await createClient();
  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("establishment_id", establishmentId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount, total, notes"
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);
  if (orderResult.error) throw toAuthorizationError(orderResult.error);
  if (itemsResult.error) throw toAuthorizationError(itemsResult.error);
  if (!orderResult.data) return null;

  const items: PosOrderItemRow[] = (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name ?? "",
    quantity: row.quantity,
    unitPrice: row.unit_price,
    taxRate: row.tax_rate,
    taxAmount: row.tax_amount,
    total: row.total,
    notes: row.notes,
  }));

  const summaries = await enrichOrderSummaries(establishmentId, [
    orderResult.data as unknown as RawOrderRow,
  ]);
  const summary = summaries[0];
  if (!summary) return null;

  return { ...summary, items };
}

// ---------------------------------------------------------------------------
// Liste paginée des commandes (/orders)
// ---------------------------------------------------------------------------

export async function getOrdersPage(
  establishmentId: string,
  filters: OrderListFiltersInput
): Promise<PosOrderListResult> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 15;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.orderType) query = query.eq("order_type", filters.orderType);
  if (filters.tableId) query = query.eq("table_id", filters.tableId);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.query) {
    query = query.ilike("order_number", `%${filters.query}%`);
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw toAuthorizationError(error);

  const items = await enrichOrderSummaries(
    establishmentId,
    (data ?? []) as RawOrderRow[]
  );
  const total = count ?? items.length;
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Historique des statuts (order_status_history)
// ---------------------------------------------------------------------------

export async function listOrderStatusHistory(
  establishmentId: string,
  orderId: string
): Promise<PosOrderStatusEvent[]> {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (orderError) throw toAuthorizationError(orderError);
  if (!order) return [];

  const { data, error } = await supabase
    .from("order_status_history")
    .select("id, order_id, status, from_status, user_id, reason, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw toAuthorizationError(error);

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))
  );
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    if (profilesError) throw toAuthorizationError(profilesError);
    for (const profile of profiles ?? []) {
      userNames.set(profile.id, profile.full_name ?? "");
    }
  }

  return rows.map((row) => ({
    id: row.id,
    status: row.status as PosOrderStatusEvent["status"],
    fromStatus: row.from_status as PosOrderStatusEvent["fromStatus"],
    userName: row.user_id ? userNames.get(row.user_id) ?? null : null,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Writes — toujours via les RPC atomiques
// ---------------------------------------------------------------------------

export async function createPosOrder(
  establishmentId: string,
  input: {
    clientOperationId: string | null;
    orderType: string;
    tableId: string | null;
    diningAreaId: string | null;
    customerId: string | null;
    notes: string | null;
    discountAmount: number;
    discountAllowed: boolean;
    status: "draft" | "open";
    items: Array<{ product_id: string; quantity: number }>;
  }
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_pos_order", {
    p_est: establishmentId,
    p_order_type: input.orderType,
    p_client_operation_id: input.clientOperationId,
    p_table_id: input.tableId ?? null,
    p_dining_area_id: input.diningAreaId ?? null,
    p_customer_id: input.customerId ?? null,
    p_notes: input.notes,
    p_discount_amount: input.discountAmount,
    p_discount_allowed: input.discountAllowed,
    p_status: input.status,
    p_items: input.items,
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

export async function updatePosOrderItems(
  establishmentId: string,
  orderId: string,
  items: Array<{ product_id: string; quantity: number }>
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_pos_order_items", {
    p_est: establishmentId,
    p_order_id: orderId,
    p_items: items,
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

export async function updatePosOrderDetails(
  establishmentId: string,
  orderId: string,
  updates: {
    orderType?: string;
    tableId?: string | null;
    diningAreaId?: string | null;
    customerId?: string | null;
    notes?: string | null;
    discountAmount?: number;
  },
  discountAllowed: boolean
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const record: Record<string, unknown> = {};
  if (updates.orderType !== undefined) record.order_type = updates.orderType;
  if (updates.tableId !== undefined) record.table_id = updates.tableId;
  if (updates.diningAreaId !== undefined)
    record.dining_area_id = updates.diningAreaId;
  if (updates.customerId !== undefined) record.customer_id = updates.customerId;
  if (updates.notes !== undefined) record.notes = updates.notes;
  if (updates.discountAmount !== undefined)
    record.discount_amount = updates.discountAmount;

  const { data, error } = await supabase.rpc("update_pos_order_details", {
    p_est: establishmentId,
    p_order_id: orderId,
    p_updates: record,
    p_discount_allowed: discountAllowed,
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

export async function transitionPosOrder(
  establishmentId: string,
  orderId: string,
  toStatus: string,
  clientOperationId: string | null = null,
  reason: string | null = null
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_pos_order", {
    p_est: establishmentId,
    p_order_id: orderId,
    p_to_status: toStatus,
    p_client_operation_id: clientOperationId,
    p_reason: reason,
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

// ---------------------------------------------------------------------------
// Fusion & séparation de commandes (RPC atomiques)
// ---------------------------------------------------------------------------

export async function mergePosOrders(
  establishmentId: string,
  sourceOrderId: string,
  targetOrderId: string
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_pos_orders", {
    p_est: establishmentId,
    p_source_order_id: sourceOrderId,
    p_target_order_id: targetOrderId,
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

export async function splitPosOrder(
  establishmentId: string,
  input: {
    sourceOrderId: string;
    orderType: string;
    clientOperationId: string | null;
    tableId: string | null;
    diningAreaId: string | null;
    customerId: string | null;
    notes: string | null;
    items: readonly string[];
  }
): Promise<PosOrderCreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("split_pos_order", {
    p_est: establishmentId,
    p_source_order_id: input.sourceOrderId,
    p_order_type: input.orderType,
    p_client_operation_id: input.clientOperationId,
    p_table_id: input.tableId ?? null,
    p_dining_area_id: input.diningAreaId ?? null,
    p_customer_id: input.customerId ?? null,
    p_notes: input.notes,
    p_items: input.items.map((id) => ({ id })),
  });
  if (error) throw toAuthorizationError(error);
  return data as PosOrderCreateResult;
}

// ---------------------------------------------------------------------------
// Clients réutilisables (POS + module commandes)
// ---------------------------------------------------------------------------

export async function listPosCustomers(
  establishmentId: string
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("first_name", { ascending: true })
    .limit(200);
  if (error) throw toAuthorizationError(error);

  return (data ?? []).map((customer) => ({
    id: customer.id,
    name: [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ")
      .trim(),
  }));
}

// ---------------------------------------------------------------------------
// Références pour le sélecteur de table (salle + tables)
// ---------------------------------------------------------------------------

export async function listPosReferences(
  establishmentId: string,
  locale: string
): Promise<PosAreaRef[]> {
  const [areas, tables] = await Promise.all([
    listDiningAreas(establishmentId),
    listTables(establishmentId),
  ]);

  const areaNames = new Map<string, string>();
  for (const area of areas) {
    areaNames.set(
      area.id,
      resolveLocalizedName(area.name, area.translations, locale)
    );
  }

  const grouped = new Map<string, PosTableRef[]>();
  for (const table of tables) {
    const ref: PosTableRef = {
      id: table.id,
      tableNumber: table.table_number ?? table.name,
      diningAreaId: table.area_id,
      diningAreaName: table.area_id ? areaNames.get(table.area_id) ?? null : null,
      status: table.status,
      capacity: table.capacity,
    };
    const key = table.area_id ?? "";
    const list = grouped.get(key) ?? [];
    list.push(ref);
    grouped.set(key, list);
  }

  const result: PosAreaRef[] = areas
    .map((area) => ({
      id: area.id,
      name: areaNames.get(area.id) ?? area.name,
      tables: grouped.get(area.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const unassigned = grouped.get("") ?? [];
  if (unassigned.length > 0) {
    result.push({
      id: "",
      name: "",
      tables: unassigned,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function enrichOrderSummaries(
  establishmentId: string,
  rows: RawOrderRow[]
): Promise<PosOrderSummary[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const tableIds = Array.from(
    new Set(rows.map((row) => row.table_id).filter((id): id is string => Boolean(id)))
  );
  const areaIds = Array.from(
    new Set(
      rows.map((row) => row.dining_area_id).filter((id): id is string => Boolean(id))
    )
  );
  const customerIds = Array.from(
    new Set(
      rows.map((row) => row.customer_id).filter((id): id is string => Boolean(id))
    )
  );
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))
  );
  const orderIds = rows.map((row) => row.id);

  const [tablesRes, areasRes, customersRes, usersRes, itemsRes] = await Promise.all([
    tableIds.length
      ? supabase.from("tables").select("id, table_number").in("id", tableIds)
      : Promise.resolve({ data: [], error: null }),
    areaIds.length
      ? supabase.from("dining_areas").select("id, name").in("id", areaIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase
          .from("customers")
          .select("id, first_name, last_name")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds),
  ]);

  if (tablesRes.error) throw toAuthorizationError(tablesRes.error);
  if (areasRes.error) throw toAuthorizationError(areasRes.error);
  if (customersRes.error) throw toAuthorizationError(customersRes.error);
  if (usersRes.error) throw toAuthorizationError(usersRes.error);
  if (itemsRes.error) throw toAuthorizationError(itemsRes.error);

  const tableNumbers = new Map(
    (tablesRes.data ?? []).map((row) => [row.id, row.table_number])
  );
  const areaNames = new Map(
    (areasRes.data ?? []).map((row) => [row.id, row.name])
  );
  const customerNames = new Map(
    (customersRes.data ?? []).map((row) => [
      row.id,
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
    ])
  );
  const profileNames = new Map(
    (usersRes.data ?? []).map((row) => [row.id, row.full_name])
  );
  const itemStats = new Map<string, { itemsCount: number; quantity: number }>();
  for (const item of itemsRes.data ?? []) {
    const current = itemStats.get(item.order_id) ?? { itemsCount: 0, quantity: 0 };
    current.itemsCount += 1;
    current.quantity += item.quantity;
    itemStats.set(item.order_id, current);
  }

  return rows.map((row) => {
    const stats = itemStats.get(row.id) ?? { itemsCount: 0, quantity: 0 };
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status as PosOrderSummary["status"],
      orderType: row.order_type as PosOrderSummary["orderType"],
      tableId: row.table_id,
      tableNumber: row.table_id ? tableNumbers.get(row.table_id) ?? null : null,
      diningAreaId: row.dining_area_id,
      diningAreaName: row.dining_area_id
        ? areaNames.get(row.dining_area_id) ?? null
        : null,
      customerId: row.customer_id,
      customerName: row.customer_id
        ? customerNames.get(row.customer_id) ?? null
        : null,
      serverName: row.user_id ? profileNames.get(row.user_id) ?? null : null,
      notes: row.notes,
      itemsCount: stats.itemsCount,
      quantity: stats.quantity,
      subtotal: row.subtotal,
      discountAmount: row.discount_amount,
      taxAmount: row.tax_amount,
      total: row.total,
      heldAt: row.held_at,
      confirmedAt: row.confirmed_at,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}