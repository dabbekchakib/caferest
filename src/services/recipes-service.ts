import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import { getAuthorizationContext } from "./authorization";
import type {
  Recipe,
  RecipeItem,
  RecipeItemWithRefs,
  RecipeListViewItem,
  RecipeSelectorEntry,
  RecipeTranslationsMap,
  RecipeWithDetail,
  RecipeWithTranslations,
  RecipeStatus,
  RecipeCostBreakdown,
} from "@/lib/recipes/types";
import { groupRecipeTranslations } from "@/lib/recipes/translations";
import { calculateIngredientCostPerBaseUnit } from "@/lib/ingredients/cost";
import {
  calculateRecipeItemRawCost,
  calculateRecipeRawCost,
} from "@/lib/recipes/costing";
import {
  subRecipeAdjacency,
  wouldCreateSubRecipeCycle,
} from "@/lib/recipes/graph";
import { RECIPE_MIN_ITEMS_FOR_ACTIVE } from "@/lib/recipes/constants";
import { getCatalogCached } from "@/services/units-cache";
import type { Ingredient } from "@/lib/ingredients/types";
import type { UnitConversion } from "@/lib/units/types";

/** Master/fallback text fields always written to `recipes` (locale = fr). */
export interface RecipeContentFields {
  name: string;
  description?: string | null;
  notes?: string | null;
}

export interface RecipeCreateInput extends RecipeContentFields {
  productId: string;
  yieldType?: RecipeWithTranslations["yield_type"];
  defaultYield?: number;
  yieldUnitId?: string | null;
  preparationTime?: number | null;
  sortOrder?: number;
  translations?: RecipeTranslationInput[];
}

export interface RecipeTranslationInput {
  locale: "en" | "ar";
  name?: string;
  description?: string | null;
  notes?: string | null;
}

export interface RecipeUpdateInput {
  name?: string;
  description?: string | null;
  notes?: string | null;
  yieldType?: RecipeWithTranslations["yield_type"];
  defaultYield?: number;
  yieldUnitId?: string | null;
  preparationTime?: number | null;
  sortOrder?: number;
  translations?: RecipeTranslationInput[];
}

export interface ItemInput {
  ingredientId?: string | null;
  subRecipeId?: string | null;
  quantity: number;
  unitId?: string | null;
  wastePercentage?: number;
  notes?: string | null;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getRecipe(
  establishmentId: string,
  recipeId: string
): Promise<RecipeWithTranslations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const translated = await enrichWithTranslations([data]);
  return translated[0] ?? null;
}

/** Recipe + translations + fetched items (with resolved refs). */
export async function getRecipeWithItems(
  establishmentId: string,
  recipeId: string
): Promise<RecipeWithDetail | null> {
  const recipe = await getRecipe(establishmentId, recipeId);
  if (!recipe) return null;

  const items = await fetchRecipeItemsWithRefs(establishmentId, recipeId);
  return { ...recipe, items };
}

