import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type {
  Ingredient,
  IngredientWithTranslations,
  IngredientTranslationsMap,
  IngredientSelectorEntry,
  IngredientType,
} from "@/lib/ingredients/types";
import { groupIngredientTranslations, resolveIngredientName } from "@/lib/ingredients/translations";
import { slugify, uniqueSlug } from "@/lib/ingredients/slug";
import { calculateIngredientCostPerBaseUnit } from "@/lib/ingredients/cost";
import { getCatalogCached } from "@/services/units-cache";
import {
  INGREDIENT_IMAGE_BUCKET,
  INGREDIENT_IMAGE_MAX_BYTES,
  INGREDIENT_IMAGE_MIMES,
} from "@/lib/ingredients/constants";

/** Master/fallback text fields always written to `ingredients` (locale = fr). */
export interface IngredientContentFields {
  name: string;
  description?: string | null;
}

export interface IngredientCreateInput extends IngredientContentFields {
  slug?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ingredientType: IngredientType;
  categoryId?: string | null;
  baseUnitId?: string | null;
  purchaseUnitId?: string | null;
  purchaseQuantity?: number;
  purchaseCost?: number;
  wastePercentage?: number;
  sortOrder?: number;
  isActive?: boolean;
  isStockTracked?: boolean;
  translations?: IngredientTranslationInput[];
  imageUrl?: string | null;
}

export interface IngredientUpdateInput {
  name?: string;
  description?: string | null;
  slug?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ingredientType?: IngredientType;
  categoryId?: string | null;
  baseUnitId?: string | null;
  purchaseUnitId?: string | null;
  purchaseQuantity?: number;
  purchaseCost?: number;
  wastePercentage?: number;
  isActive?: boolean;
  isStockTracked?: boolean;
  translations?: IngredientTranslationInput[];
  imageUrl?: string | null;
}

export interface IngredientTranslationInput {
  locale: "en" | "ar";
  name?: string;
  description?: string | null;
}

export interface IngredientListOptions {
  activeOnly?: boolean;
  categoryId?: string | null;
  types?: IngredientType[];
  query?: string;
}

export interface IngredientPageOptions {
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
  stockTrackedOnly?: boolean;
  categoryId?: string | null;
  ingredientType?: IngredientType | null;
  query?: string;
}

export interface IngredientPageResult {
  items: IngredientWithTranslations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getIngredient(
  establishmentId: string,
  ingredientId: string
): Promise<IngredientWithTranslations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const translated = await enrichWithTranslations([data]);
  return translated[0] ?? null;
}

