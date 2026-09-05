"use server";

import { revalidatePath } from "next/cache";
import {
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  productPriceSchema,
  productStatusSchema,
  productReorderSchema,
} from "@/validations/products";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setProductStatus,
  updateProductPrice,
  reorderProducts,
  uploadProductImage,
  removeProductImage,
  getProduct,
  searchProducts,
  listProducts,
  type ProductTranslationInput,
} from "@/services/products-service";
import type { ProductSelectorEntry } from "@/lib/products/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import { AuthorizationError } from "@/lib/authorization/errors";

export type ProductLocaleField = {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
};

function toTranslationRows(translations?: {
  en?: ProductLocaleField;
  ar?: ProductLocaleField;
}): ProductTranslationInput[] {
  const rows: ProductTranslationInput[] = [];
  (["en", "ar"] as const).forEach((locale) => {
    const entry = translations?.[locale];
    if (!entry) return;
    rows.push({
      locale,
      name: entry.name?.trim(),
      shortDescription:
        entry.shortDescription != null
          ? entry.shortDescription.trim()
          : entry.shortDescription,
      description:
        entry.description != null ? entry.description.trim() : entry.description,
    });
  });
  return rows;
}

export async function createProductAction(
  input: {
    name: string;
    slug: string;
    shortDescription?: string | null;
    description?: string | null;
    productType: "product" | "composite" | "service";
    categoryId?: string | null;
    unitId?: string | null;
    taxId?: string | null;
    price: number;
    cost?: number;
    sku?: string | null;
    barcode?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    isAvailable?: boolean;
    isFeatured?: boolean;
    isPosEnabled?: boolean;
    isStockTracked?: boolean;
    translations?: { en?: ProductLocaleField; ar?: ProductLocaleField };
    imageUrl?: string | null;
  },
  image?: File | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createProductSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.create");

    const { establishmentId: estId, translations, ...rest } = parsed.data;
    const created = await createProduct(estId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    if (image) {
      const url = await uploadProductImage(estId, created.id, image);
      await updateProduct(estId, created.id, { imageUrl: url });
    }

    await writeAudit({
      action: "product.created",
      establishmentId: estId,
      entityType: "product",
      entityId: created.id,
      newValues: {
        name: created.name,
        slug: created.slug,
        sku: created.sku,
        price: created.price,
        type: created.product_type,
      },
    });

    revalidatePath("/products");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateProductAction(
  input: {
    productId: string;
    name?: string;
    slug?: string;
    shortDescription?: string | null;
    description?: string | null;
    productType?: "product" | "composite" | "service";
    categoryId?: string | null;
    unitId?: string | null;
    taxId?: string | null;
    price?: number;
    cost?: number;
    sku?: string | null;
    barcode?: string | null;
    isActive?: boolean;
    isAvailable?: boolean;
    isFeatured?: boolean;
    isPosEnabled?: boolean;
    isStockTracked?: boolean;
    translations?: { en?: ProductLocaleField; ar?: ProductLocaleField };
    imageUrl?: string | null;
  },
  image?: File | null,
  removeImage = false
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateProductSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.update");

    const {
      productId,
      establishmentId: estId,
      translations,
      imageUrl,
      ...rest
    } = parsed.data;

    const existing = await getProduct(estId, productId);
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    let nextImageUrl: string | null = imageUrl ?? null;
    if (image) {
      nextImageUrl = await uploadProductImage(estId, productId, image);
    } else if (removeImage) {
      nextImageUrl = null;
    }

    await updateProduct(estId, productId, {
      ...rest,
      ...(nextImageUrl !== existing.image_url
        ? { imageUrl: nextImageUrl }
        : {}),
      translations: toTranslationRows(translations),
    });

    if (existing.image_url && nextImageUrl !== existing.image_url) {
      await removeProductImage(existing.image_url).catch(() => undefined);
    }

    await writeAudit({
      action: "product.updated",
      establishmentId: estId,
      entityType: "product",
      entityId: productId,
      newValues: {
        name: rest.name,
        slug: rest.slug,
        sku: rest.sku,
        price: rest.price,
        type: rest.productType,
        isActive: rest.isActive,
        isAvailable: rest.isAvailable,
      },
    });

    revalidatePath("/products");
    revalidatePath("/products/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProductAction(input: {
  productId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteProductSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.delete");
    await deleteProduct(establishmentId, parsed.data.productId);

    await writeAudit({
      action: "product.deleted",
      establishmentId,
      entityType: "product",
      entityId: parsed.data.productId,
    });

    revalidatePath("/products");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setProductStatusAction(input: {
  productId: string;
  field: "is_active" | "is_available" | "is_pos_enabled" | "is_featured";
  value: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = productStatusSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.update-status");
    await setProductStatus(
      establishmentId,
      parsed.data.productId,
      parsed.data.field,
      parsed.data.value
    );

    const action =
      parsed.data.field === "is_active"
        ? parsed.data.value
          ? "product.activated"
          : "product.deactivated"
        : "product.availability_changed";

    await writeAudit({
      action,
      establishmentId,
      entityType: "product",
      entityId: parsed.data.productId,
      newValues: { [parsed.data.field]: parsed.data.value },
    });

    revalidatePath("/products");
    revalidatePath("/products/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function updateProductPriceAction(input: {
  productId: string;
  price: number;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = productPriceSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.update-price");
    await updateProductPrice(
      establishmentId,
      parsed.data.productId,
      parsed.data.price
    );

    await writeAudit({
      action: "product.price_changed",
      establishmentId,
      entityType: "product",
      entityId: parsed.data.productId,
      newValues: { price: parsed.data.price },
    });

    revalidatePath("/products");
    revalidatePath("/products/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function reorderProductsAction(input: {
  categoryId?: string | null;
  orderedIds: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = productReorderSchema.safeParse({
      ...input,
      establishmentId,
      categoryId: input.categoryId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("products.reorder");

    const { orderedIds } = parsed.data;
    const categoryId = parsed.data.categoryId ?? null;
    const products = await listProducts(establishmentId);
    await reorderProducts(products, categoryId, orderedIds);

    await writeAudit({
      action: "product.reordered",
      establishmentId,
      entityType: "product",
      newValues: { categoryId: categoryId ?? null, orderedIds },
    });

    revalidatePath("/products");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function searchProductsAction(input: {
  query: string;
  locale?: string;
  limit?: number;
}): Promise<ActionResult<ProductSelectorEntry[]>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("products.view");
    const entries = await searchProducts(establishmentId, input.query, {
      locale: input.locale,
      limit: input.limit,
    });
    return ok(entries);
  } catch (error) {
    return fail(error);
  }
}