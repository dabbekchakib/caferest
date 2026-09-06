import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type {
  Stocktake,
  StocktakeItem,
  StocktakeStatusHistory,
  StocktakeStatus,
  StocktakeWithRelations,
  StocktakeItemWithRelations,
  StocktakePageResult,
  StocktakeFilters,
  CreateStocktakeInput,
  StartStocktakeInput,
  StocktakeCountInput,
  StocktakeThresholds,
} from "@/lib/stocktakes/types";
import { summarizeStocktake } from "@/lib/stocktakes/calculations";
import type { Database } from "@/types/database";

type InventoryLocation = Database["public"]["Tables"]["inventory_locations"]["Row"];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface StocktakeEnrichContext {
  locations: Map<string, { name: string | null; code: string | null }>;
  profiles: Map<string, string | null>;
}

async function enrichContext(
  establishmentId: string,
  rows: Stocktake[]
): Promise<StocktakeEnrichContext> {
  const [locations, profiles] = await Promise.all([
    locationMap(
      establishmentId,
      rows.map((row) => row.inventory_location_id)
    ),
    profileNameMap(
      rows.flatMap((row) =>
        [
          row.created_by,
          row.started_by,
          row.completed_by,
          row.approved_by,
          row.validated_by,
          row.cancelled_by,
        ].filter((id): id is string => Boolean(id))
      )
    ),
  ]);
  return { locations, profiles };
}

function toListItem(
  row: Stocktake,
  ctx: StocktakeEnrichContext
): Omit<StocktakeWithRelations, "items" | "history" | "summary"> {
  const location = ctx.locations.get(row.inventory_location_id);
  return {
    ...row,
    locationName: location?.name ?? null,
    locationCode: location?.code ?? null,
    createdByName: ctx.profiles.get(row.created_by ?? "") ?? null,
    startedByName: row.started_by ? ctx.profiles.get(row.started_by) ?? null : null,
    completedByName: row.completed_by
      ? ctx.profiles.get(row.completed_by) ?? null
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
  items: StocktakeItem[]
): Promise<StocktakeItemWithRelations[]> {
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
    countUnitSymbol: item.unit_id ? units.get(item.unit_id) ?? null : null,
  }));
}

/** Full stocktake with lines, history and the reconciled summary. */
export async function getStocktake(
  establishmentId: string,
  stocktakeId: string
): Promise<StocktakeWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stocktakes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", stocktakeId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const ctx = await enrichContext(establishmentId, [data as Stocktake]);

  const [itemsRes, historyRes] = await Promise.all([
    supabase
      .from("stocktake_items")
      .select("*")
      .eq("stocktake_id", stocktakeId)
      .order("created_at", { ascending: true }),
    supabase
      .from("stocktake_status_history")
      .select("*")
      .eq("stocktake_id", stocktakeId)
      .order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error) throw new AuthorizationError("GENERIC", itemsRes.error.message);
  if (historyRes.error)
    throw new AuthorizationError("GENERIC", historyRes.error.message);

  const items = await enrichItems(
    establishmentId,
    (itemsRes.data ?? []) as StocktakeItem[]
  );

  return {
    ...toListItem(data as Stocktake, ctx),
    items,
    history: (historyRes.data ?? []) as StocktakeStatusHistory[],
    summary: summarizeStocktake(items),
  };
}

