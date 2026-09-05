import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import { getAuthorizationContext } from "./authorization";
import { getCatalogCached } from "@/services/units-cache";
import { MAX_SUBRECIPE_DEPTH } from "@/lib/recipes/constants";
import { validateYieldDefinition } from "@/lib/yields/validation";
import { consumptionPerOutput } from "@/lib/yields/calculations";
import type {
  YieldDefinition,
  YieldOutput,
  YieldSelection,
} from "@/lib/yields/types";
import type { Unit } from "@/lib/units/types";
import type { Database } from "@/types/database";

export type RecipeYieldRow =
  Database["public"]["Tables"]["recipe_yields"]["Row"];

/** Supabase typed insert/update payload shape (snake_case columns). */
export type RecipeYieldWriteInput = {
  yield_type: string;
  input_quantity: number | null;
  input_unit_id: string | null;
  output_quantity: number | null;
  output_unit_id: string | null;
  minimum_yield: number | null;
  standard_yield: number | null;
  maximum_yield: number | null;
  yield_percentage: number | null;
  notes: string | null;
  is_active: boolean;
};

/** Yield row joined with the resolved unit identities for the UI. */
export interface RecipeYieldView {
  row: RecipeYieldRow | null;
  definition: YieldDefinition | null;
  inputUnit: Unit | null;
  outputUnit: Unit | null;
}

export interface ItemConsumption {
  itemId: string;
  label: string;
  unitSymbol: string | null;
  /** Raw quantity of the item expressed in `unitSymbol`. */
  quantity: number;
  /** Input consumed to produce ONE output (quantity / outputs). */
  perOutput: number | null;
}

export interface TheoreticalConsumptionResult {
  consumed: boolean;
  active: boolean;
  output: YieldOutput | null;
  /** Per-output consumption in the input unit (range-aware). */
  estimate: {
    inputUnitId: string | null;
    inputSymbol: string | null;
    min: number | null;
    standard: number | null;
    max: number | null;
    percentage: number | null;
  };
  /** Per-item consumption to produce ONE output. */
  items: ItemConsumption[];
  depth: number;
  cycleRefused: boolean;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One yield definition per recipe version (row + resolved units + definition). */
export async function getRecipeYield(
  establishmentId: string,
  recipeId: string
): Promise<RecipeYieldView> {
  const supabase = await createClient();
  const recipe = await getRecipeRow(establishmentId, recipeId);
  if (recipe.is_system) return emptyView();

  const { data, error } = await supabase
    .from("recipe_yields")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);

  if (!data) return emptyView();

  const catalog = await getCatalogCached(establishmentId);
  const inputUnit =
    catalog.units.find((u) => u.id === data.input_unit_id) ?? null;
  const outputUnit =
    catalog.units.find((u) => u.id === data.output_unit_id) ?? null;

  return {
    row: data as RecipeYieldRow,
    definition: toDefinition(data as RecipeYieldRow),
    inputUnit,
    outputUnit,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Upserts the yield of a recipe version and keeps the header fields coherent. */
export async function saveRecipeYield(
  establishmentId: string,
  recipeId: string,
  input: RecipeYieldWriteInput
): Promise<{ created: boolean }> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const issues = validateYieldDefinitionWithCatalog(input);
  if (issues.length > 0) {
    throw new AuthorizationError("YIELD_INVALID", issues.join(","));
  }

  const prior = await supabase
    .from("recipe_yields")
    .select("id")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  const payload: RecipeYieldWriteInput = {
    yield_type: input.yield_type,
    input_quantity: input.input_quantity,
    input_unit_id: input.input_unit_id,
    output_quantity: input.output_quantity,
    output_unit_id: input.output_unit_id,
    minimum_yield: input.minimum_yield,
    standard_yield: input.standard_yield,
    maximum_yield: input.maximum_yield,
    yield_percentage: input.yield_percentage,
    notes: input.notes,
    is_active: input.is_active,
  };

  const upsertInput = {
    recipe_id: recipeId,
    ...payload,
  };
  if (prior.error) throw toAuthorizationError(prior.error);
  if (!prior.data) {
    const { error } = await supabase
      .from("recipe_yields")
      .insert([upsertInput] as never);
    if (error) throw toAuthorizationError(error);
  } else {
    const { error } = await supabase
      .from("recipe_yields")
      .update(payload as never)
      .eq("id", prior.data.id);
    if (error) throw toAuthorizationError(error);
  }

  // Sync the Phase-11 recipe header so list/detail views stay coherent.
  const standard = standardYieldForHeader(input);
  const context = await getAuthorizationContext();
  const { error: headerError } = await supabase
    .from("recipes")
    .update({
      yield_type: input.yield_type,
      default_yield: standard,
      yield_unit_id: input.output_unit_id,
      updated_by: context.userId,
    })
    .eq("id", recipeId);
  if (headerError) throw toAuthorizationError(headerError);

  return { created: !prior.data };
}

/** Toggles the active flag of a recipe yield (no data loss). */
export async function setRecipeYieldActive(
  establishmentId: string,
  recipeId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const { error } = await supabase
    .from("recipe_yields")
    .update({ is_active: isActive })
    .eq("recipe_id", recipeId);
  if (error) throw toAuthorizationError(error);
}

/**
 * Deletes the yield definition of a recipe version and resets the Phase-11
 * recipe header to its neutral defaults (yield_type = 'exact_consumption',
 * default_yield = 1, yield_unit_id = null) so the recipe coherently reports
 * "yield not configured". The recipe_yields columns are NOT NULL, hence the
 * defaults rather than NULL. System recipes are protected. No stock data is
 * ever touched.
 */
export async function deleteRecipeYield(
  establishmentId: string,
  recipeId: string
): Promise<void> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const { error } = await supabase
    .from("recipe_yields")
    .delete()
    .eq("recipe_id", recipeId);
  if (error) throw toAuthorizationError(error);

