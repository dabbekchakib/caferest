import { z } from "zod";

export const productLocaleSchema = z.enum(["fr", "en", "ar"]);

export const productSlugSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(80, { message: "validation.maxLength" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "validation.regex" });

const productNameSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(120, { message: "validation.maxLength" });

const productDescriptionSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const shortDescriptionSchema = z
  .string()
  .trim()
  .max(200, { message: "validation.maxLength" })
  .nullable()
  .optional();

const priceSchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(99_999_999, { message: "validation.maxValue" });

const codeSchema = z
  .string()
  .trim()
  .min(1, { message: "validation.minLength" })
  .max(80, { message: "validation.maxLength" })
  .nullable()
  .optional();

const uuidNullableSchema = z
  .string()
  .uuid({ message: "validation.invalidValue" })
  .nullable()
  .optional();

/**
 * Optional translation locale. An empty `name` signals "remove the row" on
 * update (the master FR name always guarantees a displayable fallback).
 */
const translationLocaleSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, { message: "validation.maxLength" })
    .optional(),
  shortDescription: shortDescriptionSchema,
  description: productDescriptionSchema,
});

const translationsSchema = z
  .object({
    en: translationLocaleSchema.optional(),
    ar: translationLocaleSchema.optional(),
  })
  .optional();

export const createProductSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: productNameSchema,
  slug: productSlugSchema,
  shortDescription: shortDescriptionSchema,
  description: productDescriptionSchema,
  productType: z.enum(["product", "composite", "service"], {
    message: "validation.invalidValue",
  }),
  categoryId: uuidNullableSchema,
  unitId: uuidNullableSchema,
  taxId: uuidNullableSchema,
  price: priceSchema,
  cost: priceSchema.default(0),
  sku: codeSchema,
  barcode: codeSchema,
  sortOrder: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPosEnabled: z.boolean().optional(),
  isStockTracked: z.boolean().optional(),
  translations: translationsSchema,
  imageUrl: z
    .string()
    .url({ message: "validation.invalidValue" })
    .max(2000, { message: "validation.maxLength" })
    .nullable()
    .optional(),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.extend({
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  name: productNameSchema.optional(),
  slug: productSlugSchema.optional(),
});

export type UpdateProductValues = z.infer<typeof updateProductSchema>;

export const deleteProductSchema = z.object({
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteProductValues = z.infer<typeof deleteProductSchema>;

export const productPriceSchema = z.object({
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  price: priceSchema,
});

export type ProductPriceValues = z.infer<typeof productPriceSchema>;

export const productStatusSchema = z.object({
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  field: z.enum(
    ["is_active", "is_available", "is_pos_enabled", "is_featured"],
    { message: "validation.invalidValue" }
  ),
  value: z.boolean(),
});

export type ProductStatusValues = z.infer<typeof productStatusSchema>;

export const productReorderSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  categoryId: uuidNullableSchema,
  orderedIds: z
    .array(z.string().uuid({ message: "validation.invalidValue" }))
    .min(1, { message: "validation.required" })
    .max(500, { message: "validation.maxLength" }),
});

export type ProductReorderValues = z.infer<typeof productReorderSchema>;

export const removeProductImageSchema = z.object({
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RemoveProductImageValues = z.infer<typeof removeProductImageSchema>;