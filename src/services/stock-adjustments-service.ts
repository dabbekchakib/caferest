import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type {
  StockAdjustment,
  StockAdjustmentItem,
  StockAdjustmentStatusHistory,
  StockAdjustmentType,
  StockAdjustmentReason,
  StockAdjustmentWithRelations,
  StockAdjustmentItemWithRelations,
  StockAdjustmentPageResult,
  StockAdjustmentFilters,
  CreateStockAdjustmentInput,
  StockAdjustmentLineInput,
  StockAdjustmentLineUpdateInput,
  StockAdjustmentLineRemoveInput,
  StockAdjustmentThresholds,
} from "@/lib/stock-adjustments/types";
import { stockAdjustmentTotals } from "@/lib/stock-adjustments/calculations";
import type { Database } from "@/types/database";
import { listInventoryLocations } from "./stocktakes-service";

type StockMovement =
  Database["public"]["Tables"]["stock_movements"]["Row"];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function profileNameMap(
  ids: string[]
): Promise<Map<string, string | null>> {
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
  for (const row of data ?? [])
    map.set(row.id, { name: row.name, sku: row.sku });
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
  for (const row of data ?? [])
    map.set(row.id, { name: row.name, code: row.code });
  return map;
}

async function reasonMap(
  establishmentId: string,
  ids: string[]
): Promise<Map<string, { code: string | null; label: string | null }>> {
  const map = new Map<
    string,
    { code: string | null; label: string | null }
  >();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_adjustment_reasons")
    .select("id, code, label")
    .eq("is_active", true)
    .or(`establishment_id.is.null,establishment_id.eq.${establishmentId}`)
    .in("id", ids);
  for (const row of data ?? [])
    map.set(row.id, { code: row.code, label: row.label });
  return map;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface StockAdjustmentEnrichContext {
  locations: Map<string, { name: string | null; code: string | null }>;
  reasons: Map<string, { code: string | null; label: string | null }>;
  profiles: Map<string, string | null>;
}

async function enrichContext(
  establishmentId: string,
  rows: StockAdjustment[],
  ids: string[]
): Promise<StockAdjustmentEnrichContext> {
  const [locations, reasons, profiles] = await Promise.all([
    locationMap(establishmentId, rows.map((row) => row.inventory_location_id)),
    reasonMap(establishmentId, ids),
    profileNameMap(
      rows.flatMap((row) =>
        [
          row.created_by,
          row.submitted_by,
          row.approved_by,
          row.validated_by,
          row.cancelled_by,
        ].filter((id): id is string => Boolean(id))
      )
    ),
  ]);
  return { locations, reasons, profiles };
}

function toListItem(
  row: StockAdjustment,
  ctx: StockAdjustmentEnrichContext,
  reasonId: string | null
): Omit<StockAdjustmentWithRelations, "items" | "history" | "summary"> {
  const location = ctx.locations.get(row.inventory_location_id);
  const reason = ctx.reasons.get(reasonId ?? "");
  return {
    ...row,
    locationName: location?.name ?? null,
    locationCode: location?.code ?? null,
    reasonCode: reason?.code ?? null,
    reasonLabel: reason?.label ?? null,
    createdByName: ctx.profiles.get(row.created_by ?? "") ?? null,
    submittedByName: row.submitted_by
      ? ctx.profiles.get(row.submitted_by) ?? null
      : null,
    approvedByName: row.approved_by ? ctx.profiles.get(row.approved_by) ?? null : null,
    validatedByName: row.validated_by
      ? ctx.profiles.get(row.validated_by) ?? null
      : null,
    cancelledByName: row.cancelled_by
      ? ctx.profiles.get(row.cancelled_by) ?? null
      : null,
  };
}

async function enrichItems(
  establishmentId: string,
  items: StockAdjustmentItem[]
): Promise<StockAdjustmentItemWithRelations[]> {
  if (items.length === 0) return [];
  const ingredientIds = [...new Set(items.map((i) => i.ingredient_id))];
  const unitIds = [
    ...new Set(
      items.flatMap((i) =>
        [i.unit_id, i.base_unit_id].filter((id): id is string => Boolean(id))
      )
    ),
  ];
  const [ingredients, units] = await Promise.all([
    ingredientNameMap(establishmentId, ingredientIds),
    unitSymbolMap(unitIds),
  ]);
  return items.map((item) => ({
    ...item,
    ingredientName: ingredients.get(item.ingredient_id)?.name ?? null,
    ingredientSku: ingredients.get(item.ingredient_id)?.sku ?? null,
    baseUnitSymbol: item.base_unit_id ? units.get(item.base_unit_id) ?? null : null,
    unitSymbol: item.unit_id ? units.get(item.unit_id) ?? null : null,
  }));
}

/** Full adjustment with lines, history and the client-side summary. */
export async function getStockAdjustment(
  establishmentId: string,
  adjustmentId: string
): Promise<StockAdjustmentWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_adjustments")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", adjustmentId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const ctx = await enrichContext(establishmentId, [data as StockAdjustment], [
    (data as StockAdjustment).reason_id ?? "",
  ]);

  const [itemsRes, historyRes] = await Promise.all([
    supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("stock_adjustment_id", adjustmentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("stock_adjustment_status_history")
      .select("*")
      .eq("stock_adjustment_id", adjustmentId)
      .order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error)
    throw new AuthorizationError("GENERIC", itemsRes.error.message);
  if (historyRes.error)
    throw new AuthorizationError("GENERIC", historyRes.error.message);

  const items = await enrichItems(
    establishmentId,
    (itemsRes.data ?? []) as StockAdjustmentItem[]
  );

  return {
    ...toListItem(
      data as StockAdjustment,
      ctx,
      (data as StockAdjustment).reason_id
    ),
    items,
    history: (historyRes.data ?? []) as StockAdjustmentStatusHistory[],
    summary: stockAdjustmentTotals(items),
  };
}

export async function getStockAdjustmentsPage(
  establishmentId: string,
  filters: StockAdjustmentFilters = {}
): Promise<StockAdjustmentPageResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(filters.pageSize ?? 20))
  );

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("stock_adjustments")
      .select("*")
      .eq("establishment_id", establishmentId);
  const baseCount = () =>
    supabase
      .from("stock_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId);

  const applyFilters = <T extends ReturnType<typeof base>>(
    query: T
  ): T => {
    if (filters.locationId) query = query.eq("inventory_location_id", filters.locationId) as T;
    if (filters.type) query = query.eq("adjustment_type", filters.type) as T;
    if (filters.status) query = query.eq("status", filters.status) as T;
    if (filters.fromDate) query = query.gte("adjustment_date", filters.fromDate) as T;
    if (filters.toDate) query = query.lte("adjustment_date", filters.toDate) as T;
    const text = filters.query?.trim();
    if (text) query = query.or(`adjustment_number.ilike.%${text}%`) as T;
    return query;
  };

  const { count, error: countError } = await applyFilters(baseCount());
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  const { data, error } = await applyFilters(base())
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as StockAdjustment[];
  const ctx = await enrichContext(
    establishmentId,
    rows,
    rows.map((row) => row.reason_id ?? "")
  );

  const lineCounts = await (async () => {
    if (rows.length === 0) return new Map<string, number>();
    const ids = rows.map((row) => row.id);
    const { data: lines, error: linesError } = await supabase
      .from("stock_adjustment_items")
      .select("stock_adjustment_id")
      .in("stock_adjustment_id", ids);
    if (linesError) throw new AuthorizationError("GENERIC", linesError.message);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, 0);
    for (const line of lines ?? [])
      counts.set(line.stock_adjustment_id, (counts.get(line.stock_adjustment_id) ?? 0) + 1);
    return counts;
  })();

  return {
    items: rows.map((row) => ({
      ...toListItem(row, ctx, row.reason_id),
      totalLines: lineCounts.get(row.id) ?? 0,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Active reasons catalog (system + establishment), optionally typed. */
export async function listStockAdjustmentReasons(
  establishmentId: string,
  options: { type?: StockAdjustmentType | null } = {}
): Promise<StockAdjustmentReason[]> {
  const supabase = await createClient();
  let query = supabase
    .from("stock_adjustment_reasons")
    .select("*")
    .eq("is_active", true);
  query =
    (options.type
      ? query.eq("adjustment_type", options.type)
      : query)
      .or(`establishment_id.is.null,establishment_id.eq.${establishmentId}`)
      .order("is_system", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }) as typeof query;
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as StockAdjustmentReason[];
}

export { listInventoryLocations };

/** Stock-tracked ingredients for the line picker (name + base unit symbol). */
export async function listAdjustmentIngredients(
  establishmentId: string
): Promise<
  Array<{ id: string; name: string; sku: string; baseUnit: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, sku, base_unit_id")
    .eq("establishment_id", establishmentId)
    .eq("is_stock_tracked", true)
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = data ?? [];
  const units = await unitSymbolMap(
    [...new Set(rows.map((row) => row.base_unit_id).filter((id): id is string => Boolean(id)))]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? "",
    sku: row.sku ?? "",
    baseUnit: row.base_unit_id ? units.get(row.base_unit_id) ?? "" : "",
  }));
}

/** Live book quantity + average cost per ingredient at a location (preview).
 *  The RPC re-checks availability/costs under lock at validate — these are
 *  only for the draft estimate. */
export async function getStockQuantities(
  establishmentId: string,
  locationId: string,
  ingredientIds: string[]
): Promise<Map<string, { quantity: number; averageCost: number }>> {
  const map = new Map<string, { quantity: number; averageCost: number }>();
  if (ingredientIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("ingredient_id, quantity, average_cost")
    .eq("establishment_id", establishmentId)
    .eq("location_id", locationId)
    .in("ingredient_id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  for (const row of data ?? []) {
    map.set(row.ingredient_id, {
      quantity: row.quantity ?? 0,
      averageCost: row.average_cost ?? 0,
    });
  }
  return map;
}

/** Movements materialised by a VALIDATED adjustment (detail view). */
export async function getStockAdjustmentMovements(
  establishmentId: string,
  adjustmentId: string
): Promise<
  Array<{
    id: string;
    ingredientName: string | null;
    baseQuantity: number | null;
    baseUnitSymbol: string | null;
    unitCost: number;
    totalCost: number;
    createdAt: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("stock_adjustment_id", adjustmentId)
    .order("created_at", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as StockMovement[];
  if (rows.length === 0) return [];

  const [ingredients, units] = await Promise.all([
    ingredientNameMap(establishmentId, rows.map((row) => row.ingredient_id)),
    unitSymbolMap(
      rows
        .flatMap((row) => [row.base_unit_id, row.unit_id])
        .filter((id): id is string => Boolean(id))
    ),
  ]);

  return rows.map((row) => ({
    id: row.id,
    ingredientName: ingredients.get(row.ingredient_id)?.name ?? null,
    baseQuantity: row.base_quantity ?? row.quantity,
    baseUnitSymbol: row.base_unit_id ? units.get(row.base_unit_id) ?? null : null,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    createdAt: row.created_at,
  }));
}

/** Next sequential number preview (PER-YYYY-NNNNNN) from the DB. */
export async function nextStockAdjustmentNumberPreview(
  establishmentId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_stock_adjustment_number", {
    p_est: establishmentId,
  });
  if (error) throw toAuthorizationError(error);
  return (data ?? "") as string;
}

// ---------------------------------------------------------------------------
// Writes (always through the atomic security-definer RPCs)
// ---------------------------------------------------------------------------

export async function createStockAdjustment(
  establishmentId: string,
  input: Omit<CreateStockAdjustmentInput, "establishmentId">
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stock_adjustment", {
    p_est: establishmentId,
    p_inventory_location_id: input.inventoryLocationId,
    p_adjustment_type: input.adjustmentType,
    p_adjustment_date: input.adjustmentDate,
    p_reason_id: input.reasonId ?? null,
    p_notes: input.notes ?? null,
    p_internal_reference: input.internalReference ?? null,
    p_items: input.items.map((item) => ({
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit_id: item.unitId ?? null,
    })),
  });
  if (error) throw toAuthorizationError(error);
  return data as string;
}