/** Server-side paginated list with filters (§43: table view pagination). */
export async function getIngredientsPage(
  establishmentId: string,
  options: IngredientPageOptions = {}
): Promise<IngredientPageResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));

  const matchingIds = await resolveQueryIds(establishmentId, options.query);
  const supabase = await createClient();

  // The id filters are applied twice (count + items) with the builder's own
  // inferred type so the generic PostgREST builder assignments stay sound.
  let countQuery = supabase
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId);
  if (options.activeOnly) countQuery = countQuery.eq("is_active", true);
  if (options.stockTrackedOnly) countQuery = countQuery.eq("is_stock_tracked", true);
  if (options.categoryId) countQuery = countQuery.eq("category_id", options.categoryId);
  if (options.ingredientType) {
    countQuery = countQuery.eq("ingredient_type", options.ingredientType);
  }
  if (matchingIds) {
    const ids = [...matchingIds].slice(0, 1000);
    countQuery =
      ids.length === 0
        ? countQuery.in("id", ["00000000-0000-0000-0000-000000000000"])
        : countQuery.in("id", ids);
  }
  const { count, error: countError } = await countQuery;
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  let itemsQuery = supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId);
  if (options.activeOnly) itemsQuery = itemsQuery.eq("is_active", true);
  if (options.stockTrackedOnly) itemsQuery = itemsQuery.eq("is_stock_tracked", true);
  if (options.categoryId) itemsQuery = itemsQuery.eq("category_id", options.categoryId);
  if (options.ingredientType) {
    itemsQuery = itemsQuery.eq("ingredient_type", options.ingredientType);
  }
  if (matchingIds) {
    const ids = [...matchingIds].slice(0, 1000);
    itemsQuery =
      ids.length === 0
        ? itemsQuery.in("id", ["00000000-0000-0000-0000-000000000000"])
        : itemsQuery.in("id", ids);
  }
  const { data, error } = await itemsQuery
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const items = await enrichWithTranslations(data ?? []);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Unpaged catalog list (reorder, category views, selector fallbacks). */
export async function listIngredients(
  establishmentId: string,
  options: IngredientListOptions = {}
): Promise<IngredientWithTranslations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (options.activeOnly) query = query.eq("is_active", true);
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.types && options.types.length > 0) {
    query = query.in("ingredient_type", options.types);
  }
  if (options.query && options.query.trim()) {
    query = query.ilike("name", `%${options.query.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return enrichWithTranslations(data ?? []);
}

/** Catalog search over name / SKU / barcode and localized names (lightweight). */
export async function searchIngredients(
  establishmentId: string,
  query: string,
  options: { locale?: string; limit?: number } = {}
): Promise<IngredientSelectorEntry[]> {
  const limit = options.limit ?? 20;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ids = await resolveQueryIds(establishmentId, trimmed);
  if (!ids || ids.size === 0) return [];
  const ranked = [...ids].slice(0, limit);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", ranked)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const locale = options.locale && ["fr", "en", "ar"].includes(options.locale) ? options.locale : "fr";
  return enrichSelectorEntries(data ?? [], locale);
}

/** Enriched selector entries for explicit ingredient ids. */
export async function getIngredientEntries(
  establishmentId: string,
  ingredientIds: string[]
): Promise<IngredientSelectorEntry[]> {
  if (ingredientIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return enrichSelectorEntries(data ?? [], "fr");
}

// ---------------------------------------------------------------------------
// Cost-per-base-unit (normalizes the purchase cost to the base unit)
// ---------------------------------------------------------------------------

export async function getIngredientCostPerBaseUnit(
  establishmentId: string,
  ingredient: Pick<
    Ingredient,
    "purchase_cost" | "purchase_quantity" | "purchase_unit_id" | "base_unit_id"
  >
): Promise<number | null> {
  const { conversions } = await getCatalogCached(establishmentId);
  return calculateIngredientCostPerBaseUnit({
    purchaseCost: Number(ingredient.purchase_cost),
    purchaseQuantity: Number(ingredient.purchase_quantity),
    purchaseUnitId: ingredient.purchase_unit_id ?? "",
    baseUnitId: ingredient.base_unit_id ?? null,
    conversions,
  });
}

// ---------------------------------------------------------------------------
// Counters (future dashboard)
// ---------------------------------------------------------------------------

async function countIngredientsWhere(
  establishmentId: string,
  where: Array<{ key: string; value: unknown }>
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId);
  for (const { key, value } of where) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return count ?? 0;
}

export async function countIngredients(establishmentId: string): Promise<number> {
  return countIngredientsWhere(establishmentId, []);
}

export async function countActiveIngredients(
  establishmentId: string
): Promise<number> {
  return countIngredientsWhere(establishmentId, [{ key: "is_active", value: true }]);
}

export async function countStockTrackedIngredients(
  establishmentId: string
): Promise<number> {
  return countIngredientsWhere(establishmentId, [
    { key: "is_stock_tracked", value: true },
  ]);
}

export async function countIngredientsByCategory(
  establishmentId: string,
  categoryId: string
): Promise<number> {
  return countIngredientsWhere(establishmentId, [
    { key: "category_id", value: categoryId },
  ]);
}

export async function countIngredientsByType(
  establishmentId: string,
  type: IngredientType
): Promise<number> {
  return countIngredientsWhere(establishmentId, [
    { key: "ingredient_type", value: type },
  ]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createIngredient(
  establishmentId: string,
  input: IngredientCreateInput
): Promise<Ingredient> {
  const supabase = await createClient();
  const name = input.name.trim();
  const requestedSlug =
    input.slug && input.slug.trim() ? slugify(input.slug) : slugify(name);
  if (!requestedSlug) throw new AuthorizationError("GENERIC", "invalid_slug");

  const taken = await existingSlugs(establishmentId);
  const slug = uniqueSlug(requestedSlug, taken);

  await assertSkuAvailable(establishmentId, input.sku, undefined);
  await assertBarcodeAvailable(establishmentId, input.barcode, undefined);
  await assertReferences(establishmentId, input);

  const { data, error } = await supabase
    .from("ingredients")
    .insert({
      establishment_id: establishmentId,
      category_id: input.categoryId ?? null,
      name,
      slug,
      sku: input.sku?.trim() ? input.sku.trim() : null,
      barcode: input.barcode?.trim() ? input.barcode.trim() : null,
      description: input.description ?? null,
      ingredient_type: input.ingredientType,
      base_unit_id: input.baseUnitId ?? null,
      purchase_unit_id: input.purchaseUnitId ?? null,
      purchase_quantity: input.purchaseQuantity ?? 1,
      purchase_cost: input.purchaseCost ?? 0,
      waste_percentage: input.wastePercentage ?? 0,
      image_url: input.imageUrl ?? null,
      sort_order: input.sortOrder ?? 10,
      is_active: input.isActive ?? true,
      is_stock_tracked: input.isStockTracked ?? true,
      is_system: false,
    })
    .select()
    .single();
  if (error) throw toIngredientError(error);

  await upsertTranslations(supabase, data.id, input.translations ?? []);
  return data;
}

export async function updateIngredient(
  establishmentId: string,
  ingredientId: string,
  input: IngredientUpdateInput
): Promise<IngredientWithTranslations> {
  const supabase = await createClient();
  const existing = await getIngredientRow(establishmentId, ingredientId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_INGREDIENT_PROTECTED");
  }

  let slug = existing.slug;
  if (input.slug && input.slug.trim() && slugify(input.slug) !== existing.slug) {
    slug = slugify(input.slug);
    const taken = await existingSlugs(establishmentId, existing.id);
    if (taken.has(slug)) {
      throw new AuthorizationError("INGREDIENT_SLUG_EXISTS", "ingredient_slug_exists");
    }
  }

  await assertSkuAvailable(establishmentId, input.sku, existing.id);
  await assertBarcodeAvailable(establishmentId, input.barcode, existing.id);
  const refsChanged =
    input.categoryId !== undefined ||
    input.baseUnitId !== undefined ||
    input.purchaseUnitId !== undefined;
  if (refsChanged) {
    await assertReferences(establishmentId, {
      categoryId: input.categoryId === undefined ? existing.category_id : input.categoryId,
      baseUnitId: input.baseUnitId === undefined ? existing.base_unit_id : input.baseUnitId,
      purchaseUnitId:
        input.purchaseUnitId === undefined ? existing.purchase_unit_id : input.purchaseUnitId,
    });
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  patch.slug = slug;
  if (input.sku !== undefined) patch.sku = input.sku?.trim() ? input.sku.trim() : null;
  if (input.barcode !== undefined) {
    patch.barcode = input.barcode?.trim() ? input.barcode.trim() : null;
  }
  if (input.ingredientType !== undefined) patch.ingredient_type = input.ingredientType;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null;
  if (input.baseUnitId !== undefined) patch.base_unit_id = input.baseUnitId ?? null;
  if (input.purchaseUnitId !== undefined) {
    patch.purchase_unit_id = input.purchaseUnitId ?? null;
  }
  if (input.purchaseQuantity !== undefined) patch.purchase_quantity = input.purchaseQuantity;
  if (input.purchaseCost !== undefined) patch.purchase_cost = input.purchaseCost;
  if (input.wastePercentage !== undefined) patch.waste_percentage = input.wastePercentage;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.isStockTracked !== undefined) patch.is_stock_tracked = input.isStockTracked;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

  const { error } = await supabase
    .from("ingredients")
    .update(patch)
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .eq("is_system", false)
    .select()
    .single();
  if (error) throw toIngredientError(error);

  if (input.translations) {
    await upsertTranslations(supabase, ingredientId, input.translations);
  }

  const enriched = await getIngredient(establishmentId, ingredientId);
  return (
    enriched ??
    (() => {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_not_found");
    })()
  );
}

export async function deleteIngredient(
  establishmentId: string,
  ingredientId: string
): Promise<void> {
  const supabase = await createClient();
  const existing = await getIngredientRow(establishmentId, ingredientId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_INGREDIENT_PROTECTED");
  }

  await assertNotInUse(ingredientId);

  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .eq("is_system", false);
  if (error) throw toIngredientError(error);

  if (existing.image_url) {
    try {
      await removeIngredientImage(existing.image_url);
    } catch {
      // best-effort cleanup, never blocks the delete
    }
  }
}

export async function setIngredientStatus(
  establishmentId: string,
  ingredientId: string,
  field: "is_active" | "is_stock_tracked",
  value: boolean
): Promise<void> {
  const supabase = await createClient();
  const existing = await getIngredientRow(establishmentId, ingredientId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_INGREDIENT_PROTECTED");
  }

  const { error } = await supabase
    .from("ingredients")
    .update({ [field]: value })
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .eq("is_system", false);
  if (error) throw toIngredientError(error);
}

export async function updateIngredientCost(
  establishmentId: string,
  ingredientId: string,
  purchaseCost: number
): Promise<void> {
  const supabase = await createClient();
  const existing = await getIngredientRow(establishmentId, ingredientId);
  if (existing.is_system) {
    throw new AuthorizationError("SYSTEM_INGREDIENT_PROTECTED");
  }

  const { error } = await supabase
    .from("ingredients")
    .update({ purchase_cost: purchaseCost })
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .eq("is_system", false);
  if (error) throw toIngredientError(error);
}

/**
 * Persists a full sibling ordering: every ingredient must belong to
 * `categoryId` (or be uncategorized when categoryId is null).
 */
export async function reorderIngredients(
  allIngredients: Ingredient[],
  categoryId: string | null,
  orderedIds: string[]
): Promise<void> {
  const siblings = allIngredients.filter(
    (ingredient) => (ingredient.category_id ?? null) === categoryId
  );
  const siblingIds = new Set(siblings.map((ingredient) => ingredient.id));
  if (orderedIds.length !== siblingIds.size) {
    throw new AuthorizationError("GENERIC", "reorder_invalid_membership");
  }
  for (const id of orderedIds) {
    if (!siblingIds.has(id)) {
      throw new AuthorizationError("GENERIC", "reorder_invalid_membership");
    }
  }

  const supabase = await createClient();
  const writes = orderedIds.map(async (id, index) => {
    const ingredient = siblings.find((i) => i.id === id);
    const nextSort = (index + 1) * 10;
    if (!ingredient || ingredient.sort_order === nextSort) return;
    const { error } = await supabase
      .from("ingredients")
      .update({ sort_order: nextSort })
      .eq("id", id);
    if (error) throw toIngredientError(error);
  });
  await Promise.all(writes);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function uploadIngredientImage(
  establishmentId: string,
  ingredientId: string,
  file: File
): Promise<string> {
  if (file.size > INGREDIENT_IMAGE_MAX_BYTES) {
    throw new AuthorizationError("GENERIC", "ingredient_image_too_large");
  }
  if (!INGREDIENT_IMAGE_MIMES.has(file.type)) {
    throw new AuthorizationError("GENERIC", "ingredient_image_bad_type");
  }

  const safeName = String(file.name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  const path = `establishments/${establishmentId}/ingredients/${ingredientId}/${Date.now()}_${safeName}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(INGREDIENT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const { data } = supabase.storage
    .from(INGREDIENT_IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function removeIngredientImage(imageUrl: string): Promise<void> {
  const path = extractStoredIngredientImagePath(imageUrl);
  if (!path) return;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(INGREDIENT_IMAGE_BUCKET)
    .remove([path]);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

export function extractStoredIngredientImagePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const bucketIndex = segments.findIndex((s) => s === "ingredient-images");
    if (bucketIndex === -1) return null;
    return segments.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function getIngredientRow(
  establishmentId: string,
  ingredientId: string
): Promise<Ingredient> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_not_found");
  }
  return data;
}

async function enrichWithTranslations(
  ingredients: Ingredient[]
): Promise<IngredientWithTranslations[]> {
  if (ingredients.length === 0) return [];
  const translations = await fetchTranslationsFor(
    ingredients.map((ingredient) => ingredient.id)
  );
  return ingredients.map((ingredient) => ({
    ...ingredient,
    translations: translations[ingredient.id] ?? ({} as IngredientTranslationsMap),
  }));
}

async function fetchTranslationsFor(
  ingredientIds: string[]
): Promise<Record<string, IngredientTranslationsMap>> {
  if (ingredientIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_translations")
    .select("*")
    .in("ingredient_id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return groupIngredientTranslations(data ?? []);
}

async function existingSlugs(
  establishmentId: string,
  excludingId?: string
): Promise<Set<string>> {
  const supabase = await createClient();
  let query = supabase
    .from("ingredients")
    .select("slug")
    .eq("establishment_id", establishmentId);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return new Set((data ?? []).map((row) => row.slug));
}

async function assertSkuAvailable(
  establishmentId: string,
  sku: string | null | undefined,
  excludingId?: string
): Promise<void> {
  const value = sku?.trim();
  if (!value) return;
  const supabase = await createClient();
  let query = supabase
    .from("ingredients")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("sku", value);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.length > 0) {
    throw new AuthorizationError("DUPLICATE_SKU", "duplicate_sku");
  }
}

async function assertBarcodeAvailable(
  establishmentId: string,
  barcode: string | null | undefined,
  excludingId?: string
): Promise<void> {
  const value = barcode?.trim();
  if (!value) return;
  const supabase = await createClient();
  let query = supabase
    .from("ingredients")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("barcode", value);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.length > 0) {
    throw new AuthorizationError("DUPLICATE_BARCODE", "duplicate_barcode");
  }
}

interface PartialIngredientRefs {
  categoryId?: string | null;
  baseUnitId?: string | null;
  purchaseUnitId?: string | null;
}

/** Forbids references to rows of another establishment (system units allowed). */
async function assertReferences(
  establishmentId: string,
  refs: PartialIngredientRefs
): Promise<void> {
  const supabase = await createClient();

  if (refs.categoryId) {
    const { data, error } = await supabase
      .from("categories")
      .select("establishment_id")
      .eq("id", refs.categoryId)
      .maybeSingle();
    if (error || !data || data.establishment_id !== establishmentId) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "category_not_found");
    }
  }

  for (const unitId of [refs.baseUnitId, refs.purchaseUnitId]) {
    if (!unitId) continue;
    const { data, error } = await supabase
      .from("units")
      .select("establishment_id")
      .eq("id", unitId)
      .maybeSingle();
    if (error || !data) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
    }
    if (
      data.establishment_id !== establishmentId &&
      data.establishment_id !== null
    ) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
    }
  }
}

