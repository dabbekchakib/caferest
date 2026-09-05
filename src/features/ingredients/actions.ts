"use server";

import { revalidatePath } from "next/cache";
import {
  createIngredientSchema,
  updateIngredientSchema,
  deleteIngredientSchema,
  ingredientCostSchema,
  ingredientStatusSchema,
  ingredientReorderSchema,
} from "@/validations/ingredients";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
  setIngredientStatus,
  updateIngredientCost,
  reorderIngredients,
  uploadIngredientImage,
  removeIngredientImage,
  getIngredient,
  searchIngredients,
  listIngredients,
  type IngredientTranslationInput,
} from "@/services/ingredients-service";
import type { IngredientType } from "@/lib/ingredients/types";
import type { IngredientSelectorEntry } from "@/lib/ingredients/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import { AuthorizationError } from "@/lib/authorization/errors";

export type IngredientLocaleField = {
  name?: string;
  description?: string | null;
};

function toTranslationRows(translations?: {
  en?: IngredientLocaleField;
  ar?: IngredientLocaleField;
}): IngredientTranslationInput[] {
  const rows: IngredientTranslationInput[] = [];
  (["en", "ar"] as const).forEach((locale) => {
    const entry = translations?.[locale];
    if (!entry) return;
    rows.push({
      locale,
      name: entry.name?.trim(),
      description:
        entry.description != null ? entry.description.trim() : entry.description,
    });
  });
  return rows;
}

export async function createIngredientAction(
  input: {
    name: string;
    slug: string;
    description?: string | null;
    ingredientType: IngredientType;
    categoryId?: string | null;
    baseUnitId?: string | null;
    purchaseUnitId?: string | null;
    purchaseQuantity: number;
    purchaseCost: number;
    wastePercentage: number;
    sku?: string | null;
    barcode?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    isStockTracked?: boolean;
    translations?: { en?: IngredientLocaleField; ar?: IngredientLocaleField };
    imageUrl?: string | null;
  },
  image?: File | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createIngredientSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.create");

    const { establishmentId: estId, translations, ...rest } = parsed.data;
    const created = await createIngredient(estId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    if (image) {
      const url = await uploadIngredientImage(estId, created.id, image);
      await updateIngredient(estId, created.id, { imageUrl: url });
    }

    await writeAudit({
      action: "ingredient.created",
      establishmentId: estId,
      entityType: "ingredient",
      entityId: created.id,
      newValues: {
        name: created.name,
        slug: created.slug,
        sku: created.sku,
        purchaseCost: created.purchase_cost,
        type: created.ingredient_type,
      },
    });

    revalidatePath("/ingredients");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateIngredientAction(
  input: {
    ingredientId: string;
    name?: string;
    slug?: string;
    description?: string | null;
    ingredientType?: IngredientType;
    categoryId?: string | null;
    baseUnitId?: string | null;
    purchaseUnitId?: string | null;
    purchaseQuantity?: number;
    purchaseCost?: number;
    wastePercentage?: number;
    sku?: string | null;
    barcode?: string | null;
    isActive?: boolean;
    isStockTracked?: boolean;
    translations?: { en?: IngredientLocaleField; ar?: IngredientLocaleField };
    imageUrl?: string | null;
  },
  image?: File | null,
  removeImage = false
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateIngredientSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.update");

    const {
      ingredientId,
      establishmentId: estId,
      translations,
      imageUrl,
      ...rest
    } = parsed.data;

    const existing = await getIngredient(estId, ingredientId);
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    let nextImageUrl: string | null = imageUrl ?? null;
    if (image) {
      nextImageUrl = await uploadIngredientImage(estId, ingredientId, image);
    } else if (removeImage) {
      nextImageUrl = null;
    }

    await updateIngredient(estId, ingredientId, {
      ...rest,
      ...(nextImageUrl !== existing.image_url ? { imageUrl: nextImageUrl } : {}),
      translations: toTranslationRows(translations),
    });

    if (existing.image_url && nextImageUrl !== existing.image_url) {
      await removeIngredientImage(existing.image_url).catch(() => undefined);
    }

    await writeAudit({
      action: "ingredient.updated",
      establishmentId: estId,
      entityType: "ingredient",
      entityId: ingredientId,
      newValues: {
        name: rest.name,
        slug: rest.slug,
        sku: rest.sku,
        purchaseCost: rest.purchaseCost,
        ingredientType: rest.ingredientType,
        isActive: rest.isActive,
        isStockTracked: rest.isStockTracked,
      },
    });

    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteIngredientAction(input: {
  ingredientId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteIngredientSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.delete");
    await deleteIngredient(establishmentId, parsed.data.ingredientId);

    await writeAudit({
      action: "ingredient.deleted",
      establishmentId,
      entityType: "ingredient",
      entityId: parsed.data.ingredientId,
    });

    revalidatePath("/ingredients");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setIngredientStatusAction(input: {
  ingredientId: string;
  field: "is_active" | "is_stock_tracked";
  value: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = ingredientStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.update-status");
    await setIngredientStatus(
      establishmentId,
      parsed.data.ingredientId,
      parsed.data.field,
      parsed.data.value
    );

    const action =
      parsed.data.field === "is_active"
        ? parsed.data.value
          ? "ingredient.activated"
          : "ingredient.deactivated"
        : "ingredient.stock_tracking_changed";

    await writeAudit({
      action,
      establishmentId,
      entityType: "ingredient",
      entityId: parsed.data.ingredientId,
      newValues: { [parsed.data.field]: parsed.data.value },
    });

    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function updateIngredientCostAction(input: {
  ingredientId: string;
  purchaseCost: number;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = ingredientCostSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.update-cost");
    await updateIngredientCost(
      establishmentId,
      parsed.data.ingredientId,
      parsed.data.purchaseCost
    );

    await writeAudit({
      action: "ingredient.cost_changed",
      establishmentId,
      entityType: "ingredient",
      entityId: parsed.data.ingredientId,
      newValues: { purchaseCost: parsed.data.purchaseCost },
    });

    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function reorderIngredientsAction(input: {
  categoryId?: string | null;
  orderedIds: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = ingredientReorderSchema.safeParse({
      ...input,
      establishmentId,
      categoryId: input.categoryId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("ingredients.reorder");

    const { orderedIds } = parsed.data;
    const categoryId = parsed.data.categoryId ?? null;
    const ingredients = await listIngredients(establishmentId);
    await reorderIngredients(ingredients, categoryId, orderedIds);

    await writeAudit({
      action: "ingredient.reordered",
      establishmentId,
      entityType: "ingredient",
      newValues: { categoryId: categoryId ?? null, orderedIds },
    });

    revalidatePath("/ingredients");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function searchIngredientsAction(input: {
  query: string;
  locale?: string;
  limit?: number;
}): Promise<ActionResult<IngredientSelectorEntry[]>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("ingredients.view");
    const entries = await searchIngredients(establishmentId, input.query, {
      locale: input.locale,
      limit: input.limit,
    });
    return ok(entries);
  } catch (error) {
    return fail(error);
  }
}