/** Unpaged recipe catalog with the linked product identity for display. */
export async function listRecipes(
  establishmentId: string,
  options: {
    activeOnly?: boolean;
    productId?: string | null;
    status?: RecipeStatus | null;
    query?: string;
    limit?: number;
  } = {}
): Promise<RecipeListViewItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("version", { ascending: true })
    .limit(Math.min(500, Math.max(1, options.limit ?? 200)));

  if (options.activeOnly) query = query.eq("status", "active");
  if (options.productId) query = query.eq("product_id", options.productId);
  if (options.status) query = query.eq("status", options.status);
  if (options.query && options.query.trim()) {
    query = query.ilike("name", `%${options.query.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const translated = await enrichWithTranslations(data ?? []);
  const productNames = await productNameLookup(
    establishmentId,
    translated.map((recipe) => recipe.product_id)
  );

  return translated.map((recipe) => ({
    ...recipe,
    productName: productNames.get(recipe.product_id)?.name ?? recipe.product_id,
    productSlug: productNames.get(recipe.product_id)?.slug ?? "",
  }));
}

/** All versions of a product (for the version switch / default picker). */
export async function listRecipeVersions(
  establishmentId: string,
  recipeId: string
): Promise<RecipeListViewItem[]> {
  const recipe = await getRecipeRow(establishmentId, recipeId);
  return listRecipes(establishmentId, { productId: recipe.product_id });
}

/** Recipes referencing the ingredient in any of their compositions. */
export async function listRecipesUsingIngredient(
  establishmentId: string,
  ingredientId: string
): Promise<RecipeListViewItem[]> {
  const supabase = await createClient();
  const { data: refs, error } = await supabase
    .from("recipe_items")
    .select("recipe_id")
    .eq("ingredient_id", ingredientId);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const recipeIds = refs?.map((row) => row.recipe_id) ?? [];
  if (recipeIds.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", recipeIds)
    .order("sort_order", { ascending: true })
    .order("version", { ascending: true })
    .limit(200);
  if (rowsError) throw new AuthorizationError("GENERIC", rowsError.message);

  const translated = await enrichWithTranslations(rows ?? []);
  const productNames = await productNameLookup(
    establishmentId,
    translated.map((recipe) => recipe.product_id)
  );

  return translated.map((recipe) => ({
    ...recipe,
    productName: productNames.get(recipe.product_id)?.name ?? recipe.product_id,
    productSlug: productNames.get(recipe.product_id)?.slug ?? "",
  }));
}

/** Recipes usable as sub-recipes (search-friendly selector entries). */
export async function searchRecipeSelectorEntries(
  establishmentId: string,
  options: { limit?: number; excludingRecipeId?: string } = {}
): Promise<RecipeSelectorEntry[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 20;

  let builder = supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("is_system", false)
    .in("status", ["active", "draft", "inactive"])
    .order("name", { ascending: true })
    .limit(limit);

  if (options.excludingRecipeId) {
    builder = builder.neq("id", options.excludingRecipeId);
  }

  const { data, error } = await builder;
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = data ?? [];
  const translated = await enrichWithTranslations(rows);
  const itemCounts = await countItemsForRecipes(
    rows.map((row) => row.id)
  );
  const productNames = await productNameLookup(
    establishmentId,
    rows.map((row) => row.product_id)
  );

  return translated.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    version: recipe.version,
    status: recipe.status,
    isDefault: recipe.is_default,
    hasItems: (itemCounts.get(recipe.id) ?? 0) > 0,
    itemCount: itemCounts.get(recipe.id) ?? 0,
    cost: null,
    productName: productNames.get(recipe.product_id)?.name ?? null,
  }));
}

export async function countRecipes(establishmentId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createRecipe(
  establishmentId: string,
  input: RecipeCreateInput
): Promise<Recipe> {
  const supabase = await createClient();
  await assertProductReference(establishmentId, input.productId);
  const context = await getAuthorizationContext();

  const version = await nextVersion(establishmentId, input.productId);

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      establishment_id: establishmentId,
      product_id: input.productId,
      name: input.name.trim(),
      description: input.description ?? null,
      notes: input.notes ?? null,
      yield_type: input.yieldType ?? "exact_consumption",
      default_yield: input.defaultYield ?? 1,
      yield_unit_id: input.yieldUnitId ?? null,
      preparation_time: input.preparationTime ?? null,
      version,
      status: "draft",
      is_default: false,
      is_active: false,
      sort_order: input.sortOrder ?? 10,
      is_system: false,
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select()
    .single();
  if (error) throw toRecipeError(error);

  await upsertTranslations(supabase, data.id, input.translations ?? []);
  return data;
}

export async function updateRecipe(
  establishmentId: string,
  recipeId: string,
  input: RecipeUpdateInput
): Promise<RecipeWithTranslations> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.yieldType !== undefined) patch.yield_type = input.yieldType;
  if (input.defaultYield !== undefined) patch.default_yield = input.defaultYield;
  if (input.yieldUnitId !== undefined) patch.yield_unit_id = input.yieldUnitId;
  if (input.preparationTime !== undefined) {
    patch.preparation_time = input.preparationTime;
  }
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const context = await getAuthorizationContext();
  patch.updated_by = context.userId;

  const { error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .eq("is_system", false)
    .select()
    .single();
  if (error) throw toRecipeError(error);

  if (input.translations) {
    await upsertTranslations(supabase, recipeId, input.translations);
  }

  const enriched = await getRecipe(establishmentId, recipeId);
  return (
    enriched ??
    (() => {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "recipe_not_found");
    })()
  );
}

/**
 * Deletes a draft recipe physically when it has never been referenced and is
 * not default; otherwise archives it (recipes are production data — archive is
 * the "soft delete" that keeps history and sub-recipe integrity).
 */
export async function deleteRecipe(
  establishmentId: string,
  recipeId: string
): Promise<{ archived: boolean }> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const referenced = await isReferencedAsSubRecipe(recipeId);
  const isDefault = existing.is_default && existing.status !== "archived";

  if (existing.status === "draft" && !referenced && !isDefault) {
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("establishment_id", establishmentId)
      .eq("id", recipeId)
      .eq("is_system", false);
    if (error) throw toRecipeError(error);
    return { archived: false };
  }

  // Soft path: archive (an archived recipe can never be default again).
  const context = await getAuthorizationContext();
  const { error: archiveError } = await supabase
    .from("recipes")
    .update({
      status: "archived",
      is_active: false,
      is_default: false,
      updated_by: context.userId,
    })
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .eq("is_system", false);
  if (archiveError) throw toRecipeError(archiveError);

  return { archived: true };
}

/** draft→active / active→inactive transitions with the item-count guard. */
export async function setRecipeStatus(
  establishmentId: string,
  recipeId: string,
  status: RecipeStatus
): Promise<RecipeWithTranslations> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }
  await assertStatusTransition(establishmentId, recipeId, existing, status);

  const patch: Record<string, unknown> = {
    status,
    is_active: status === "active",
  };
  if (status !== "active" && existing.is_default) {
    patch.is_default = false;
  }

  const context = await getAuthorizationContext();
  patch.updated_by = context.userId;

  const { error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .eq("is_system", false)
    .select()
    .single();
  if (error) throw toRecipeError(error);

  return getRequired(establishmentId, recipeId);
}

/** Sets the recipe as the product default (must be active). */
export async function setDefaultRecipe(
  establishmentId: string,
  recipeId: string
): Promise<RecipeWithTranslations> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }
  if (existing.status !== "active") {
    throw new AuthorizationError("RECIPE_ACTIVE_REQUIRED", "recipe_active_required");
  }

  // Clear default on every other product recipe, then flag the current one
  // (the partial unique index guarantees one active default globally).
  const { error: clearError } = await supabase
    .from("recipes")
    .update({ is_default: false })
    .eq("establishment_id", establishmentId)
    .eq("product_id", existing.product_id)
    .eq("is_default", true)
    .neq("id", recipeId)
    .eq("is_system", false);
  if (clearError) throw toRecipeError(clearError);

  const context = await getAuthorizationContext();
  const { error } = await supabase
    .from("recipes")
    .update({ is_default: true, updated_by: context.userId })
    .eq("establishment_id", establishmentId)
    .eq("id", recipeId)
    .eq("is_system", false)
    .select()
    .single();
  if (error) throw toRecipeError(error);

  return getRequired(establishmentId, recipeId);
}

/** Duplicates an existing recipe as `draft`, `v+1`, non-default. */
export async function duplicateRecipe(
  establishmentId: string,
  recipeId: string
): Promise<RecipeWithTranslations> {
  const supabase = await createClient();
  const source = await getRecipeRow(establishmentId, recipeId);
  const sourceTranslations = await fetchTranslationsFor([source.id]);
  const context = await getAuthorizationContext();

  const version = await nextVersion(establishmentId, source.product_id);

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      establishment_id: establishmentId,
      product_id: source.product_id,
      name: `${source.name} (copie)`,
      description: source.description,
      notes: source.notes,
      yield_type: source.yield_type,
      default_yield: Number(source.default_yield),
      yield_unit_id: source.yield_unit_id,
      preparation_time: source.preparation_time,
      version,
      status: "draft",
      is_default: false,
      is_active: false,
      sort_order: source.sort_order + 10,
      is_system: false,
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select()
    .single();
  if (error) throw toRecipeError(error);

  const sourceItems = await fetchRecipeItems(establishmentId, source.id);
  if (sourceItems.length > 0) {
    await insertItems(supabase, data.id, sourceItems);
  }

  const translations = sourceTranslations[source.id];
  await upsertTranslations(
    supabase,
    data.id,
    (["en", "ar"] as const)
      .map((locale) => {
        const tr = translations?.[locale];
        return tr
          ? {
              locale,
              name: tr.name,
              description: tr.description,
              notes: tr.notes,
            }
          : null;
      })
      .filter(
        (row): row is {
          locale: "en" | "ar";
          name: string;
          description: string | null;
          notes: string | null;
        } => row !== null
      )
  );

  return getRequired(establishmentId, data.id);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/**
 * Replaces the composition of a recipe in one call: validates every reference
 * (same-establishment ingredient/sub-recipe/unit) and the cycle-safety rule,
 * then applies delete-all / insert-all.
 */
export async function saveRecipeItems(
  establishmentId: string,
  recipeId: string,
  items: ItemInput[]
): Promise<void> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const clean = items.map((item, index) => ({
    ingredient_id: item.ingredientId ?? null,
    sub_recipe_id: item.subRecipeId ?? null,
    quantity: item.quantity,
    unit_id: item.unitId ?? null,
    waste_percentage: item.wastePercentage ?? 0,
    notes: item.notes ?? null,
    sort_order: item.sortOrder ?? (index + 1) * 10,
  }));

  await assertReferencesForItems(establishmentId, clean);
  await assertNoItemCycles(establishmentId, recipeId, clean);

  await supabase
    .from("recipe_items")
    .delete()
    .eq("recipe_id", recipeId);

  if (clean.length > 0) {
    const { error } = await supabase.from("recipe_items").insert(
      clean.map((row) => ({ recipe_id: recipeId, ...row }))
    );
    if (error) throw toRecipeError(error);
  }
}

export async function reorderRecipeItems(
  establishmentId: string,
  recipeId: string,
  orderedIds: string[]
): Promise<void> {
  const supabase = await createClient();
  const existing = await getRecipeRow(establishmentId, recipeId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_RECIPE_PROTECTED");
  }

  const items = await fetchRecipeItems(establishmentId, recipeId);
  const ids = new Set(items.map((item) => item.id));
  if (
    orderedIds.length !== items.length ||
    orderedIds.some((id) => !ids.has(id))
  ) {
    throw new AuthorizationError("GENERIC", "reorder_invalid_membership");
  }

  const writes = orderedIds.map(async (id, index) => {
    const item = items.find((i) => i.id === id);
    const nextSort = (index + 1) * 10;
    if (!item || item.sort_order === nextSort) return;
    const { error } = await supabase
      .from("recipe_items")
      .update({ sort_order: nextSort })
      .eq("id", id);
    if (error) throw toRecipeError(error);
  });
  await Promise.all(writes);
}

// ---------------------------------------------------------------------------
// Validation + costing (preparatory; display-only)
// ---------------------------------------------------------------------------

export interface RecipeValidationIssue {
  code: "RECIPE_EMPTY" | "RECIPE_CYCLE" | "RECIPE_INVALID_ITEM";
  itemId?: string;
}

/** Business validation used by the activate guard and the UI hints. */
export async function validateRecipe(
  establishmentId: string,
  recipeId: string
): Promise<{ valid: boolean; issues: RecipeValidationIssue[] }> {
  const items = await fetchRecipeItems(establishmentId, recipeId);
  const issues: RecipeValidationIssue[] = [];

  if (items.length === 0) {
    issues.push({ code: "RECIPE_EMPTY" });
  }

  const supabase = await createClient();
  const { data: allEdges, error } = await supabase
    .from("recipe_items")
    .select("recipe_id, sub_recipe_id")
    .not("sub_recipe_id", "is", null);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const edges: Array<{ recipeId: string; subRecipeId: string }> = [];
  for (const row of allEdges ?? []) {
    if (row.recipe_id === recipeId) continue;
    if (row.sub_recipe_id) {
      edges.push({ recipeId: row.recipe_id, subRecipeId: row.sub_recipe_id });
    }
  }
  const adjacency = subRecipeAdjacency(edges);

  for (const item of items) {
    if (item.sub_recipe_id && wouldCreateSubRecipeCycle(adjacency, recipeId, item.sub_recipe_id)) {
      issues.push({ code: "RECIPE_CYCLE", itemId: item.id });
    }
    if (!item.ingredient_id && !item.sub_recipe_id) {
      issues.push({ code: "RECIPE_INVALID_ITEM", itemId: item.id });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Cost guard used at the action layer (requires `recipes.cost-view`). */
export async function getRecipeCost(
  establishmentId: string,
  recipeId: string
): Promise<RecipeCostBreakdown> {
  const recipe = await getRecipeRow(establishmentId, recipeId);
  void recipe;
  const items = await fetchRecipeItems(establishmentId, recipeId);
  const catalog = await getCatalogCached(establishmentId);

  const ingredientIds = items
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const ingredients = ingredientIds.length
    ? await fetchIngredientsByIds(establishmentId, ingredientIds)
    : [];
  const ingredientCost = new Map<string, number | null>();
  for (const ingredient of ingredients) {
    ingredientCost.set(
      ingredient.id,
      calculateIngredientCostPerBaseUnit({
        purchaseCost: Number(ingredient.purchase_cost),
        purchaseQuantity: Number(ingredient.purchase_quantity),
        purchaseUnitId: ingredient.purchase_unit_id ?? "",
        baseUnitId: ingredient.base_unit_id ?? null,
        conversions: catalog.conversions,
      })
    );
  }

  const subRecipeIds = items
    .map((item) => item.sub_recipe_id)
    .filter((id): id is string => Boolean(id));
  const subRecipeCosts = new Map<string, number>();
  for (const subRecipeId of subRecipeIds) {
    subRecipeCosts.set(
      subRecipeId,
      await resolveSubRecipeCost(
        establishmentId,
        subRecipeId,
        catalog.conversions,
        new Set<string>(),
        0
      )
    );
  }

  const unitSymbols = await unitSymbolLookup(
    items
      .map((item) => item.unit_id)
      .filter((id): id is string => Boolean(id))
  );

  const itemParams = items.map((item) => {
    const ingredient = ingredients.find((i) => i.id === item.ingredient_id) ?? null;
    return {
      quantity: Number(item.quantity),
      unitId: item.unit_id,
      baseUnitId: item.ingredient_id ? ingredient?.base_unit_id ?? null : null,
      costPerBaseUnit: item.ingredient_id
        ? ingredientCost.get(item.ingredient_id) ?? null
        : null,
      subRecipeCost: item.sub_recipe_id
        ? subRecipeCosts.get(item.sub_recipe_id) ?? null
        : null,
      conversions: catalog.conversions,
    };
  });

  const result = calculateRecipeRawCost({
    items: itemParams,
    conversions: catalog.conversions,
  });

  return {
    recipeId,
    rawCost: result.missingData ? null : result.rawCost,
    missingData: result.missingData,
    items: items.map((item, index) => {
      const contribution = calculateRecipeItemRawCost(itemParams[index]);
      const ingredient = ingredients.find((i) => i.id === item.ingredient_id) ?? null;
      return {
        itemId: item.id,
        label: item.sub_recipe_id
          ? `#${item.sub_recipe_id}`
          : ingredient?.name ?? "-",
        quantity: Number(item.quantity),
        unitSymbol: item.unit_id ? unitSymbols.get(item.unit_id) ?? null : null,
        contribution,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function getRecipeRow(
  establishmentId: string,
  recipeId: string
): Promise<Recipe> {
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

async function getRequired(
  establishmentId: string,
  recipeId: string
): Promise<RecipeWithTranslations> {
  const enriched = await getRecipe(establishmentId, recipeId);
  if (!enriched) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "recipe_not_found");
  }
  return enriched;
}

async function enrichWithTranslations(
  recipes: Recipe[]
): Promise<RecipeWithTranslations[]> {
  if (recipes.length === 0) return [];
  const translations = await fetchTranslationsFor(
    recipes.map((recipe) => recipe.id)
  );
  return recipes.map((recipe) => ({
    ...recipe,
    translations: translations[recipe.id] ?? ({} as RecipeTranslationsMap),
  }));
}

async function fetchTranslationsFor(
  recipeIds: string[]
): Promise<Record<string, RecipeTranslationsMap>> {
  if (recipeIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_translations")
    .select("*")
    .in("recipe_id", recipeIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return groupRecipeTranslations(data ?? []);
}

async function upsertTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeId: string,
  translations: RecipeTranslationInput[]
): Promise<void> {
  for (const entry of translations) {
    const name = entry.name?.trim() ?? "";
    if (name === "") {
      await supabase
        .from("recipe_translations")
        .delete()
        .eq("recipe_id", recipeId)
        .eq("locale", entry.locale);
      continue;
    }
    const { error } = await supabase.from("recipe_translations").upsert(
      {
        recipe_id: recipeId,
        locale: entry.locale,
        name,
        description: entry.description ?? null,
        notes: entry.notes ?? null,
      },
      { onConflict: "recipe_id,locale" }
    );
    if (error) throw toRecipeError(error);
  }
}

async function fetchRecipeItems(
  establishmentId: string,
  recipeId: string
): Promise<RecipeItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_items")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as RecipeItem[];
}

/** Items with resolved display references (name, units, costs, sub-recipes). */
async function fetchRecipeItemsWithRefs(
  establishmentId: string,
  recipeId: string
): Promise<RecipeItemWithRefs[]> {
  const items = await fetchRecipeItems(establishmentId, recipeId);
  const catalog = await getCatalogCached(establishmentId);

  const ingredientIds = items
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const subRecipeIds = items
    .map((item) => item.sub_recipe_id)
    .filter((id): id is string => Boolean(id));

  const [ingredients, subRecipes, unitSymbols] = await Promise.all([
    ingredientIds.length
      ? fetchIngredientsByIds(establishmentId, ingredientIds)
      : [],
    subRecipeIds.length ? fetchRecipesByIds(establishmentId, subRecipeIds) : [],
    unitSymbolLookup(
      items
        .map((item) => item.unit_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]);

  const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));
  const subRecipeMap = new Map(subRecipes.map((item) => [item.id, item]));

  return items.map((item) => {
    const ingredient = item.ingredient_id
      ? ingredientMap.get(item.ingredient_id) ?? null
      : null;
    const subRecipe = item.sub_recipe_id
      ? subRecipeMap.get(item.sub_recipe_id) ?? null
      : null;
    return {
      ...item,
      ingredientName: ingredient?.name ?? null,
      ingredientSku: ingredient?.sku ?? null,
      ingredientBaseUnitId: ingredient?.base_unit_id ?? null,
      costPerBaseUnit: ingredient
        ? calculateIngredientCostPerBaseUnit({
            purchaseCost: Number(ingredient.purchase_cost),
            purchaseQuantity: Number(ingredient.purchase_quantity),
            purchaseUnitId: ingredient.purchase_unit_id ?? "",
            baseUnitId: ingredient.base_unit_id ?? null,
            conversions: catalog.conversions,
          })
        : null,
      subRecipeName: subRecipe?.name ?? null,
      subRecipeStatus: subRecipe?.status ?? null,
      subRecipeVersion: subRecipe?.version ?? null,
      unitSymbol: item.unit_id ? unitSymbols.get(item.unit_id) ?? null : null,
    };
  });
}

async function fetchIngredientsByIds(
  establishmentId: string,
  ingredientIds: string[]
): Promise<Ingredient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Ingredient[];
}