async function assertNotInUse(ingredientId: string): Promise<void> {
  const supabase = await createClient();
  try {
    const [recipes, purchaseOrders, stockItems, stockMovements] =
      await Promise.all([
        supabase
          .from("recipe_items")
          .select("id", { count: "exact", head: true })
          .eq("ingredient_id", ingredientId),
        supabase
          .from("purchase_order_items")
          .select("id", { count: "exact", head: true })
          .eq("ingredient_id", ingredientId),
        supabase
          .from("stock_items")
          .select("id", { count: "exact", head: true })
          .eq("ingredient_id", ingredientId),
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .eq("ingredient_id", ingredientId),
      ]);

    const inUse =
      (recipes.count ?? 0) > 0 ||
      (purchaseOrders.count ?? 0) > 0 ||
      (stockItems.count ?? 0) > 0 ||
      (stockMovements.count ?? 0) > 0;
    if (inUse) {
      throw new AuthorizationError("INGREDIENT_IN_USE", "ingredient_in_use");
    }
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    // RLS may not expose the child tables to every editor; never block a
    // legitimate delete when the references cannot be resolved.
  }
}

async function upsertTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ingredientId: string,
  translations: IngredientTranslationInput[]
): Promise<void> {
  for (const entry of translations) {
    const name = entry.name?.trim() ?? "";
    if (name === "") {
      await supabase
        .from("ingredient_translations")
        .delete()
        .eq("ingredient_id", ingredientId)
        .eq("locale", entry.locale);
      continue;
    }
    const { error } = await supabase.from("ingredient_translations").upsert(
      {
        ingredient_id: ingredientId,
        locale: entry.locale,
        name,
        description: entry.description ?? null,
      },
      { onConflict: "ingredient_id,locale" }
    );
    if (error) throw toIngredientError(error);
  }
}