  const context = await getAuthorizationContext();
  const { error: headerError } = await supabase
    .from("recipes")
    .update({
      yield_type: "exact_consumption",
      default_yield: 1,
      yield_unit_id: null,
      updated_by: context.userId,
    })
    .eq("id", recipeId);
  if (headerError) throw toAuthorizationError(headerError);
}

// ---------------------------------------------------------------------------
// Theoretical consumption (display-only — no input ever moves stock)
// ---------------------------------------------------------------------------

/**
 * Per-output theoretical consumption of a recipe and its composition
 * (sub-recipes resolved recursively with `MAX_SUBRECIPE_DEPTH` guard + cycle
 * refusal). NEVER writes to the database.
 */
export async function calculateTheoreticalConsumption(
  establishmentId: string,
  recipeId: string,
  options: { depth?: number; visited?: Set<string> } = {}
): Promise<TheoreticalConsumptionResult> {
  const depth = options.depth ?? 0;
  if (depth > MAX_SUBRECIPE_DEPTH) {
    return {
      consumed: false,
      active: false,
      output: null,
      estimate: { inputUnitId: null, inputSymbol: null, min: null, standard: null, max: null, percentage: null },
      items: [],
      depth,
      cycleRefused: true,
    };
  }

  const supabase = await createClient();
  const view = await getRecipeYield(establishmentId, recipeId);
  const row = view.row;
  const def = view.definition;
  const output = def ? yieldOutputFor(def) : null;

  // No yield configured yet → nothing to consume against.
  if (!row || !def || !output) {
    return {
      consumed: false,
      active: row?.is_active ?? false,
      output: null,
      estimate: { inputUnitId: def?.inputUnitId ?? null, inputSymbol: view.inputUnit?.symbol ?? null, min: null, standard: null, max: null, percentage: null },
      items: [],
      depth,
      cycleRefused: false,
    };
  }

  const visited = options.visited ?? new Set<string>();
  if (visited.has(recipeId)) {
    return {
      consumed: false,
      active: row.is_active,
      output,
      estimate: { inputUnitId: def.inputUnitId, inputSymbol: view.inputUnit?.symbol ?? null, min: null, standard: null, max: null, percentage: null },
      items: [],
      depth,
      cycleRefused: true,
    };
  }
  visited.add(recipeId);

  const { data: itemRows, error } = await supabase
    .from("recipe_items")
    .select("id, ingredient_id, sub_recipe_id, quantity, unit_id, sort_order")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const catalog = await getCatalogCached(establishmentId);

  const ingredientIds: string[] = [];
  const subRecipeIds: string[] = [];
  for (const item of itemRows ?? []) {
    if (item.ingredient_id) ingredientIds.push(item.ingredient_id);
    if (item.sub_recipe_id) subRecipeIds.push(item.sub_recipe_id);
  }

  const [ingredients, subRecipes] = await Promise.all([
    fetchIngredients(establishmentId, ingredientIds),
    fetchSubRecipes(establishmentId, subRecipeIds),
  ]);
  const ingredientName = new Map(
    ingredients.map((i) => [i.id, i.name])
  );
  const subRecipeName = new Map(
    subRecipes.map((r) => [r.id, r.name])
  );
  const unitSymbol = new Map(
    catalog.units.filter((u) => u.id).map((u) => [u.id, u.symbol])
  );

  const count = output.count;

  const items: ItemConsumption[] = (itemRows ?? []).map((item) => {
    const unitId = item.unit_id;
    const label = item.sub_recipe_id
      ? (subRecipeName.get(item.sub_recipe_id) ?? item.sub_recipe_id)
      : (ingredientName.get(item.ingredient_id ?? "") ?? "—");
    const perOutput = Number(item.quantity) / count;
    return {
      itemId: item.id,
      label,
      unitSymbol: unitId ? (unitSymbol.get(unitId) ?? null) : null,
      quantity: Number(item.quantity),
      perOutput,
    };
  });

  const subConsumption: ItemConsumption[] = [];
  for (const id of subRecipeIds) {
    const nested = await calculateTheoreticalConsumption(
      establishmentId,
      id,
      { depth: depth + 1, visited }
    );
    if (nested.cycleRefused || !nested.consumed) continue;

    const parentBatch = nested.estimate.standard;
    for (const parent of items) {
      const parentId = (itemRows ?? []).find(
        (r) => r.id === parent.itemId
      )?.sub_recipe_id;
      if (!parentId || parentId !== id) continue;

      const perOutput =
        parentBatch !== null && parent.perOutput !== null
          ? parent.perOutput * parentBatch
          : null;
      subConsumption.push({
        itemId: parent.itemId,
        label: parent.label,
        unitSymbol: nested.estimate.inputSymbol,
        quantity: parent.quantity,
        perOutput,
      });
    }
  }

  visited.delete(recipeId);

  return {
    consumed: true,
    active: row.is_active,
    output,
    estimate: {
      inputUnitId: def.inputUnitId,
      inputSymbol: view.inputUnit?.symbol ?? null,
      min: consumptionForSelection(def, "min"),
      standard: consumptionForSelection(def, "standard"),
      max: consumptionForSelection(def, "max"),
      percentage: def.yieldType === "percentage_yield"
        ? def.yieldPercentage
        : null,
    },
    items: [...items, ...subConsumption],
    depth,
    cycleRefused: false,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function emptyView(): RecipeYieldView {
  return { row: null, definition: null, inputUnit: null, outputUnit: null };
}

async function getRecipeRow(
  establishmentId: string,
  recipeId: string
): Promise<Database["public"]["Tables"]["recipes"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "recipe_not_found");
  }
  return data;
}