async function fetchRecipesByIds(
  establishmentId: string,
  recipeIds: string[]
): Promise<Recipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", recipeIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Recipe[];
}

async function productNameLookup(
  establishmentId: string,
  productIds: string[]
): Promise<Map<string, { name: string; slug: string }>> {
  const supabase = await createClient();
  const map = new Map<string, { name: string; slug: string }>();
  if (productIds.length === 0) return map;
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("establishment_id", establishmentId)
    .in("id", productIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  for (const row of data ?? []) {
    map.set(row.id, { name: row.name, slug: row.slug });
  }
  return map;
}

async function countItemsForRecipes(
  recipeIds: string[]
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const map = new Map<string, number>();
  if (recipeIds.length === 0) return map;
  const { data, error } = await supabase
    .from("recipe_items")
    .select("recipe_id")
    .in("recipe_id", recipeIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  for (const row of data ?? []) {
    map.set(row.recipe_id, (map.get(row.recipe_id) ?? 0) + 1);
  }
  return map;
}

async function unitSymbolLookup(unitIds: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const map = new Map<string, string>();
  const unique = [...new Set(unitIds)];
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("units")
    .select("id, symbol")
    .in("id", unique);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  for (const row of data ?? []) map.set(row.id, row.symbol);
  return map;
}

async function nextVersion(
  establishmentId: string,
  productId: string
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("version")
    .eq("establishment_id", establishmentId)
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const current = data && data.length > 0 ? Number(data[0].version) : 0;
  return current + 1;
}

async function assertProductReference(
  establishmentId: string,
  productId: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("establishment_id")
    .eq("id", productId)
    .maybeSingle();
  if (error || !data || data.establishment_id !== establishmentId) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "product_not_found");
  }
}