function toIngredientError(error: { message: string }): AuthorizationError {
  // Maps DB constraint messages (e.g. `uq_ingredients_establishment_sku`,
  // `system_ingredient_protected`) onto stable domain codes.
  return toAuthorizationError(error) as AuthorizationError;
}

/**
 * Resolves the ingredient ids matching the query text (master + localized).
 * Returns null when no text query is given (no id filtering applies).
 */
async function resolveQueryIds(
  establishmentId: string,
  query?: string
): Promise<Set<string> | null> {
  const trimmed = query?.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const like = `%${trimmed}%`;
  const [byName, bySku, byBarcode, byTranslation] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("name", like),
    supabase
      .from("ingredients")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("sku", like),
    supabase
      .from("ingredients")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("barcode", like),
    supabase
      .from("ingredient_translations")
      .select("ingredient_id")
      .ilike("name", like),
  ]);

  const ids = new Set<string>();
  for (const rows of [byName.data, bySku.data, byBarcode.data]) {
    for (const row of rows ?? []) ids.add(row.id);
  }
  for (const row of byTranslation.data ?? []) ids.add(row.ingredient_id);
  return ids;
}

/** Unit symbol lookup shared by the selector enrichment. */
async function unitSymbolLookup(ids: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("units")
    .select("id, symbol")
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, row.symbol);
  return map;
}