export async function addStockAdjustmentItem(
  establishmentId: string,
  input: Omit<StockAdjustmentLineInput, "establishmentId">
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_stock_adjustment_item", {
    p_est: establishmentId,
    p_adjustment_id: input.adjustmentId,
    p_ingredient_id: input.ingredientId,
    p_quantity: input.quantity,
    p_unit_id: input.unitId ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function updateStockAdjustmentItem(
  establishmentId: string,
  input: Omit<StockAdjustmentLineUpdateInput, "establishmentId">
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_stock_adjustment_item", {
    p_est: establishmentId,
    p_adjustment_id: input.adjustmentId,
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_unit_id: input.unitId ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function removeStockAdjustmentItem(
  establishmentId: string,
  input: Omit<StockAdjustmentLineRemoveInput, "establishmentId">
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_stock_adjustment_item", {
    p_est: establishmentId,
    p_adjustment_id: input.adjustmentId,
    p_item_id: input.itemId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function submitStockAdjustment(
  establishmentId: string,
  adjustmentId: string,
  thresholds: StockAdjustmentThresholds
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_stock_adjustment", {
    p_est: establishmentId,
    p_adjustment_id: adjustmentId,
    p_require_approval: thresholds.requireApproval,
    p_threshold_value: thresholds.approvalThresholdValue,
  });
  if (error) throw toAuthorizationError(error);
}

export async function approveStockAdjustment(
  establishmentId: string,
  adjustmentId: string,
  thresholds: StockAdjustmentThresholds
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_stock_adjustment", {
    p_est: establishmentId,
    p_adjustment_id: adjustmentId,
    p_threshold_value: thresholds.approvalThresholdValue,
    p_require_separation: thresholds.requireSeparation,
  });
  if (error) throw toAuthorizationError(error);
}

export async function validateStockAdjustment(
  establishmentId: string,
  adjustmentId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("validate_stock_adjustment", {
    p_est: establishmentId,
    p_adjustment_id: adjustmentId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function cancelStockAdjustment(
  establishmentId: string,
  adjustmentId: string,
  reason: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_stock_adjustment", {
    p_est: establishmentId,
    p_adjustment_id: adjustmentId,
    p_reason: reason ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function deleteStockAdjustment(
  establishmentId: string,
  adjustmentId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stock_adjustment", {
    p_est: establishmentId,
    p_adjustment_id: adjustmentId,
  });
  if (error) throw toAuthorizationError(error);
}