async function assertReferencesForItems(
  establishmentId: string,
  items: Array<{
    ingredient_id: string | null;
    sub_recipe_id: string | null;
    unit_id: string | null;
  }>
): Promise<void> {
  const supabase = await createClient();

  const ingredientIds = items
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const subRecipeIds = items
    .map((item) => item.sub_recipe_id)
    .filter((id): id is string => Boolean(id));
  const unitIds = items
    .map((item) => item.unit_id)
    .filter((id): id is string => Boolean(id));

  if (ingredientIds.length > 0) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, establishment_id")
      .in("id", ingredientIds);
    if (error) throw new AuthorizationError("GENERIC", error.message);
    const ok = new Map((data ?? []).map((row) => [row.id, row.establishment_id]));
    for (const id of ingredientIds) {
      if (ok.get(id) !== establishmentId) {
        throw new AuthorizationError("RECIPE_INVALID_ITEM", "ingredient_not_found");
      }
    }
  }

  if (subRecipeIds.length > 0) {
    const { data, error } = await supabase
      .from("recipes")
      .select("id, establishment_id")
      .in("id", subRecipeIds);
    if (error) throw new AuthorizationError("GENERIC", error.message);
    const ok = new Map((data ?? []).map((row) => [row.id, row.establishment_id]));
    for (const id of subRecipeIds) {
      if (ok.get(id) !== establishmentId) {
        throw new AuthorizationError("RECIPE_INVALID_ITEM", "sub_recipe_not_found");
      }
    }
  }

  for (const unitId of unitIds) {
    const { data, error } = await supabase
      .from("units")
      .select("establishment_id")
      .eq("id", unitId)
      .maybeSingle();
    if (error || !data) {
      throw new AuthorizationError("RECIPE_INVALID_ITEM", "unit_not_found");
    }
    if (
      data.establishment_id !== establishmentId &&
      data.establishment_id !== null
    ) {
      throw new AuthorizationError("RECIPE_INVALID_ITEM", "unit_not_found");
    }
  }
}