/** Category name lookup shared by the selector enrichment. */
async function categoryNameLookup(ids: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, row.name);
  return map;
}

/**
 * Enriches raw rows into selector entries: localized name, unit symbols,
 * category name and the cost-per-base-unit (via the conversion catalog).
 */
async function enrichSelectorEntries(
  ingredients: Ingredient[],
  locale = "fr"
): Promise<IngredientSelectorEntry[]> {
  if (ingredients.length === 0) return [];

  const establishmentId = ingredients[0].establishment_id;
  const [translations, catalog, unitSymbols, categoryNames] = await Promise.all([
    fetchTranslationsFor(ingredients.map((ingredient) => ingredient.id)),
    getCatalogCached(establishmentId),
    unitSymbolLookup(
      ingredients.flatMap((ingredient) =>
        [ingredient.base_unit_id, ingredient.purchase_unit_id].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
    categoryNameLookup(
      ingredients
        .map((ingredient) => ingredient.category_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]);

  return ingredients.map((ingredient) => {
    const tr = translations[ingredient.id] ?? {};
    return {
      id: ingredient.id,
      name: resolveIngredientName(ingredient.name, tr, locale),
      sku: ingredient.sku,
      ingredientType: ingredient.ingredient_type,
      baseUnitId: ingredient.base_unit_id,
      purchaseUnitId: ingredient.purchase_unit_id,
      baseUnitSymbol: ingredient.base_unit_id
        ? unitSymbols.get(ingredient.base_unit_id) ?? null
        : null,
      purchaseUnitSymbol: ingredient.purchase_unit_id
        ? unitSymbols.get(ingredient.purchase_unit_id) ?? null
        : null,
      purchaseQuantity: Number(ingredient.purchase_quantity),
      purchaseCost: Number(ingredient.purchase_cost),
      costPerBaseUnit: calculateIngredientCostPerBaseUnit({
        purchaseCost: Number(ingredient.purchase_cost),
        purchaseQuantity: Number(ingredient.purchase_quantity),
        purchaseUnitId: ingredient.purchase_unit_id ?? "",
        baseUnitId: ingredient.base_unit_id ?? null,
        conversions: catalog.conversions,
      }),
      categoryId: ingredient.category_id,
      categoryName: ingredient.category_id
        ? categoryNames.get(ingredient.category_id) ?? null
        : null,
      imageUrl: ingredient.image_url,
      isActive: ingredient.is_active,
      isStockTracked: ingredient.is_stock_tracked,
      wastePercentage: Number(ingredient.waste_percentage),
    };
  });
}