export async function getStocktakesPage(
  establishmentId: string,
  filters: StocktakeFilters = {}
): Promise<StocktakePageResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(filters.pageSize ?? 20))
  );

  const supabase = await createClient();
  const base = () =>
    supabase.from("stocktakes").select("*").eq("establishment_id", establishmentId);
  const baseCount = () =>
    supabase
      .from("stocktakes")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId);

  const applyCountFilters = (
    query: ReturnType<typeof baseCount>
  ): ReturnType<typeof baseCount> => {
    if (filters.locationId) query = query.eq("inventory_location_id", filters.locationId);
    if (filters.mode) query = query.eq("mode", filters.mode);
    if (filters.status) query = query.eq("status", filters.status);
    const text = filters.query?.trim();
    if (text) query = query.or(`stocktake_number.ilike.%${text}%`);
    return query;
  };

  const { count, error: countError } = await applyCountFilters(baseCount());
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  const { data, error } = await applyCountFilters(base())
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as Stocktake[];
  const ctx = await enrichContext(establishmentId, rows);

  const lineCounts = await (async () => {
    if (rows.length === 0) return new Map<string, { total: number; counted: number }>();
    const ids = rows.map((row) => row.id);
    const { data: lines, error: linesError } = await supabase
      .from("stocktake_items")
      .select("stocktake_id, counted_quantity")
      .in("stocktake_id", ids);
    if (linesError) throw new AuthorizationError("GENERIC", linesError.message);
    const counts = new Map<string, { total: number; counted: number }>();
    for (const id of ids) counts.set(id, { total: 0, counted: 0 });
    for (const line of lines ?? []) {
      const entry = counts.get(line.stocktake_id);
      if (!entry) continue;
      entry.total += 1;
      if (line.counted_quantity !== null) entry.counted += 1;
    }
    return counts;
  })();

  return {
    items: rows.map((row) => {
      const counts = lineCounts.get(row.id) ?? { total: 0, counted: 0 };
      return {
        ...toListItem(row, ctx),
        totalLines: counts.total,
        countedLines: counts.counted,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lightweight unpaged list for selectors/dashboards. */
export async function listStocktakes(
  establishmentId: string,
  options: { limit?: number; statuses?: StocktakeStatus[] } = {}
): Promise<Stocktake[]> {
  const supabase = await createClient();
  let query = supabase
    .from("stocktakes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  }
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Stocktake[];
}

export async function getStocktakeCounts(
  establishmentId: string
): Promise<Partial<Record<StocktakeStatus, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stocktakes")
    .select("status")
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const counts: Partial<Record<StocktakeStatus, number>> = {};
  for (const row of data ?? []) {
    const status = row.status as StocktakeStatus;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/** Movements materialised by a VALIDATED stocktake (display in detail page). */
export async function getStocktakeStockMovements(
  establishmentId: string,
  stocktakeId: string
): Promise<
  Array<{
    id: string;
    ingredientName: string | null;
    direction: "in" | "out";
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
    .eq("stocktake_id", stocktakeId)
    .order("created_at", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as Database["public"]["Tables"]["stock_movements"]["Row"][];
  if (rows.length === 0) return [];

  const [ingredients, units] = await Promise.all([
    ingredientNameMap(
      establishmentId,
      rows.map((row) => row.ingredient_id)
    ),
    unitSymbolMap(
      rows
        .flatMap((row) => [row.base_unit_id, row.unit_id])
        .filter((id): id is string => Boolean(id))
    ),
  ]);

  return rows.map((row) => ({
    id: row.id,
    ingredientName: ingredients.get(row.ingredient_id)?.name ?? null,
    direction: row.direction ?? (row.movement_type === "adjustment_in" ? "in" : "out"),
    baseQuantity: row.base_quantity ?? row.quantity,
    baseUnitSymbol: row.base_unit_id ? units.get(row.base_unit_id) ?? null : null,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    createdAt: row.created_at,
  }));
}

/** Active inventory locations (stocktake builder). */
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

/** Stock-tracked ingredients, for the manual scope selector of the create form. */
export async function listStocktakeIngredients(
  establishmentId: string
): Promise<Array<{ id: string; name: string | null; sku: string | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, sku")
    .eq("establishment_id", establishmentId)
    .eq("is_stock_tracked", true)
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Array<{ id: string; name: string | null; sku: string | null }>;
}

/** Next sequential number preview (INV-YYYY-NNNNNN) from the DB. */
export async function nextStocktakeNumberPreview(
  establishmentId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_stocktake_number", {
    p_est: establishmentId,
  });
  if (error) throw toAuthorizationError(error);
  return (data ?? "") as string;
}

// ---------------------------------------------------------------------------
// Writes (always through the atomic security-definer RPCs)
// ---------------------------------------------------------------------------

/** Map approval thresholds to RPC parameters. */
function thresholdParams(thresholds: StocktakeThresholds) {
  return {
    p_approval_percent: thresholds.approvalPercentage,
    p_approval_value: thresholds.approvalValue,
  };
}

export async function createStocktake(
  establishmentId: string,
  input: Omit<CreateStocktakeInput, "establishmentId">
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stocktake", {
    p_est: establishmentId,
    p_inventory_location_id: input.inventoryLocationId,
    p_mode: input.mode,
    p_notes: input.notes ?? null,
  });
  if (error) throw toAuthorizationError(error);
  return data as string;
}

export async function startStocktake(
  establishmentId: string,
  input: Omit<StartStocktakeInput, "establishmentId">
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: input.stocktakeId,
    p_scope: input.scope,
    p_include_zero_stock: input.includeZeroStock,
    p_ingredient_ids:
      input.scope === "selected" && input.ingredientIds.length > 0
        ? input.ingredientIds
        : null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function updateStocktakeItemCount(
  establishmentId: string,
  input: Omit<StocktakeCountInput, "establishmentId">
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_stocktake_item_count", {
    p_est: establishmentId,
    p_stocktake_id: input.stocktakeId,
    p_item_id: input.itemId,
    p_amount: input.amount,
    p_unit_id: input.unitId ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

/** Re-enrichment of the theoretical quantities (used by review/detail pages). */
export async function reconcileStocktake(
  establishmentId: string,
  stocktakeId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reconcile_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function completeStocktake(
  establishmentId: string,
  stocktakeId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function approveStocktake(
  establishmentId: string,
  stocktakeId: string,
  thresholds: StocktakeThresholds
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
    ...thresholdParams(thresholds),
  });
  if (error) throw toAuthorizationError(error);
}

export async function validateStocktake(
  establishmentId: string,
  stocktakeId: string,
  thresholds: StocktakeThresholds
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("validate_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
    ...thresholdParams(thresholds),
  });
  if (error) throw toAuthorizationError(error);
}

export async function cancelStocktake(
  establishmentId: string,
  stocktakeId: string,
  reason: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
    p_reason: reason ?? null,
  });
  if (error) throw toAuthorizationError(error);
}

export async function deleteStocktake(
  establishmentId: string,
  stocktakeId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stocktake", {
    p_est: establishmentId,
    p_stocktake_id: stocktakeId,
  });
  if (error) throw toAuthorizationError(error);
}