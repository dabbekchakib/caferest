"use server";

import { revalidatePath } from "next/cache";
import type { RecipeCostBreakdown } from "@/lib/recipes/types";
import {
  createRecipeSchema,
  updateRecipeSchema,
  deleteRecipeSchema,
  recipeStatusSchema,
  setDefaultRecipeSchema,
  duplicateRecipeSchema,
  recipeItemsSchema,
  recipeReorderSchema,
  recipeCostSchema,
} from "@/validations/recipes";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  setRecipeStatus,
  setDefaultRecipe,
  duplicateRecipe,
  saveRecipeItems,
  reorderRecipeItems,
  getRecipeCost,
  searchRecipeSelectorEntries,
  type RecipeTranslationInput,
} from "@/services/recipes-service";
import type { RecipeStatus } from "@/lib/recipes/types";
import type { RecipeSelectorEntry } from "@/lib/recipes/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

export type RecipeLocaleField = {
  name?: string;
  description?: string | null;
  notes?: string | null;
};

function toTranslationRows(translations?: {
  en?: RecipeLocaleField;
  ar?: RecipeLocaleField;
}): RecipeTranslationInput[] {
  const rows: RecipeTranslationInput[] = [];
  (["en", "ar"] as const).forEach((locale) => {
    const entry = translations?.[locale];
    if (!entry) return;
    rows.push({
      locale,
      name: entry.name?.trim(),
      description:
        entry.description != null ? entry.description.trim() : entry.description,
      notes: entry.notes != null ? entry.notes.trim() : entry.notes,
    });
  });
  return rows;
}

function nextStatusPermission(status: RecipeStatus): string {
  if (status === "active") return "recipes.activate";
  if (status === "archived") return "recipes.archive";
  return "recipes.update";
}

export async function createRecipeAction(input: {
  productId: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  yieldType?: "exact_consumption" | "batch_yield" | "range_yield";
  defaultYield?: number;
  yieldUnitId?: string | null;
  preparationTime?: number | null;
  sortOrder?: number;
  translations?: { en?: RecipeLocaleField; ar?: RecipeLocaleField };
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createRecipeSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.create");

    const { establishmentId: estId, translations, ...rest } = parsed.data;
    const created = await createRecipe(estId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    await writeAudit({
      action: "recipe.created",
      establishmentId: estId,
      entityType: "recipe",
      entityId: created.id,
      newValues: {
        name: created.name,
        version: created.version,
        status: created.status,
        productId: created.product_id,
      },
    });

    revalidatePath("/recipes");
    revalidatePath("/products/[id]", "page");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateRecipeAction(input: {
  recipeId: string;
  name?: string;
  description?: string | null;
  notes?: string | null;
  yieldType?: "exact_consumption" | "batch_yield" | "range_yield";
  defaultYield?: number;
  yieldUnitId?: string | null;
  preparationTime?: number | null;
  sortOrder?: number;
  translations?: { en?: RecipeLocaleField; ar?: RecipeLocaleField };
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateRecipeSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.update");

    const {
      recipeId,
      establishmentId: estId,
      translations,
      ...rest
    } = parsed.data;

    await updateRecipe(estId, recipeId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    await writeAudit({
      action: "recipe.updated",
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
      newValues: {
        name: rest.name,
        yieldType: rest.yieldType,
        defaultYield: rest.defaultYield,
        preparationTime: rest.preparationTime,
      },
    });

    revalidatePath("/recipes");
    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/recipes/[id]/edit", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRecipeAction(input: {
  recipeId: string;
}): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteRecipeSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.delete");

    const { recipeId, establishmentId: estId } = parsed.data;
    const result = await deleteRecipe(estId, recipeId);

    await writeAudit({
      action: result.archived ? "recipe.archived" : "recipe.deleted",
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
    });

    revalidatePath("/recipes");
    revalidatePath("/recipes/[id]", "page");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function setRecipeStatusAction(input: {
  recipeId: string;
  status: RecipeStatus;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(nextStatusPermission(parsed.data.status));

    const { recipeId, status, establishmentId: estId } = parsed.data;
    await setRecipeStatus(estId, recipeId, status);

    const action =
      status === "active"
        ? "recipe.activated"
        : status === "archived"
          ? "recipe.archived"
          : status === "inactive"
            ? "recipe.deactivated"
            : "recipe.updated";

    await writeAudit({
      action,
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
      newValues: { status },
    });

    revalidatePath("/recipes");
    revalidatePath("/recipes/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setDefaultRecipeAction(input: {
  recipeId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setDefaultRecipeSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.update");

    const { recipeId, establishmentId: estId } = parsed.data;
    await setDefaultRecipe(estId, recipeId);

    await writeAudit({
      action: "recipe.set_default",
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
    });

    revalidatePath("/recipes");
    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/products/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateRecipeAction(input: {
  recipeId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = duplicateRecipeSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.create");

    const { recipeId, establishmentId: estId } = parsed.data;
    const duplicated = await duplicateRecipe(estId, recipeId);

    await writeAudit({
      action: "recipe.duplicated",
      establishmentId: estId,
      entityType: "recipe",
      entityId: duplicated.id,
      newValues: { sourceRecipeId: recipeId, version: duplicated.version },
    });

    revalidatePath("/recipes");
    return ok({ id: duplicated.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveRecipeItemsAction(input: {
  recipeId: string;
  items: Array<{
    ingredientId?: string | null;
    subRecipeId?: string | null;
    quantity: number;
    unitId?: string | null;
    wastePercentage?: number;
    notes?: string | null;
    sortOrder?: number;
  }>;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeItemsSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.update");

    const { recipeId, items, establishmentId: estId } = parsed.data;
    await saveRecipeItems(estId, recipeId, items);

    await writeAudit({
      action: "recipe.item_updated",
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
      newValues: { itemCount: items.length },
    });

    revalidatePath("/recipes/[id]", "page");
    revalidatePath("/recipes/[id]/edit", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function reorderRecipeItemsAction(input: {
  recipeId: string;
  orderedIds: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeReorderSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.update");

    const { recipeId, orderedIds, establishmentId: estId } = parsed.data;
    await reorderRecipeItems(estId, recipeId, orderedIds);

    await writeAudit({
      action: "recipe.reordered",
      establishmentId: estId,
      entityType: "recipe",
      entityId: recipeId,
      newValues: { orderedIds },
    });

    revalidatePath("/recipes/[id]/edit", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function getRecipeCostAction(input: {
  recipeId: string;
}): Promise<ActionResult<RecipeCostBreakdown>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = recipeCostSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("recipes.cost-view");

    const { recipeId, establishmentId: estId } = parsed.data;
    const breakdown = await getRecipeCost(estId, recipeId);
    return ok(breakdown);
  } catch (error) {
    return fail(error);
  }
}

export async function searchRecipeSelectorEntriesAction(input: {
  query?: string;
  excludingRecipeId?: string;
  limit?: number;
}): Promise<ActionResult<RecipeSelectorEntry[]>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("recipes.view");

    const entries = await searchRecipeSelectorEntries(establishmentId, {
      excludingRecipeId: input.excludingRecipeId,
      limit: input.limit ?? 20,
    });

    if (input.query?.trim()) {
      const needle = input.query.trim().toLowerCase();
      return ok(
        entries.filter(
          (entry) =>
            entry.name.toLowerCase().includes(needle) ||
            (entry.productName?.toLowerCase().includes(needle) ?? false)
        )
      );
    }
    return ok(entries);
  } catch (error) {
    return fail(error);
  }
}