async function fetchIngredients(
  establishmentId: string,
  ingredientIds: string[]
): Promise<Database["public"]["Tables"]["ingredients"]["Row"][]> {
  if (ingredientIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("establishment_id", establishmentId)
    .in("id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Database["public"]["Tables"]["ingredients"]["Row"][];
}

async function fetchSubRecipes(
  _establishmentId: string,
  subRecipeIds: string[]
): Promise<Database["public"]["Tables"]["recipes"]["Row"][]> {
  if (subRecipeIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name")
    .in("id", subRecipeIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Database["public"]["Tables"]["recipes"]["Row"][];
}

function toDefinition(row: RecipeYieldRow): YieldDefinition {
  return {
    yieldType: row.yield_type as YieldDefinition["yieldType"],
    inputQuantity: row.input_quantity === null ? null : Number(row.input_quantity),
    inputUnitId: row.input_unit_id,
    outputQuantity: row.output_quantity === null ? null : Number(row.output_quantity),
    outputUnitId: row.output_unit_id,
    minimumYield: row.minimum_yield === null ? null : Number(row.minimum_yield),
    standardYield: row.standard_yield === null ? null : Number(row.standard_yield),
    maximumYield: row.maximum_yield === null ? null : Number(row.maximum_yield),
    yieldPercentage:
      row.yield_percentage === null ? null : Number(row.yield_percentage),
    isActive: row.is_active,
  };
}

function yieldOutputFor(def: YieldDefinition): YieldOutput | null {
  if (!def.outputUnitId) return null;
  const base =
    def.yieldType === "range_yield"
      ? def.standardYield
      : def.outputQuantity ?? def.standardYield;
  if (base === null || base <= 0) return null;
  return { count: base, unitId: def.outputUnitId };
}

function consumptionForSelection(
  def: YieldDefinition,
  selection: YieldSelection
): number | null {
  return consumptionPerOutput(def, selection);
}

function standardYieldForHeader(input: {
  yield_type: string;
  standard_yield: number | null;
  output_quantity: number | null;
}): number {
  if (input.standard_yield !== null && input.standard_yield > 0) {
    return input.standard_yield;
  }
  return input.output_quantity ?? 1;
}

/**
 * Runs the pure domain validation (the catalog is unused by the engine: input
 * and output units live in different semantic spaces and are never converted).
 */
function validateYieldDefinitionWithCatalog(
  input: Partial<RecipeYieldWriteInput>
): string[] {
  return validateYieldDefinition({
    yieldType: (input.yield_type ?? "exact_consumption") as YieldDefinition["yieldType"],
    inputQuantity: input.input_quantity ?? null,
    inputUnitId: input.input_unit_id ?? null,
    outputQuantity: input.output_quantity ?? null,
    outputUnitId: input.output_unit_id ?? null,
    minimumYield: input.minimum_yield ?? null,
    standardYield: input.standard_yield ?? null,
    maximumYield: input.maximum_yield ?? null,
    yieldPercentage: input.yield_percentage ?? null,
    isActive: input.is_active,
  });
}