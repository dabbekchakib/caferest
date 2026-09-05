"use server";

import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  moveCategorySchema,
  reorderCategoriesSchema,
  setCategoryStatusSchema,
} from "@/validations/categories";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  moveCategory,
  reorderCategories,
  setCategoryStatus,
  uploadCategoryImage,
  removeCategoryImage,
  listCategories,
  getCategory,
  type CategoryTranslationInput,
} from "@/services/categories-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import { AuthorizationError } from "@/lib/authorization/errors";

type LocaleField = {
  name?: string;
  description?: string | null;
};

function toTranslationRows(
  translations?: { fr?: LocaleField; en?: LocaleField; ar?: LocaleField }
): CategoryTranslationInput[] {
  const rows: CategoryTranslationInput[] = [];
  (["fr", "en", "ar"] as const).forEach((locale) => {
    const entry = translations?.[locale];
    if (!entry) return;
    rows.push({
      locale,
      name: entry.name?.trim(),
      description:
        entry.description != null
          ? entry.description.trim()
          : entry.description,
    });
  });
  return rows;
}

export async function createCategoryAction(
  input: {
    name: string;
    slug: string;
    description?: string | null;
    parentId?: string | null;
    icon?: string | null;
    color?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    translations?: { fr?: LocaleField; en?: LocaleField; ar?: LocaleField };
    imageUrl?: string | null;
  },
  image?: File | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createCategorySchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.create");

    const { establishmentId: estId, translations, ...rest } = parsed.data;
    const created = await createCategory(estId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    if (image) {
      const url = await uploadCategoryImage(estId, created.id, image);
      await updateCategory(estId, created.id, { imageUrl: url });
    }

    await writeAudit({
      action: "category.created",
      establishmentId: estId,
      entityType: "category",
      entityId: created.id,
      newValues: { name: created.name, slug: created.slug, parentId: created.parent_id },
    });

    revalidatePath("/categories");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateCategoryAction(
  input: {
    categoryId: string;
    name?: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    isActive?: boolean;
    translations?: { fr?: LocaleField; en?: LocaleField; ar?: LocaleField };
    imageUrl?: string | null;
  },
  image?: File | null,
  removeImage = false
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateCategorySchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.update");

    const {
      categoryId,
      establishmentId: estId,
      translations,
      imageUrl,
      ...rest
    } = parsed.data;

    const existing = await getCategory(estId, categoryId);
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    let nextImageUrl: string | null = imageUrl ?? null;
    if (image) {
      nextImageUrl = await uploadCategoryImage(estId, categoryId, image);
    } else if (removeImage) {
      nextImageUrl = null;
    }

    await updateCategory(estId, categoryId, {
      ...rest,
      ...(nextImageUrl !== existing.image_url ? { imageUrl: nextImageUrl } : {}),
      translations: toTranslationRows(translations),
    });

    if (existing.image_url && nextImageUrl !== existing.image_url) {
      await removeCategoryImage(existing.image_url).catch(() => undefined);
    }

    await writeAudit({
      action: "category.updated",
      establishmentId: estId,
      entityType: "category",
      entityId: categoryId,
      newValues: {
        name: rest.name,
        slug: rest.slug,
        color: rest.color,
        icon: rest.icon,
        isActive: rest.isActive,
      },
    });

    revalidatePath("/categories");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCategoryAction(input: {
  categoryId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteCategorySchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.delete");
    await deleteCategory(establishmentId, parsed.data.categoryId);

    await writeAudit({
      action: "category.deleted",
      establishmentId,
      entityType: "category",
      entityId: parsed.data.categoryId,
    });

    revalidatePath("/categories");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function moveCategoryAction(input: {
  categoryId: string;
  parentId?: string | null;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = moveCategorySchema.safeParse({
      ...input,
      establishmentId,
      parentId: input.parentId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.update");

    const { categoryId } = parsed.data;
    const parentId = parsed.data.parentId ?? null;
    const categories = await listCategories(establishmentId);
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));
    }

    await moveCategory(category, categories, parentId);

    await writeAudit({
      action: "category.moved",
      establishmentId,
      entityType: "category",
      entityId: categoryId,
      newValues: { parentId: parentId ?? null },
    });

    revalidatePath("/categories");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function reorderCategoriesAction(input: {
  parentId?: string | null;
  orderedIds: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = reorderCategoriesSchema.safeParse({
      ...input,
      establishmentId,
      parentId: input.parentId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.reorder");

    const { orderedIds } = parsed.data;
    const parentId = parsed.data.parentId ?? null;
    const categories = await listCategories(establishmentId);
    await reorderCategories(categories, parentId, orderedIds);

    await writeAudit({
      action: "category.reordered",
      establishmentId,
      entityType: "category",
      newValues: { parentId: parentId ?? null, orderedIds },
    });

    revalidatePath("/categories");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setCategoryStatusAction(input: {
  categoryId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setCategoryStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("categories.update");
    await setCategoryStatus(
      establishmentId,
      parsed.data.categoryId,
      parsed.data.isActive
    );

    await writeAudit({
      action: parsed.data.isActive
        ? "category.activated"
        : "category.deactivated",
      establishmentId,
      entityType: "category",
      entityId: parsed.data.categoryId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/categories");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}