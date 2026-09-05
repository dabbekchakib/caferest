import { z } from "zod";

export const ingredientLocaleSchema = z.enum(["fr", "en", "ar"]);

export const ingredientSlugSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(80, { message: "validation.maxLength" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "validation.regex" });

const ingredientNameSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(120, { message: "validation.maxLength" });

const ingredientDescriptionSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const moneySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(99_999_999, { message: "validation.maxValue" });

const quantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(999_999_999, { message: "validation.maxValue" });

const wasteSchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(100, { message: "validation.maxValue" });

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
  description: ingredientDescriptionSchema,
});

const translationsSchema = z
  .object({
    en: translationLocaleSchema.optional(),
    ar: translationLocaleSchema.optional(),
  })
  .optional();

export const createIngredientSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: ingredientNameSchema,
  slug: ingredientSlugSchema,
  description: ingredientDescriptionSchema,
  ingredientType: z.enum(
    ["raw_material", "semi_finished", "packaged", "consumable", "other"],
    { message: "validation.invalidValue" }
  ),
  categoryId: uuidNullableSchema,
  baseUnitId: uuidNullableSchema,
  purchaseUnitId: uuidNullableSchema,
  purchaseQuantity: quantitySchema.default(1),
  purchaseCost: moneySchema.default(0),
  wastePercentage: wasteSchema.default(0),
  sku: codeSchema,
  barcode: codeSchema,
  sortOrder: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .optional(),
  isActive: z.boolean().optional(),
  isStockTracked: z.boolean().optional(),
  translations: translationsSchema,
  imageUrl: z
    .string()
    .url({ message: "validation.invalidValue" })
    .max(2000, { message: "validation.maxLength" })
    .nullable()
    .optional(),
});

export type CreateIngredientValues = z.infer<typeof createIngredientSchema>;

export const updateIngredientSchema = createIngredientSchema.extend({
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  name: ingredientNameSchema.optional(),
  slug: ingredientSlugSchema.optional(),
});

export type UpdateIngredientValues = z.infer<typeof updateIngredientSchema>;

export const deleteIngredientSchema = z.object({
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteIngredientValues = z.infer<typeof deleteIngredientSchema>;

export const ingredientCostSchema = z.object({
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  purchaseCost: moneySchema,
});

export type IngredientCostValues = z.infer<typeof ingredientCostSchema>;

export const ingredientStatusSchema = z.object({
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  field: z.enum(["is_active", "is_stock_tracked"], {
    message: "validation.invalidValue",
  }),
  value: z.boolean(),
});

export type IngredientStatusValues = z.infer<typeof ingredientStatusSchema>;

export const ingredientReorderSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  categoryId: uuidNullableSchema,
  orderedIds: z
    .array(z.string().uuid({ message: "validation.invalidValue" }))
    .min(1, { message: "validation.required" })
    .max(500, { message: "validation.maxLength" }),
});

export type IngredientReorderValues = z.infer<typeof ingredientReorderSchema>;

export const removeIngredientImageSchema = z.object({
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RemoveIngredientImageValues = z.infer<
  typeof removeIngredientImageSchema
>;