/**
 * Cycle safety: no sub-recipe item may create an A→B→A / A→B→C→A loop.
 * The check runs against the CURRENT database edges (excluding this recipe's
 * own edges, which the replaced composition supersedes).
 */
async function assertNoItemCycles(
  establishmentId: string,
  recipeId: string,
  items: Array<{ sub_recipe_id: string | null }>
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_items")
    .select("recipe_id, sub_recipe_id")
    .not("sub_recipe_id", "is", null);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const edges: Array<{ recipeId: string; subRecipeId: string }> = [];
  for (const row of data ?? []) {
    if (row.recipe_id === recipeId) continue;
    if (row.sub_recipe_id) {
      edges.push({ recipeId: row.recipe_id, subRecipeId: row.sub_recipe_id });
    }
  }

  const adjacency = subRecipeAdjacency(edges);
  for (const item of items) {
    if (!item.sub_recipe_id) continue;
    if (wouldCreateSubRecipeCycle(adjacency, recipeId, item.sub_recipe_id)) {
      throw new AuthorizationError("RECIPE_CYCLE", "recipe_cycle");
    }
  }
}

async function isReferencedAsSubRecipe(recipeId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_items")
    .select("id", { count: "exact", head: true })
    .eq("sub_recipe_id", recipeId);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function assertStatusTransition(
  establishmentId: string,
  recipeId: string,
  existing: Recipe,
  status: RecipeStatus
): Promise<void> {
  if (status === existing.status) return;

  if (status === "active" && existing.status !== "active") {
    const count = await countRecipeItems(recipeId);
    if (count < RECIPE_MIN_ITEMS_FOR_ACTIVE) {
      throw new AuthorizationError("RECIPE_EMPTY", "recipe_empty");
    }
  }
  if (status === "inactive" && existing.status === "active" && existing.is_default) {
    // The active default cannot be deactivated without choosing another default.
    throw new AuthorizationError("RECIPE_ACTIVE_REQUIRED", "recipe_active_required");
  }
  void establishmentId;
}

async function countRecipeItems(recipeId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("recipe_items")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipeId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return count ?? 0;
}

/** Recursively resolves the raw cost of a sub-recipe (depth-safe). */
async function resolveSubRecipeCost(
  establishmentId: string,
  recipeId: string,
  conversions: UnitConversion[],
  visited: Set<string>,
  depth: number
): Promise<number> {
  if (visited.has(recipeId) || depth > 20) return 0;
  visited.add(recipeId);

  const items = await fetchRecipeItems(establishmentId, recipeId);

  const ingredientIds = items
    .map((item) => item.ingredient_id)
    .filter((id): id is string => Boolean(id));
  const ingredients = ingredientIds.length
    ? await fetchIngredientsByIds(establishmentId, ingredientIds)
    : [];
  const ingredientCost = new Map<string, number | null>();
  for (const ingredient of ingredients) {
    ingredientCost.set(
      ingredient.id,
      calculateIngredientCostPerBaseUnit({
        purchaseCost: Number(ingredient.purchase_cost),
        purchaseQuantity: Number(ingredient.purchase_quantity),
        purchaseUnitId: ingredient.purchase_unit_id ?? "",
        baseUnitId: ingredient.base_unit_id ?? null,
        conversions,
      })
    );
  }

  const subRecipeIds = items
    .map((item) => item.sub_recipe_id)
    .filter((id): id is string => Boolean(id));
  const subCosts = new Map<string, number>();
  for (const id of subRecipeIds) {
    subCosts.set(
      id,
      await resolveSubRecipeCost(establishmentId, id, conversions, visited, depth + 1)
    );
  }

  visited.delete(recipeId);

  const result = calculateRecipeRawCost({
    items: items.map((item) => ({
      quantity: Number(item.quantity),
      unitId: item.unit_id,
      baseUnitId: item.ingredient_id
        ? ingredients.find((i) => i.id === item.ingredient_id)?.base_unit_id ?? null
        : null,
      costPerBaseUnit: item.ingredient_id
        ? ingredientCost.get(item.ingredient_id) ?? null
        : null,
      subRecipeCost: item.sub_recipe_id
        ? subCosts.get(item.sub_recipe_id) ?? null
        : null,
      conversions,
    })),
    conversions,
  });
  return result.missingData ? 0 : result.rawCost;
}

async function insertItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeId: string,
  items: RecipeItem[]
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from("recipe_items").insert(
    items.map((item, index) => ({
      recipe_id: recipeId,
      ingredient_id: item.ingredient_id,
      sub_recipe_id: item.sub_recipe_id,
      quantity: item.quantity,
      unit_id: item.unit_id,
      waste_percentage: item.waste_percentage,
      notes: item.notes,
      sort_order: item.sort_order ?? (index + 1) * 10,
    }))
  );
  if (error) throw toRecipeError(error);
}

function toRecipeError(error: { message: string }): AuthorizationError {
  return toAuthorizationError(error) as AuthorizationError;
}